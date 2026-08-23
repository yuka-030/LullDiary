// apps/desktop/src/screens/StoryScreen.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import AudioPlayButton from '../components/AudioPlayButton'
import BookCover from '../components/BookCover'
import PageTurningBook from '../components/PageTurningBook'
import { createEntry } from '../lib/entryClient'
import { useAudioNarration } from '../lib/useAudioNarration'
import { useStory, type InputType } from '../lib/useStory'

type Props = {
  // 記録画面で確定した入力テキスト
  inputText: string
  // 入力方法
  inputType: InputType
  // 保存が完了した後の処理
  onSave: () => void
}

type StoryStage = 'cover' | 'turning' | 'open'

// 表紙を消すまでの時間
const COVER_HIDE_MS = 1200

export default function StoryScreen({ inputText, inputType, onSave }: Props) {
  const {
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
  } = useStory()

  // 表示中の演出段階
  const [stage, setStage] = useState<StoryStage>('cover')
  // 表紙の開き具合
  const [coverProgress, setCoverProgress] = useState(0)
  // ページめくりの進行度
  const [pageProgress, setPageProgress] = useState(0)
  const [isCoverVisible, setIsCoverVisible] = useState(true)
  const [photo, setPhoto] = useState<File | null>(null)
  // 選択した写真のプレビューURL
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const coverTimerRef = useRef<number | null>(null)
  const coverHideTimerRef = useRef<number | null>(null)
  const pageTimerRef = useRef<number | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // 読み上げ音声の成否が決着してから見開きへ切り替える
  const isReady = status === 'ready' && narrationStatus !== 'generating'

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

  // 選択中の写真の解除
  const clearPhoto = useCallback(() => {
    setPhoto(null)
    setPhotoUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }

      return null
    })
  }, [])

  // 演出状態を初期化して生成開始
  const startGeneration = useCallback(() => {
    clearTimers()
    reset()
    clearPhoto()

    setStage('cover')
    setCoverProgress(0)
    setPageProgress(0)
    setIsCoverVisible(true)
    setSaveError(null)

    generate(inputText)
  }, [clearPhoto, clearTimers, generate, inputText, reset])

  // 初回表示時に生成開始
  useEffect(() => {
    startGeneration()

    return () => {
      clearTimers()
      reset()
      clearPhoto()
    }
  }, [clearPhoto, clearTimers, inputText, reset, startGeneration])

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

  // 写真の選択
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]

    e.target.value = ''

    if (!file) {
      return
    }

    // 前のプレビューURLの解放
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl)
    }

    setPhoto(file)
    setPhotoUrl(URL.createObjectURL(file))
  }

  // 日記の保存
  async function handleSave() {
    if (!tags) {
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      await createEntry({
        inputType,
        rawInputText: inputText,
        storyText,
        tags,
        narration: narrationBlobRef.current ?? undefined,
        photos: photo ? [photo] : [],
      })

      onSave()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="story-screen">
      {errorMessage && <p className="story-error">{errorMessage}</p>}
      {saveError && <p className="story-error">{saveError}</p>}

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

              {/* 右ページ:写真を表示 */}
              <div className="story-right-page">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                {photoUrl ? (
                  <div className="story-photo-frame">
                    <img src={photoUrl} alt="添付した写真" className="story-photo-image" />

                    <div className="story-photo-controls">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="story-photo-control"
                      >
                        変える
                      </button>
                      <button type="button" onClick={clearPhoto} className="story-photo-control">
                        削除
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="story-photo-button"
                  >
                    <span className="story-photo-icon">
                      <PhotoIcon />
                    </span>
                    <span className="story-photo-label">写真を追加</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

          {/* 読み上げ音声の生成に失敗した場合の案内 */}
          {narrationStatus === 'error' && (
            <p className="story-error">
              音声の作成に失敗しました。
              <br />
              物語はそのままで音声だけつくり直しますか?
            </p>
          )}

          <div className="story-actions">
            {audioUrl && <AudioPlayButton isPaused={isPaused} onToggle={togglePause} />}

            {narrationStatus === 'generating' && (
              <span className="font-body text-txt2 px-6 py-2">音声をつくっているよ…</span>
            )}

            {narrationStatus === 'error' && (
              <button
                type="button"
                onClick={retryNarration}
                className="font-body border-sub text-sub hover:bg-sub cursor-pointer rounded-full border-2 px-6 py-2 transition-colors hover:text-white"
              >
                音声をつくり直す
              </button>
            )}

            <button
              type="button"
              onClick={startGeneration}
              className="font-body border-txt2 text-txt2 hover:bg-txt2 cursor-pointer rounded-full border-2 px-6 py-2 transition-colors hover:text-white"
            >
              {narrationStatus === 'error' ? '物語からつくり直す' : 'つくり直す'}
            </button>

            {!isTyping && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !tags}
                className="font-body bg-main hover:bg-glow cursor-pointer rounded-full px-8 py-2 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving ? '保存中…' : '保存する'}
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
