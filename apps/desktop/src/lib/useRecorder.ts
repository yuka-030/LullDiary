// apps/desktop/src/lib/useRecorder.ts
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { requestTranscription } from './sttClient'
import { encodeWav } from './wavEncoder'

export type RecorderStatus = 'idle' | 'recording' | 'processing' | 'error'

// 話し方の特徴
export type VoiceProfile = {
  averageLevel: number
  levelVariation: number
}

// 目標サンプルレート
const TARGET_SAMPLE_RATE = 16000

// 無音判定の閾値
const SILENCE_LEVEL = 0.01

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [transcript, setTranscript] = useState<string | null>(null)
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // 録音中の音量
  const [level, setLevel] = useState(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  // 録音したPCMデータ
  const chunksRef = useRef<Float32Array[]>([])
  // 録音中の音量の履歴
  const levelsRef = useRef<number[]>([])

  // 録音に使ったリソースの解放
  const releaseRecording = useCallback(async () => {
    const processor = processorRef.current
    const source = sourceRef.current
    const stream = streamRef.current
    const audioContext = audioContextRef.current

    if (processor) {
      processor.onaudioprocess = null
      processor.disconnect()
      processorRef.current = null
    }

    if (source) {
      source.disconnect()
      sourceRef.current = null
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (audioContext) {
      audioContextRef.current = null

      if (audioContext.state !== 'closed') {
        await audioContext.close().catch(() => {})
      }
    }
  }, [])

  const start = useCallback(async () => {
    setErrorMessage(null)
    setTranscript(null)
    setVoiceProfile(null)

    try {
      // マイクアクセス許可の取得
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: TARGET_SAMPLE_RATE,
        },
      })
      streamRef.current = stream

      // AudioContextの生成
      const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      // PCMデータの蓄積
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      chunksRef.current = []
      levelsRef.current = []

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        chunksRef.current.push(new Float32Array(input))

        // 音量(RMS)の算出
        const sumOfSquares = input.reduce((sum, sample) => sum + sample * sample, 0)
        const rms = Math.sqrt(sumOfSquares / input.length)
        levelsRef.current.push(rms)
        setLevel(Math.min(1, rms * 6))
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      setStatus('recording')
    } catch (err) {
      await releaseRecording()
      setErrorMessage(err instanceof Error ? err.message : 'マイクにアクセスできませんでした')
      setStatus('error')
    }
  }, [releaseRecording])

  const stop = useCallback(async () => {
    const audioContext = audioContextRef.current

    if (!audioContext || !streamRef.current || !processorRef.current || !sourceRef.current) {
      return
    }

    setStatus('processing')
    setLevel(0)

    const sampleRate = audioContext.sampleRate

    // チャンクの結合
    const totalLength = chunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0)
    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of chunksRef.current) {
      merged.set(chunk, offset)
      offset += chunk.length
    }

    await releaseRecording()

    try {
      // 音声前処理
      const processed = await invoke<number[]>('preprocess_audio', {
        samples: Array.from(merged),
      })

      const wavBuffer = encodeWav(new Float32Array(processed), sampleRate)
      const text = await requestTranscription(wavBuffer)

      setVoiceProfile(summarizeLevels(levelsRef.current))
      setTranscript(text)
      setStatus('idle')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }, [releaseRecording])

  // 録音の中止
  const cancel = useCallback(async () => {
    if (streamRef.current === null) {
      return
    }

    await releaseRecording()

    chunksRef.current = []
    levelsRef.current = []

    setLevel(0)
    setStatus('idle')
  }, [releaseRecording])

  // 認識結果の破棄
  const clearTranscript = useCallback(() => {
    setTranscript(null)
  }, [])

  // アンマウント時のリソースの解放
  useEffect(() => {
    return () => {
      void releaseRecording()
    }
  }, [releaseRecording])

  return {
    status,
    start,
    stop,
    cancel,
    transcript,
    voiceProfile,
    clearTranscript,
    errorMessage,
    level,
  }
}

// 話し方の特徴の算出
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
