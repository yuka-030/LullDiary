// apps/desktop/src/lib/useStory.ts
import { useCallback, useRef, useState } from 'react'
import type { Tags } from './entryClient'
import { requestNarration, requestStory, requestTags } from './storyClient'

export type StoryStatus = 'generating' | 'ready' | 'error'

export type NarrationStatus = 'idle' | 'generating' | 'ready' | 'error'

export type InputType = 'voice' | 'text'

// 差し替え可能な生成処理
export type StoryDeps = {
  requestStory: (text: string) => Promise<string>
  requestNarration: (text: string) => Promise<ArrayBuffer>
  requestTags: (text: string) => Promise<Tags>
}

const defaultDeps: StoryDeps = {
  requestStory,
  requestNarration,
  requestTags,
}

export function useStory(deps: StoryDeps = defaultDeps) {
  const [status, setStatus] = useState<StoryStatus>('generating')
  const [narrationStatus, setNarrationStatus] = useState<NarrationStatus>('idle')
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
  // 読み上げ音声生成の実行回数
  const narrationIdRef = useRef(0)
  // 再レンダリングを跨いで保持する生成処理
  const depsRef = useRef(deps)

  depsRef.current = deps

  // 保持中の読み上げ音声の破棄
  const clearNarration = useCallback(() => {
    if (previousAudioUrlRef.current) {
      URL.revokeObjectURL(previousAudioUrlRef.current)
      previousAudioUrlRef.current = null
    }

    narrationBlobRef.current = null
    setAudioUrl(null)
  }, [])

  // 物語文から読み上げ音声を生成する
  const startNarration = useCallback(
    async (text: string) => {
      const narrationId = ++narrationIdRef.current

      setNarrationStatus('generating')
      clearNarration()

      try {
        const narration = await depsRef.current.requestNarration(text)

        // 新しい生成が始まっている場合は結果を破棄
        if (narrationId !== narrationIdRef.current) {
          return
        }

        const blob = new Blob([narration], { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)

        previousAudioUrlRef.current = url
        narrationBlobRef.current = blob

        setAudioUrl(url)
        setNarrationStatus('ready')
      } catch (err) {
        if (narrationId !== narrationIdRef.current) {
          return
        }

        console.error(err)
        setNarrationStatus('error')
      }
    },
    [clearNarration]
  )

  // 確定したテキストから物語・タグを生成し、読み上げ音声を並行して生成する
  const generate = useCallback(
    async (input: string) => {
      const generationId = ++generationIdRef.current

      // 進行中の読み上げ音声生成の結果を破棄
      narrationIdRef.current++

      setStatus('generating')
      setNarrationStatus('idle')
      setErrorMessage(null)
      setStoryText('')
      setTags(null)
      clearNarration()

      try {
        const story = await depsRef.current.requestStory(input)

        if (generationId !== generationIdRef.current) {
          return
        }

        setStoryText(story)

        // 読み上げ音声の生成は物語・タグの状態から切り離して実行
        void startNarration(story)

        const extractedTags = await depsRef.current.requestTags(story)

        if (generationId !== generationIdRef.current) {
          return
        }

        setTags(extractedTags)
        setStatus('ready')
      } catch (err) {
        if (generationId !== generationIdRef.current) {
          return
        }

        setErrorMessage(err instanceof Error ? err.message : String(err))
        setStatus('error')
      }
    },
    [clearNarration, startNarration]
  )

  // 生成済みの物語文からの読み上げ音声の再試行
  const retryNarration = useCallback(() => {
    if (storyText.length === 0) {
      return
    }

    void startNarration(storyText)
  }, [startNarration, storyText])

  return {
    status,
    narrationStatus,
    storyText,
    audioUrl,
    tags,
    errorMessage,
    generate,
    retryNarration,
    audioRef,
    narrationBlobRef,
  }
}
