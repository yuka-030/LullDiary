// apps/desktop/src/lib/useStory.ts
import { useCallback, useRef, useState } from 'react'
import { requestNarration, requestStory } from './storyClient'

export type StoryStatus = 'generating' | 'ready' | 'error'

export function useStory() {
  const [status, setStatus] = useState<StoryStatus>('generating')
  const [storyText, setStoryText] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // 直前に作成したBlob URL。解放漏れを防ぐために保持する
  const previousAudioUrlRef = useRef<string | null>(null)
  // 何回目の生成かを示す番号。古い呼び出しの結果を無視するために使う
  const generationIdRef = useRef(0)

  // 確定したテキストから物語と読み上げ音声を生成する
  const generate = useCallback(async (input: string) => {
    const generationId = ++generationIdRef.current

    setStatus('generating')
    setErrorMessage(null)

    try {
      // 物語文を先に取得する
      const story = await requestStory(input)

      // 待っている間に別の生成が始まっていれば、この結果は捨てる
      if (generationId !== generationIdRef.current) {
        return
      }

      setStoryText(story)

      // 物語文をもとに読み上げ音声を取得する
      const narration = await requestNarration(story)

      if (generationId !== generationIdRef.current) {
        return
      }

      // 古いBlob URLが残っていれば解放してから、新しいものに差し替える
      if (previousAudioUrlRef.current) {
        URL.revokeObjectURL(previousAudioUrlRef.current)
      }

      const blob = new Blob([narration], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      previousAudioUrlRef.current = url
      setAudioUrl(url)

      setStatus('ready')
    } catch (err) {
      if (generationId !== generationIdRef.current) {
        return
      }

      setErrorMessage(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }, [])

  return { status, storyText, audioUrl, errorMessage, generate, audioRef }
}
