// apps/desktop/src/lib/useRecorder.ts
import { invoke } from '@tauri-apps/api/core'
import { appDataDir, join } from '@tauri-apps/api/path'
import { exists, mkdir, writeFile } from '@tauri-apps/plugin-fs'
import { useCallback, useRef, useState } from 'react'
import { requestTranscription } from './sttClient'
import { encodeWav } from './wavEncoder'

export type RecorderStatus = 'idle' | 'recording' | 'processing' | 'error'

/** 話し方の特徴。タグ抽出の手がかりとして使う */
export type VoiceProfile = {
  /** 発話中の平均音量(0〜1) */
  averageLevel: number
  /** 音量の変動の大きさ。抑揚があるほど大きくなる */
  levelVariation: number
}

/**
 * whisper.cpp は 16kHz モノラルの音声を前提としている。
 * 後段でリサンプリングすると変換ロスが生じるため、録音時点でこのレートに揃える。
 */
const TARGET_SAMPLE_RATE = 16000

/** 無音とみなす音量。統計から除くために使う */
const SILENCE_LEVEL = 0.01

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [transcript, setTranscript] = useState<string | null>(null)
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [level, setLevel] = useState(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const chunksRef = useRef<Float32Array[]>([])
  const levelsRef = useRef<number[]>([])

  const start = useCallback(async () => {
    setErrorMessage(null)
    setTranscript(null)
    setVoiceProfile(null)

    try {
      // マイクアクセス許可のリクエスト
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: TARGET_SAMPLE_RATE,
        },
      })
      streamRef.current = stream

      /**
       * AudioContext にもレートを指定する。
       * マイクが 16kHz に対応していない場合でも、ブラウザ側で変換される。
       */
      const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      // ScriptProcessorNodeでPCMデータを蓄積していく
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      chunksRef.current = []
      levelsRef.current = []

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        chunksRef.current.push(new Float32Array(input))

        // 音量(RMS)を算出する。波紋アニメーションと話し方の分析に使う
        const sumOfSquares = input.reduce((sum, sample) => sum + sample * sample, 0)
        const rms = Math.sqrt(sumOfSquares / input.length)
        levelsRef.current.push(rms)
        setLevel(Math.min(1, rms * 6))
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      setStatus('recording')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'マイクにアクセスできませんでした')
      setStatus('error')
    }
  }, [])

  const stop = useCallback(async () => {
    const audioContext = audioContextRef.current
    const stream = streamRef.current
    const processor = processorRef.current
    const source = sourceRef.current

    if (!audioContext || !stream || !processor || !source) {
      return
    }

    setStatus('processing')
    setLevel(0)

    processor.disconnect()
    source.disconnect()
    stream.getTracks().forEach((track) => track.stop())

    const sampleRate = audioContext.sampleRate

    // 蓄積したチャンクを1本のFloat32Arrayに結合
    const totalLength = chunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0)
    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of chunksRef.current) {
      merged.set(chunk, offset)
      offset += chunk.length
    }

    await audioContext.close()

    try {
      /**
       * 自作Cライブラリで前処理する。
       * 音量を揃えたうえで発話の有無を確認し、前後の無音を除いたサンプル列が返る。
       */
      const processed = await invoke<number[]>('preprocess_audio', {
        samples: Array.from(merged),
      })

      const wavBuffer = encodeWav(new Float32Array(processed), sampleRate)

      // 前処理済みの音声を、後から聞き返せるよう保存する
      const dataDir = await appDataDir()
      const audioDir = await join(dataDir, 'audio')

      if (!(await exists(audioDir))) {
        await mkdir(audioDir, { recursive: true })
      }

      const filePath = await join(audioDir, `${Date.now()}.wav`)
      await writeFile(filePath, new Uint8Array(wavBuffer))

      const text = await requestTranscription(wavBuffer)

      setVoiceProfile(summarizeLevels(levelsRef.current))
      setTranscript(text)
      setStatus('idle')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }, [])

  /** モーダルを閉じる際に認識結果を破棄する */
  const clearTranscript = useCallback(() => {
    setTranscript(null)
  }, [])

  return {
    status,
    start,
    stop,
    transcript,
    voiceProfile,
    clearTranscript,
    errorMessage,
    level,
  }
}

/**
 * 録音中に蓄積した音量から、話し方の特徴を求める。
 * 無音部分は話し方を表さないため、統計から除いている。
 */
function summarizeLevels(levels: number[]): VoiceProfile | null {
  const voiced = levels.filter((value) => value > SILENCE_LEVEL)

  if (voiced.length === 0) {
    return null
  }

  const averageLevel = voiced.reduce((sum, value) => sum + value, 0) / voiced.length

  const variance =
    voiced.reduce((sum, value) => sum + (value - averageLevel) ** 2, 0) / voiced.length

  return {
    averageLevel,
    levelVariation: Math.sqrt(variance),
  }
}
