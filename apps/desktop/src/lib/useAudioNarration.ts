// apps/desktop/src/lib/useAudioNarration.ts
import { useCallback, useEffect, useRef, useState } from 'react'

type Options = {
  // 再生する音声のURL
  audioUrl: string | null
  // 文字送りの対象になる物語文
  storyText: string
  // 再生と文字送りを開始してよいかどうか
  isActive: boolean
  // 外部で保持している音声要素
  audioRef: React.RefObject<HTMLAudioElement | null>
}

// 読み上げ音声がない場合の1文字あたりの表示間隔
const FALLBACK_CHAR_INTERVAL_MS = 80

export function useAudioNarration({ audioUrl, storyText, isActive, audioRef }: Options) {
  const [displayedLength, setDisplayedLength] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  // 文字送りのタイマーID
  const charIntervalRef = useRef<number | null>(null)
  // 表示中の文字数
  const displayedLengthRef = useRef(0)
  // 再生開始済みフラグ
  const hasStartedPlaybackRef = useRef(false)
  // 文字送り開始済みフラグ
  const hasStartedFallbackRef = useRef(false)

  const isTyping = displayedLength < storyText.length

  // 文字送りの停止
  const stopCharInterval = useCallback(() => {
    if (charIntervalRef.current !== null) {
      window.clearInterval(charIntervalRef.current)
      charIntervalRef.current = null
    }
  }, [])

  // 指定間隔での文字送りの開始
  const runCharInterval = useCallback(
    (intervalMs: number) => {
      stopCharInterval()

      // 文字表示数を1文字ずつ増加
      charIntervalRef.current = window.setInterval(() => {
        setDisplayedLength((length) => {
          const nextLength = Math.min(length + 1, storyText.length)

          displayedLengthRef.current = nextLength

          if (nextLength >= storyText.length) {
            stopCharInterval()
          }

          return nextLength
        })
      }, intervalMs)
    },
    [stopCharInterval, storyText]
  )

  // 残り時間と残り文字数からの文字送りの開始
  const startCharInterval = useCallback(() => {
    const audio = audioRef.current

    if (!audio || storyText.length === 0) {
      return
    }

    if (audio.duration <= 0 || !Number.isFinite(audio.duration)) {
      return
    }

    const remainingLength = storyText.length - displayedLengthRef.current

    if (remainingLength <= 0) {
      return
    }

    const remainingMs = Math.max(0, (audio.duration - audio.currentTime) * 1000)
    const intervalMs = Math.max(20, remainingMs / remainingLength)

    runCharInterval(intervalMs)
  }, [audioRef, runCharInterval, storyText])

  // 読み上げ音声がない場合の固定速度での文字送りの開始
  const startFallbackCharInterval = useCallback(() => {
    if (storyText.length === 0) {
      return
    }

    const remainingLength = storyText.length - displayedLengthRef.current

    if (remainingLength <= 0) {
      return
    }

    runCharInterval(FALLBACK_CHAR_INTERVAL_MS)
  }, [runCharInterval, storyText])

  // 再生状態の初期化
  const reset = useCallback(() => {
    stopCharInterval()

    const audio = audioRef.current

    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }

    hasStartedPlaybackRef.current = false
    hasStartedFallbackRef.current = false
    displayedLengthRef.current = 0

    setDisplayedLength(0)
    setIsPaused(false)
  }, [audioRef, stopCharInterval])

  // 音声と文字送りの再生と停止の切り替え
  const togglePause = useCallback(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    if (audio.paused) {
      // 末尾まで再生済みの場合は先頭に戻す
      if (audio.ended || audio.currentTime >= audio.duration) {
        audio.currentTime = 0
        displayedLengthRef.current = 0
        setDisplayedLength(0)
      }

      void audio.play()
      startCharInterval()
      setIsPaused(false)
    } else {
      audio.pause()
      stopCharInterval()
      setIsPaused(true)
    }
  }, [audioRef, startCharInterval, stopCharInterval])

  // 非表示時の再生開始済み状態の解除
  useEffect(() => {
    if (!isActive) {
      hasStartedPlaybackRef.current = false
      hasStartedFallbackRef.current = false
    }
  }, [isActive])

  // 読み上げ音声がない場合の文字送りの開始
  useEffect(() => {
    if (!isActive || audioUrl || storyText.length === 0) {
      return
    }

    if (hasStartedFallbackRef.current) {
      return
    }

    hasStartedFallbackRef.current = true

    displayedLengthRef.current = 0

    setDisplayedLength(0)
    setIsPaused(false)

    startFallbackCharInterval()

    return () => {
      stopCharInterval()
    }
  }, [audioUrl, isActive, startFallbackCharInterval, stopCharInterval, storyText])

  // 音声と文字送りの開始
  useEffect(() => {
    if (!isActive || !audioUrl || storyText.length === 0) {
      return
    }

    if (hasStartedPlaybackRef.current) {
      return
    }

    hasStartedPlaybackRef.current = true
    hasStartedFallbackRef.current = false

    const audio = audioRef.current

    if (!audio) {
      return
    }

    audio.pause()
    audio.currentTime = 0
    displayedLengthRef.current = 0

    setDisplayedLength(0)
    setIsPaused(false)

    // メタデータ読み込み後の再生開始
    function handleLoadedMetadata() {
      if (!audio || audio.duration <= 0 || !Number.isFinite(audio.duration)) {
        return
      }

      startCharInterval()

      void audio.play().catch(() => {
        stopCharInterval()
        setIsPaused(true)
      })
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)

    if (audio.readyState >= 1) {
      handleLoadedMetadata()
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      stopCharInterval()
    }
  }, [audioRef, audioUrl, isActive, startCharInterval, stopCharInterval, storyText])

  // 再生終了時の停止状態への切り替え
  useEffect(() => {
    const audio = audioRef.current

    if (!isActive || !audio) {
      return
    }

    // 最後まで再生された時の処理
    function handleEnded() {
      stopCharInterval()

      setDisplayedLength(storyText.length)
      displayedLengthRef.current = storyText.length
      setIsPaused(true)
    }

    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('ended', handleEnded)
    }
  }, [audioRef, audioUrl, isActive, stopCharInterval, storyText])

  return { displayedLength, isPaused, isTyping, togglePause, reset }
}
