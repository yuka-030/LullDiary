// apps/desktop/src/screens/EntryDetailScreen.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AudioPlayButton from '../components/AudioPlayButton'
import ConfirmModal from '../components/ConfirmModal'
import PageTurningBook from '../components/PageTurningBook'
import { SwapIcon, TrashIcon } from '../components/PhotoControlIcons'
import { deleteEntry, narrationUrl, photoUrl, updateEntry } from '../lib/bookshelfClient'
import type { Entry } from '../lib/entryTypes'
import { TAG_OPTIONS } from '../lib/entryTypes'
import { requestNarration, requestNarrationTimings } from '../lib/storyClient'
import { useAudioNarration } from '../lib/useAudioNarration'

type Props = {
  // 表示する日記
  entry: Entry
  // 日付リストへの遷移
  onBackToDates: () => void
  // 本棚への遷移
  onBackToBookshelf: () => void
  // 削除が完了した後の処理
  onDeleted: () => void
}

// 開いている候補の種別
type OpenMenu = 'scene' | 'emotion' | null

// 物語文に混ざった文字列としての改行記号を除去する
function normalizeStoryText(text: string): string {
  return text.replace(/\\n/g, '').replace(/\/n/g, '')
}

export default function EntryDetailScreen({
  entry,
  onBackToDates,
  onBackToBookshelf,
  onDeleted,
}: Props) {
  // 編集中かどうか
  const [isEditing, setIsEditing] = useState(false)
  const [storyText, setStoryText] = useState(normalizeStoryText(entry.story_text))
  const [tags, setTags] = useState(entry.tags)
  const [photoPaths, setPhotoPaths] = useState(entry.photo_paths)
  // 差し替える写真
  const [photo, setPhoto] = useState<File | null>(null)
  // 差し替える写真のプレビューURL
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  // 写真を外す指定
  const [shouldClearPhoto, setShouldClearPhoto] = useState(false)
  // 開いている候補
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  // 候補の表示位置
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isConfirmVisible, setIsConfirmVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // 保存済みの音声のURL
  const [audioUrl, setAudioUrl] = useState<string | null>(
    entry.narration_path ? narrationUrl(entry.id) : null
  )
  // 表示中の物語文
  const [displayedStory, setDisplayedStory] = useState(normalizeStoryText(entry.story_text))
  // VOICEVOXから取得した文字ごとの発話タイミング
  const [narrationTimings, setNarrationTimings] = useState<
    import('../lib/storyClient').NarrationTiming[]
  >([])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const sceneButtonRef = useRef<HTMLButtonElement>(null)
  const emotionButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const { displayedLength, isPaused, isTyping, togglePause, reset } = useAudioNarration({
    audioUrl,
    storyText: displayedStory,
    isActive: !isEditing,
    audioRef,
    timings: narrationTimings,
  })

  // 音声と文字を同期するためのタイミングを取得する
  useEffect(() => {
    if (isEditing || !audioUrl || displayedStory.length === 0) {
      setNarrationTimings([])
      return
    }

    let cancelled = false

    // 新しい音声の再生前はいったんタイミングを空にする
    setNarrationTimings([])

    void requestNarrationTimings(displayedStory)
      .then((timings) => {
        if (cancelled) {
          return
        }

        setNarrationTimings(timings)
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        // タイミング取得に失敗した場合は、
        // useAudioNarration側で音声全体の時間を使って同期する
        setNarrationTimings([])
      })

    return () => {
      cancelled = true
    }
  }, [audioUrl, displayedStory, isEditing])

  // 選択中の写真の解除
  const clearPhotoPreview = useCallback(() => {
    setPhoto(null)
    setPhotoPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }

      return null
    })
  }, [])

  useEffect(() => {
    return () => {
      reset()
      clearPhotoPreview()
    }
  }, [clearPhotoPreview, reset])

  // 外側のクリックでの候補の閉じ込み
  useEffect(() => {
    if (openMenu === null) {
      return
    }

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node

      if (
        sceneButtonRef.current?.contains(target) ||
        emotionButtonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }

      setOpenMenu(null)
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenu])

  // 表示する写真のURL
  const displayedPhotoUrl = photoPreviewUrl
    ? photoPreviewUrl
    : shouldClearPhoto || photoPaths.length === 0
      ? null
      : photoUrl(entry.id, photoPaths[0])

  // 候補の開閉
  function toggleMenu(menu: Exclude<OpenMenu, null>, button: HTMLButtonElement | null) {
    if (openMenu === menu) {
      setOpenMenu(null)
      return
    }

    if (button) {
      const rect = button.getBoundingClientRect()

      setMenuPosition({ top: rect.bottom + 6, left: rect.left })
    }

    setOpenMenu(menu)
  }

  // シーンの選択
  function selectScene(scene: (typeof TAG_OPTIONS.シーン)[number]) {
    setTags({ ...tags, シーン: scene })
    setOpenMenu(null)
  }

  // きもちの選択と解除
  function toggleEmotion(emotion: (typeof TAG_OPTIONS.感情)[number]) {
    const selected = tags.感情.includes(emotion)

    // きもちは1つ以上必要
    if (selected && tags.感情.length === 1) {
      return
    }

    setTags({
      ...tags,
      感情: selected ? tags.感情.filter((item) => item !== emotion) : [...tags.感情, emotion],
    })
  }

  // 写真の選択
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]

    e.target.value = ''

    if (!file) {
      return
    }

    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl)
    }

    setPhoto(file)
    setPhotoPreviewUrl(URL.createObjectURL(file))
    setShouldClearPhoto(false)
  }

  // 写真の取り外し
  function handlePhotoRemove() {
    clearPhotoPreview()
    setShouldClearPhoto(true)
  }

  // 編集の開始
  function handleEditStart() {
    reset()
    setIsEditing(true)
  }

  // 編集の取り消し
  function handleEditCancel() {
    setStoryText(displayedStory)
    setTags(entry.tags)
    clearPhotoPreview()
    setShouldClearPhoto(false)
    setErrorMessage(null)
    setOpenMenu(null)
    setIsEditing(false)
  }

  // 変更の保存
  async function handleSave() {
    setIsSaving(true)
    setErrorMessage(null)

    try {
      const normalizedStoryText = normalizeStoryText(storyText)
      const isStoryChanged = normalizedStoryText !== displayedStory

      // 物語文を変えた場合の読み上げ音声の作り直し
      let narration: Blob | undefined = undefined

      if (isStoryChanged) {
        const audio = await requestNarration(normalizedStoryText)
        narration = new Blob([audio], { type: 'audio/wav' })
      }

      const updated = await updateEntry(entry.id, {
        storyText: isStoryChanged ? normalizedStoryText : undefined,
        tags: JSON.stringify(tags) !== JSON.stringify(entry.tags) ? tags : undefined,
        narration,
        photos: photo ? [photo] : [],
        clearPhotos: shouldClearPhoto,
      })

      const normalizedUpdatedStory = normalizeStoryText(updated.story_text)

      setStoryText(normalizedUpdatedStory)
      setPhotoPaths(updated.photo_paths)
      setDisplayedStory(normalizedUpdatedStory)
      clearPhotoPreview()
      setShouldClearPhoto(false)

      // 差し替えた音声の再取得
      if (narration) {
        setAudioUrl(`${narrationUrl(entry.id)}?t=${Date.now()}`)
      }

      setOpenMenu(null)
      setIsEditing(false)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSaving(false)
    }
  }

  // 日記の削除
  async function handleDelete() {
    setIsConfirmVisible(false)
    setIsDeleting(true)
    setErrorMessage(null)

    try {
      await deleteEntry(entry.id)
      onDeleted()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setIsDeleting(false)
    }
  }

  // 日付の表示
  const createdDate = new Date(entry.created_at)
  const createdLabel = `${createdDate.getFullYear()}年${createdDate.getMonth() + 1}月${createdDate.getDate()}日`

  return (
    <main className="story-screen">
      {errorMessage && <p className="story-error">{errorMessage}</p>}

      <audio ref={audioRef} src={audioUrl ?? undefined} preload="auto" autoPlay />

      <p className="book-outer-heading">{createdLabel}</p>

      <div className="story-open-stage entry-detail-stage">
        <PageTurningBook
          className="story-open-book"
          pageProgress={0}
          showLeftLines={false}
          showRightLines={false}
        />

        <div className="story-book-content">
          {/* 左ページ:物語文を表示 */}
          <div className="story-left-page">
            {isEditing ? (
              <textarea
                lang="ja"
                value={storyText}
                onChange={(e) => setStoryText(normalizeStoryText(e.target.value))}
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

          {/* 右ページ:写真とタグを表示 */}
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

                <button type="button" onClick={handlePhotoRemove} className="story-photo-control">
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

      {/* タグの選択候補 */}
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
            onClick={handleEditCancel}
            disabled={isSaving}
            className="font-body border-txt2 text-txt2 hover:bg-txt2 entry-detail-action cursor-pointer rounded-full border-2 py-2 text-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            やめる
          </button>

          <button
            type="button"
            onClick={handleSave}
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
              onClick={handleEditStart}
              className="font-body border-main text-main hover:bg-main cursor-pointer rounded-full border-2 px-6 py-2 text-sm transition-colors hover:text-white"
            >
              編集する
            </button>

            <button
              type="button"
              onClick={() => setIsConfirmVisible(true)}
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
          onConfirm={handleDelete}
          onCancel={() => setIsConfirmVisible(false)}
        />
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
