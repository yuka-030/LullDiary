// apps/desktop/src/screens/EntryDetailScreen.tsx
import { createPortal } from 'react-dom'
import PageTurningBook from '../components/shared/PageTurningBook'
import PhotoIcon from '../components/shared/PhotoIcon'
import AudioPlayButton from '../components/story/AudioPlayButton'
import ConfirmModal from '../components/story/ConfirmModal'
import { SwapIcon, TrashIcon } from '../components/story/PhotoControlIcons'
import type { Entry } from '../lib/bookshelf/entryTypes'
import { TAG_OPTIONS } from '../lib/bookshelf/entryTypes'
import { useEntryDetail } from '../lib/story/useEntryDetail'

type Props = {
  // 表示する日記
  entry: Entry
  // 日付リストへ戻る
  onBackToDates: () => void
  // 本棚へ戻る
  onBackToBookshelf: () => void
  // 削除後の処理
  onDeleted: () => void
}

export default function EntryDetailScreen({
  entry,
  onBackToDates,
  onBackToBookshelf,
  onDeleted,
}: Props) {
  const {
    isEditing,
    storyText,
    displayedStory,
    displayedLength,
    isTyping,
    isPaused,
    tags,
    displayedPhotoUrl,
    openMenu,
    menuPosition,
    isSaving,
    isDeleting,
    isConfirmVisible,
    errorMessage,
    audioUrl,
    createdLabel,
    audioRef,
    photoInputRef,
    sceneButtonRef,
    emotionButtonRef,
    menuRef,
    togglePause,
    toggleMenu,
    selectScene,
    toggleEmotion,
    selectPhoto,
    removePhoto,
    startEditing,
    cancelEditing,
    changeStoryText,
    save,
    showDeleteConfirm,
    cancelDelete,
    remove,
  } = useEntryDetail({ entry, onDeleted })

  // 写真を選択する
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

      <audio ref={audioRef} src={audioUrl ?? undefined} preload="auto" />

      <p className="book-outer-heading">{createdLabel}</p>

      <div className="story-open-stage entry-detail-stage">
        <PageTurningBook
          className="story-open-book"
          pageProgress={0}
          showLeftLines={false}
          showRightLines={false}
        />

        <div className="story-book-content">
          {/* 左ページの物語文 */}
          <div className="story-left-page">
            {isEditing ? (
              <textarea
                lang="ja"
                value={storyText}
                onChange={(e) => changeStoryText(e.target.value)}
                className="entry-detail-text"
              />
            ) : (
              <div className="story-text">
                <p>
                  {displayedStory.slice(0, displayedLength)}
                  {isTyping && <span className="story-cursor" />}
                </p>
              </div>
            )}
          </div>

          {/* 右ページの写真とタグ */}
          <div className="story-right-page entry-detail-right">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {displayedPhotoUrl ? (
              <div className="story-photo-frame entry-detail-photo">
                <img src={displayedPhotoUrl} alt="添付した写真" className="story-photo-image" />
              </div>
            ) : isEditing ? (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="story-photo-button entry-detail-photo"
              >
                <span className="story-photo-icon">
                  <PhotoIcon />
                </span>
                <span className="story-photo-label">写真を追加</span>
              </button>
            ) : (
              <div className="story-photo-button entry-detail-photo entry-detail-photo-static">
                <span className="story-photo-icon">
                  <PhotoIcon />
                </span>
              </div>
            )}

            {isEditing && displayedPhotoUrl && (
              <div className="story-photo-controls">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="story-photo-control"
                >
                  <SwapIcon className="story-photo-control-icon" />
                  変更
                </button>

                <button type="button" onClick={removePhoto} className="story-photo-control">
                  <TrashIcon className="story-photo-control-icon" />
                  削除
                </button>
              </div>
            )}

            {isEditing && (
              <div className="entry-detail-tag-selects">
                <button
                  ref={sceneButtonRef}
                  type="button"
                  onClick={() => toggleMenu('scene', sceneButtonRef.current)}
                  className="bookshelf-select entry-detail-select"
                >
                  どこで
                </button>

                <button
                  ref={emotionButtonRef}
                  type="button"
                  onClick={() => toggleMenu('emotion', emotionButtonRef.current)}
                  className="bookshelf-select entry-detail-select"
                >
                  きもち
                </button>
              </div>
            )}

            <div className="entry-detail-tag-marks">
              <span className="entry-detail-tag-mark">{tags.シーン}</span>

              {tags.感情.map((emotion) => (
                <span key={emotion} className="entry-detail-tag-mark">
                  {emotion}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* タグ候補メニュー */}
      {isEditing &&
        openMenu !== null &&
        createPortal(
          <div
            ref={menuRef}
            className="option-menu option-menu-floating"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {openMenu === 'scene'
              ? TAG_OPTIONS.シーン.map((scene) => (
                  <button
                    key={scene}
                    type="button"
                    onClick={() => selectScene(scene)}
                    className={`option-menu-item ${
                      tags.シーン === scene ? 'option-menu-item-active' : ''
                    }`}
                  >
                    {scene}
                  </button>
                ))
              : TAG_OPTIONS.感情.map((emotion) => (
                  <label key={emotion} className="option-menu-check">
                    <input
                      type="checkbox"
                      checked={tags.感情.includes(emotion)}
                      onChange={() => toggleEmotion(emotion)}
                      className="option-menu-checkbox"
                    />
                    {emotion}
                  </label>
                ))}
          </div>,
          document.body
        )}

      {isEditing ? (
        <div className="story-actions story-actions-edit">
          <button
            type="button"
            onClick={cancelEditing}
            disabled={isSaving}
            className="font-body border-txt2 text-txt2 hover:bg-txt2 entry-detail-action cursor-pointer rounded-full border-2 py-2 text-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            やめる
          </button>

          <button
            type="button"
            onClick={save}
            disabled={isSaving}
            className="font-body bg-main hover:bg-glow entry-detail-action cursor-pointer rounded-full py-2 text-sm text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? '保存中…' : '保存する'}
          </button>
        </div>
      ) : (
        <div className="story-actions story-actions-stacked">
          <div className="story-actions-line">
            {audioUrl && <AudioPlayButton isPaused={isPaused} onToggle={togglePause} />}

            <button
              type="button"
              onClick={startEditing}
              className="font-body border-main text-main hover:bg-main cursor-pointer rounded-full border-2 px-6 py-2 text-sm transition-colors hover:text-white"
            >
              編集する
            </button>

            <button
              type="button"
              onClick={showDeleteConfirm}
              disabled={isDeleting}
              className="font-body border-rec text-rec hover:bg-rec cursor-pointer rounded-full border-2 px-6 py-2 text-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              削除する
            </button>
          </div>

          <div className="story-actions-line">
            <button type="button" onClick={onBackToBookshelf} className="back-link">
              ← 本棚にもどる
            </button>

            <button type="button" onClick={onBackToDates} className="back-link">
              日付にもどる →
            </button>
          </div>
        </div>
      )}

      {isConfirmVisible && (
        <ConfirmModal
          title="この日記を削除する?"
          message="削除すると、物語も音声も写真も戻せません。"
          confirmLabel="削除する"
          onConfirm={remove}
          onCancel={cancelDelete}
        />
      )}
    </main>
  )
}
