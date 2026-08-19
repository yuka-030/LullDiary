// apps/desktop/src/screens/StoryScreen.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import AudioPlayButton from '../components/AudioPlayButton'
import BookCover from '../components/BookCover'
import PageTurningBook from '../components/PageTurningBook'
import { useAudioNarration } from '../lib/useAudioNarration'
import { useStory } from '../lib/useStory'

type Props = {
  // 記録画面で確定した入力テキスト
  inputText: string
  // 保存する物語テキスト
  onSave: (storyText: string) => void
}

type StoryStage = 'cover' | 'turning' | 'open'

// 表紙を消すまでの時間
const COVER_HIDE_MS = 1200

export default function StoryScreen({ inputText, onSave }: Props) {
  const { status, storyText, audioUrl, errorMessage, generate, audioRef } = useStory()

  const [stage, setStage] = useState<StoryStage>('cover')
  const [coverProgress, setCoverProgress] = useState(0)
  const [pageProgress, setPageProgress] = useState(0)
  const [isCoverVisible, setIsCoverVisible] = useState(true)

  const coverTimerRef = useRef<number | null>(null)
  const coverHideTimerRef = useRef<number | null>(null)
  const pageTimerRef = useRef<number | null>(null)

  const isReady = status === 'ready'

  const { displayedLength, isPaused, isTyping, togglePause, reset } = useAudioNarration({
    audioUrl,
    storyText,
    isActive: stage === 'open',
    audioRef,
  })

  // 演出用タイマーの停止
  const clearTimers = useCallback(() => {
    if (coverTimerRef.current !== null) {
      window.clearTimeout(coverTimerRef.current)
      coverTimerRef.current = null
    }

    if (coverHideTimerRef.current !== null) {
      window.clearTimeout(coverHideTimerRef.current)
      coverHideTimerRef.current = null
    }

    if (pageTimerRef.current !== null) {
      window.clearInterval(pageTimerRef.current)
      pageTimerRef.current = null
    }
  }, [])

  // 演出状態を初期化して生成開始
  const startGeneration = useCallback(() => {
    clearTimers()
    reset()

    setStage('cover')
    setCoverProgress(0)
    setPageProgress(0)
    setIsCoverVisible(true)

    generate(inputText)
  }, [clearTimers, generate, inputText, reset])

  // 初回表示時に生成開始
  useEffect(() => {
    startGeneration()

    return () => {
      clearTimers()
      reset()
    }
  }, [clearTimers, inputText, reset, startGeneration])

  // 閉じた本を2秒表示して表紙を開く
  useEffect(() => {
    if (stage !== 'cover') {
      return
    }

    coverTimerRef.current = window.setTimeout(() => {
      setCoverProgress(1)

      window.setTimeout(() => {
        setStage('turning')
      }, 2500)
    }, 2000)

    return () => {
      if (coverTimerRef.current !== null) {
        window.clearTimeout(coverTimerRef.current)
        coverTimerRef.current = null
      }
    }
  }, [stage])

  // スライドインの途中で表紙を消す
  useEffect(() => {
    if (stage !== 'turning') {
      return
    }

    coverHideTimerRef.current = window.setTimeout(() => {
      setIsCoverVisible(false)
    }, COVER_HIDE_MS)

    return () => {
      if (coverHideTimerRef.current !== null) {
        window.clearTimeout(coverHideTimerRef.current)
        coverHideTimerRef.current = null
      }
    }
  }, [stage])

  // ページめくりの進行を更新
  useEffect(() => {
    if (stage !== 'turning') {
      return
    }

    const pageDuration = 2400
    let progress = 0

    setPageProgress(0)

    pageTimerRef.current = window.setInterval(() => {
      progress += 0.1

      if (progress >= 1) {
        progress = 0
      }

      setPageProgress(progress)
    }, pageDuration / 10)

    return () => {
      if (pageTimerRef.current !== null) {
        window.clearInterval(pageTimerRef.current)
        pageTimerRef.current = null
      }
    }
  }, [stage])

  // 生成完了時に見開き表示へ切り替え
  useEffect(() => {
    if (!isReady) {
      return
    }

    clearTimers()

    setStage('open')
    setPageProgress(0)
    setIsCoverVisible(false)
  }, [clearTimers, isReady])

  return (
    <main className="story-screen">
      {errorMessage && <p className="story-error">{errorMessage}</p>}

      {/* 開いた表紙をスライドインの間だけ背面に残す */}
      {isCoverVisible && (stage === 'cover' || stage === 'turning') && (
        <div
          className={`story-cover-stage ${stage === 'turning' ? 'story-cover-stage-behind' : ''}`}
        >
          <BookCover className="story-cover" progress={coverProgress} />
        </div>
      )}

      {/* 文字とドットの表示 */}
      {stage === 'cover' && (
        <div
          className={`generation-status ${coverProgress === 1 ? 'generation-status-visible' : ''}`}
        >
          <p className="generation-status-text">物語をつくっているよ…</p>

          <div className="generation-dots" aria-hidden="true">
            <span className="generation-dot generation-dot-1" />
            <span className="generation-dot generation-dot-2" />
            <span className="generation-dot generation-dot-3" />
          </div>
        </div>
      )}

      {/* ページめくり中の本を表示 */}
      {stage === 'turning' && (
        <>
          <div className="story-page-turning">
            <PageTurningBook className="story-page-turning-book" pageProgress={pageProgress} />
          </div>

          <div className="generation-status">
            <p className="generation-status-text">物語をつくっているよ…</p>

            <div className="generation-dots" aria-hidden="true">
              <span className="generation-dot generation-dot-1" />
              <span className="generation-dot generation-dot-2" />
              <span className="generation-dot generation-dot-3" />
            </div>
          </div>
        </>
      )}

      {/* 見開きページと操作ボタンを表示 */}
      {stage === 'open' && (
        <>
          <div className="story-open-stage">
            <PageTurningBook className="story-open-book" pageProgress={0} showLeftLines={false} />

            <div className="story-book-content">
              {/* 左ページ:物語文を表示 */}
              <div className="story-left-page">
                <div className="story-text">
                  <p>
                    {storyText.slice(0, displayedLength)}
                    {isTyping && <span className="story-cursor" />}
                  </p>
                </div>
              </div>

              {/* 右ページ:写真追加ボタンを表示 */}
              <div className="story-right-page">
                <button type="button" className="story-photo-button">
                  <span className="story-photo-icon">
                    <PhotoIcon />
                  </span>
                  <span className="story-photo-label">写真を追加</span>
                </button>
              </div>
            </div>
          </div>

          {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

          <div className="story-actions">
            {audioUrl && <AudioPlayButton isPaused={isPaused} onToggle={togglePause} />}

            <button
              type="button"
              onClick={startGeneration}
              className="font-body border-txt2 text-txt2 hover:bg-txt2 cursor-pointer rounded-full border-2 px-6 py-2 transition-colors hover:text-white"
            >
              つくり直す
            </button>

            {!isTyping && (
              <button
                type="button"
                onClick={() => onSave(storyText)}
                className="font-body bg-main hover:bg-glow cursor-pointer rounded-full px-8 py-2 text-white transition-colors"
              >
                保存する
              </button>
            )}
          </div>
        </>
      )}
    </main>
  )
}

// 写真アイコン
function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth={1.5} />
      <circle cx="8.5" cy="10" r="1.5" stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M21 15l-5-5-9 9"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
