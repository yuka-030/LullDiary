// apps/desktop/src/lib/story/useAudioNarration.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { NarrationTiming } from './storyClient'

type Options = {
  // 再生する音声のURL
  audioUrl: string | null
  // 文字送りの対象になる物語文
  storyText: string
  // 再生と文字送りの開始許可
  isActive: boolean
  // 外部で保持している音声要素
  audioRef: React.RefObject<HTMLAudioElement | null>
  // VOICEVOXから取得した文字ごとの発話タイミング
  timings?: NarrationTiming[]
}

// 読み上げ音声がない場合の1文字あたりの表示間隔
const FALLBACK_CHAR_INTERVAL_MS = 80

// 読点の後の文字表示待機時間
const COMMA_DISPLAY_PAUSE_SECONDS = 0.4

// 句点の後の文字表示待機時間
const PERIOD_DISPLAY_PAUSE_SECONDS = 0.7

// タイミング未指定時の既定値
const EMPTY_TIMINGS: NarrationTiming[] = []

export function useAudioNarration({
  audioUrl,
  storyText,
  isActive,
  audioRef,
  timings = EMPTY_TIMINGS,
}: Options) {
  const [displayedLength, setDisplayedLength] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  // 読み上げ音声なしの文字送りのタイマーID
  const fallbackIntervalRef = useRef<number | null>(null)
  // 音声再生位置を監視するアニメーションID
  const animationFrameRef = useRef<number | null>(null)
  // 表示中の文字数
  const displayedLengthRef = useRef(0)
  // 再生開始済みフラグ
  const hasStartedPlaybackRef = useRef(false)
  // 再生要求の世代番号
  const playbackAttemptRef = useRef(0)

  const isTyping = displayedLength < storyText.length

  // 読み上げ音声なしの文字送りの停止
  const stopFallbackInterval = useCallback(() => {
    if (fallbackIntervalRef.current !== null) {
      window.clearInterval(fallbackIntervalRef.current)
      fallbackIntervalRef.current = null
    }
  }, [])

  // 音声再生位置の監視の停止
  const stopAnimationFrame = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  // 音声再生位置に応じた表示文字数の同期
  const syncDisplayedLength = useCallback(() => {
    const audio = audioRef.current

    if (!audio || storyText.length === 0 || audio.paused) {
      return
    }

    const currentTime = audio.currentTime

    // VOICEVOXの発話タイミングに基づく文字同期
    if (timings.length >= storyText.length) {
      let nextLength = 0
      let punctuationPause = 0

      for (const timing of timings) {
        if (timing.index >= storyText.length) {
          break
        }

        if (currentTime >= timing.end + punctuationPause) {
          nextLength = timing.index + 1

          if (storyText[timing.index] === '、') {
            punctuationPause += COMMA_DISPLAY_PAUSE_SECONDS
          } else if (storyText[timing.index] === '。') {
            punctuationPause += PERIOD_DISPLAY_PAUSE_SECONDS
          }

          continue
        }

        break
      }

      nextLength = Math.min(storyText.length, nextLength)

      if (nextLength !== displayedLengthRef.current) {
        displayedLengthRef.current = nextLength
        setDisplayedLength(nextLength)
      }

      return
    }

    // タイミング取得前・取得失敗時のフォールバック
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      return
    }

    const progress = Math.min(1, Math.max(0, currentTime / audio.duration))
    const nextLength = Math.min(storyText.length, Math.floor(storyText.length * progress))

    if (nextLength === displayedLengthRef.current) {
      return
    }

    displayedLengthRef.current = nextLength
    setDisplayedLength(nextLength)
  }, [audioRef, storyText, timings])

  // フレームごとの音声再生位置の監視
  const startAnimationFrame = useCallback(() => {
    stopAnimationFrame()

    function update() {
      const audio = audioRef.current

      if (!audio || audio.paused || audio.ended) {
        animationFrameRef.current = null
        return
      }

      syncDisplayedLength()

      animationFrameRef.current = window.requestAnimationFrame(update)
    }

    animationFrameRef.current = window.requestAnimationFrame(update)
  }, [audioRef, stopAnimationFrame, syncDisplayedLength])

  // 音声の再生
  const playAudio = useCallback(async () => {
    const audio = audioRef.current

    if (!audio) {
      return false
    }

    const attempt = ++playbackAttemptRef.current

    try {
      await audio.play()

      if (attempt !== playbackAttemptRef.current) {
        return false
      }

      setIsPaused(false)

      // 再生成功後の文字同期の開始
      syncDisplayedLength()
      startAnimationFrame()

      return true
    } catch {
      if (attempt === playbackAttemptRef.current) {
        setIsPaused(true)
      }

      return false
    }
  }, [audioRef, startAnimationFrame, syncDisplayedLength])

  // 再生状態の初期化
  const reset = useCallback(() => {
    stopFallbackInterval()
    stopAnimationFrame()

    const audio = audioRef.current

    playbackAttemptRef.current += 1

    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }

    hasStartedPlaybackRef.current = false
    displayedLengthRef.current = 0

    setDisplayedLength(0)
    setIsPaused(false)
  }, [audioRef, stopAnimationFrame, stopFallbackInterval])

  // 音声と文字送りの再生・停止の切り替え
  const togglePause = useCallback(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    if (audio.paused) {
      if (audio.ended || (Number.isFinite(audio.duration) && audio.currentTime >= audio.duration)) {
        audio.currentTime = 0
        displayedLengthRef.current = 0
        setDisplayedLength(0)
      }

      void playAudio()
      return
    }

    // 再生要求の無効化と再生の停止
    playbackAttemptRef.current += 1
    audio.pause()
    stopAnimationFrame()
    setIsPaused(true)
    syncDisplayedLength()
  }, [audioRef, playAudio, stopAnimationFrame, syncDisplayedLength])

  // 非表示時の再生開始済み状態の解除
  useEffect(() => {
    if (!isActive) {
      hasStartedPlaybackRef.current = false
      stopAnimationFrame()
    }
  }, [isActive, stopAnimationFrame])

  // 読み上げ音声がない場合の固定速度での文字送り
  useEffect(() => {
    if (!isActive || audioUrl || storyText.length === 0) {
      return
    }

    displayedLengthRef.current = 0
    setDisplayedLength(0)
    setIsPaused(false)

    fallbackIntervalRef.current = window.setInterval(() => {
      setDisplayedLength((length) => {
        const nextLength = Math.min(length + 1, storyText.length)

        displayedLengthRef.current = nextLength

        if (nextLength >= storyText.length) {
          stopFallbackInterval()
        }

        return nextLength
      })
    }, FALLBACK_CHAR_INTERVAL_MS)

    return () => {
      stopFallbackInterval()
    }
  }, [audioUrl, isActive, stopFallbackInterval, storyText])

  // 音声と文字送りの開始
  useEffect(() => {
    if (!isActive || !audioUrl || storyText.length === 0) {
      return
    }

    if (hasStartedPlaybackRef.current) {
      return
    }

    const audio = audioRef.current

    if (!audio) {
      return
    }

    hasStartedPlaybackRef.current = true
    playbackAttemptRef.current += 1

    const attempt = playbackAttemptRef.current

    audio.pause()
    audio.currentTime = 0
    audio.load()

    // 再生開始前の表示文字数の初期化
    displayedLengthRef.current = 0
    setDisplayedLength(0)
    setIsPaused(true)

    let isCleanedUp = false

    // 音声読み込み完了後の自動再生
    const handleReady = () => {
      if (isCleanedUp || attempt !== playbackAttemptRef.current) {
        return
      }

      void playAudio()
    }

    audio.addEventListener('loadedmetadata', handleReady)
    audio.addEventListener('canplay', handleReady)

    // 読み込み済み音声の自動再生
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      handleReady()
    }

    return () => {
      isCleanedUp = true

      audio.removeEventListener('loadedmetadata', handleReady)
      audio.removeEventListener('canplay', handleReady)

      playbackAttemptRef.current += 1
      hasStartedPlaybackRef.current = false
      stopAnimationFrame()
    }
  }, [audioRef, audioUrl, isActive, playAudio, stopAnimationFrame, storyText])

  // 音声の再生状態と文字表示の同期
  useEffect(() => {
    const audio = audioRef.current

    if (!isActive || !audio || !audioUrl) {
      return
    }

    function handlePlay() {
      setIsPaused(false)

      // playイベント時の文字同期の開始
      syncDisplayedLength()
      startAnimationFrame()
    }

    function handlePause() {
      stopAnimationFrame()
      setIsPaused(true)
      syncDisplayedLength()
    }

    function handleEnded() {
      stopAnimationFrame()

      displayedLengthRef.current = storyText.length
      setDisplayedLength(storyText.length)
      setIsPaused(true)
    }

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)

      stopAnimationFrame()
    }
  }, [
    audioRef,
    audioUrl,
    isActive,
    startAnimationFrame,
    stopAnimationFrame,
    storyText,
    syncDisplayedLength,
  ])

  // タイミング取得が後から完了した場合の文字同期
  useEffect(() => {
    const audio = audioRef.current

    if (!isActive || !audio || !audioUrl || audio.paused || audio.ended) {
      return
    }

    syncDisplayedLength()
    startAnimationFrame()

    return () => {
      stopAnimationFrame()
    }
  }, [
    audioRef,
    audioUrl,
    isActive,
    startAnimationFrame,
    stopAnimationFrame,
    syncDisplayedLength,
    timings,
  ])

  return {
    displayedLength,
    isPaused,
    isTyping,
    togglePause,
    reset,
  }
}
