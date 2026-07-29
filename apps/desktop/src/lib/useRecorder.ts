// apps/desktop/src/lib/useRecorder.ts
import { appDataDir, join } from '@tauri-apps/api/path'
import { exists, mkdir, writeFile } from '@tauri-apps/plugin-fs'
import { useCallback, useRef, useState } from 'react'
import { encodeWav } from './wavEncoder'

export type RecorderStatus = 'idle' | 'recording' | 'saving' | 'error'

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const chunksRef = useRef<Float32Array[]>([])

  const start = useCallback(async () => {
    setErrorMessage(null)

    try {
      // 1. マイクアクセス許可のリクエスト
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })
      streamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      // ScriptProcessorNodeでPCMデータを蓄積していく
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      chunksRef.current = []

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        chunksRef.current.push(new Float32Array(input))
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

    setStatus('saving')

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
      const wavBuffer = encodeWav(merged, sampleRate)

      const dataDir = await appDataDir()
      const audioDir = await join(dataDir, 'audio')

      if (!(await exists(audioDir))) {
        await mkdir(audioDir, { recursive: true })
      }

      const fileName = `${Date.now()}.wav`
      const filePath = await join(audioDir, fileName)

      await writeFile(filePath, new Uint8Array(wavBuffer))

      setLastSavedPath(filePath)
      setStatus('idle')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '録音データの保存に失敗しました')
      setStatus('error')
    }
  }, [])

  return { status, start, stop, lastSavedPath, errorMessage }
}
