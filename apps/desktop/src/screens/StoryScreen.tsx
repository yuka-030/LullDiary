// apps/desktop/src/screens/StoryScreen.tsx
import PageTurningBook from '../components/shared/PageTurningBook'
import PhotoIcon from '../components/shared/PhotoIcon'
import AudioPlayButton from '../components/story/AudioPlayButton'
import BookCover from '../components/story/BookCover'
import { SwapIcon, TrashIcon } from '../components/story/PhotoControlIcons'
import type { InputType } from '../lib/story/useStory'
import { useStoryScreen } from '../lib/story/useStoryScreen'

type Props = {
  // 記録画面で確定した入力テキスト
  inputText: string
  // 入力方法
  inputType: InputType
  // 保存が完了した後の処理
  onSave: () => void
}

export default function StoryScreen({ inputText, inputType, onSave }: Props) {
  const {
    stage,
    coverProgress,
    pageProgress,
    isCoverVisible,
    storyText,
    displayedLength,
    isTyping,
    isPaused,
    audioUrl,
    narrationStatus,
    tags,
    photoUrl,
    isSaving,
    errorMessage,
    saveError,
    audioRef,
    photoInputRef,
    togglePause,
    startGeneration,
    retryNarration,
    selectPhoto,
    clearPhoto,
    save,
  } = useStoryScreen({ inputText, inputType, onSave })

  // 写真の選択
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]

    e.target.value = ''

    if (file) {
      selectPhoto(file)
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
                        <SwapIcon className="story-photo-control-icon" />
                        変更
                      </button>

                      <button type="button" onClick={clearPhoto} className="story-photo-control">
                        <TrashIcon className="story-photo-control-icon" />
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
                onClick={save}
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
