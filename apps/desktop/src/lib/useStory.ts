// apps/desktop/src/lib/useStory.ts
import { useCallback, useRef, useState } from 'react'
import type { Tags } from './entryClient'
import { requestNarration, requestStory, requestTags } from './storyClient'

export type StoryStatus = 'generating' | 'ready' | 'error'

export type InputType = 'voice' | 'text'

export function useStory() {
  const [status, setStatus] = useState<StoryStatus>('generating')
  const [storyText, setStoryText] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [tags, setTags] = useState<Tags | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  // 解放対象のBlob URL
  const previousAudioUrlRef = useRef<string | null>(null)
  // 保存用の読み上げ音声データ
  const narrationBlobRef = useRef<Blob | null>(null)
  // 生成の実行回数
  const generationIdRef = useRef(0)

  // 確定したテキストから物語・読み上げ音声・タグを生成する
  const generate = useCallback(async (input: string) => {
    const generationId = ++generationIdRef.current

    setStatus('generating')
    setErrorMessage(null)
    setTags(null)
    narrationBlobRef.current = null

    try {
      const story = await requestStory(input)

      // 新しい生成が始まっている場合は結果を破棄
      if (generationId !== generationIdRef.current) {
        return
      }

      setStoryText(story)

      // 読み上げ音声とタグの並行取得
      const [narration, extractedTags] = await Promise.all([
        requestNarration(story),
        requestTags(story),
      ])

      if (generationId !== generationIdRef.current) {
        return
      }

      // 古いBlob URLの解放
      if (previousAudioUrlRef.current) {
        URL.revokeObjectURL(previousAudioUrlRef.current)
      }

      const blob = new Blob([narration], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      previousAudioUrlRef.current = url
      narrationBlobRef.current = blob
      setAudioUrl(url)
      setTags(extractedTags)

      setStatus('ready')
    } catch (err) {
      if (generationId !== generationIdRef.current) {
        return
      }

      setErrorMessage(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }, [])

  return { status, storyText, audioUrl, tags, errorMessage, generate, audioRef, narrationBlobRef }
}
