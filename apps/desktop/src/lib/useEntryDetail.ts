// apps/desktop/src/lib/useEntryDetail.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteEntry, narrationUrl, photoUrl, updateEntry } from './bookshelfClient'
import type { Entry } from './entryTypes'
import { TAG_OPTIONS } from './entryTypes'
import { requestNarration, requestNarrationTimings, type NarrationTiming } from './storyClient'
import { useAudioNarration } from './useAudioNarration'

// 開いている候補の種別
export type OpenMenu = 'scene' | 'emotion' | null

type Options = {
  // 表示する日記
  entry: Entry
  // 削除が完了した後の処理
  onDeleted: () => void
}

// 物語文に混ざった文字列としての改行記号の除去
function normalizeStoryText(text: string): string {
  return text.replace(/\\n/g, '').replace(/\/n/g, '')
}

export function useEntryDetail({ entry, onDeleted }: Options) {
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
  // 文字ごとの発話タイミング
  const [narrationTimings, setNarrationTimings] = useState<NarrationTiming[]>([])

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

  // 発話タイミングの取得
  useEffect(() => {
    if (isEditing || !audioUrl || displayedStory.length === 0) {
      setNarrationTimings([])
      return
    }

    let cancelled = false

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
  const toggleMenu = useCallback(
    (menu: Exclude<OpenMenu, null>, button: HTMLButtonElement | null) => {
      if (openMenu === menu) {
        setOpenMenu(null)
        return
      }

      if (button) {
        const rect = button.getBoundingClientRect()

        setMenuPosition({ top: rect.bottom + 6, left: rect.left })
      }

      setOpenMenu(menu)
    },
    [openMenu]
  )

  // シーンの選択
  const selectScene = useCallback((scene: (typeof TAG_OPTIONS.シーン)[number]) => {
    setTags((previous) => ({ ...previous, シーン: scene }))
    setOpenMenu(null)
  }, [])

  // きもちの選択と解除
  const toggleEmotion = useCallback((emotion: (typeof TAG_OPTIONS.感情)[number]) => {
    setTags((previous) => {
      const selected = previous.感情.includes(emotion)

      // きもちは1つ以上必要
      if (selected && previous.感情.length === 1) {
        return previous
      }

      return {
        ...previous,
        感情: selected
          ? previous.感情.filter((item) => item !== emotion)
          : [...previous.感情, emotion],
      }
    })
  }, [])

  // 写真の選択
  const selectPhoto = useCallback(
    (file: File) => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl)
      }

      setPhoto(file)
      setPhotoPreviewUrl(URL.createObjectURL(file))
      setShouldClearPhoto(false)
    },
    [photoPreviewUrl]
  )

  // 写真の取り外し
  const removePhoto = useCallback(() => {
    clearPhotoPreview()
    setShouldClearPhoto(true)
  }, [clearPhotoPreview])

  // 編集の開始
  const startEditing = useCallback(() => {
    reset()
    setIsEditing(true)
  }, [reset])

  // 編集の取り消し
  const cancelEditing = useCallback(() => {
    setStoryText(displayedStory)
    setTags(entry.tags)
    clearPhotoPreview()
    setShouldClearPhoto(false)
    setErrorMessage(null)
    setOpenMenu(null)
    setIsEditing(false)
  }, [clearPhotoPreview, displayedStory, entry.tags])

  // 物語文の書き換え
  const changeStoryText = useCallback((text: string) => {
    setStoryText(normalizeStoryText(text))
  }, [])

  // 変更の保存
  const save = useCallback(async () => {
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
  }, [
    clearPhotoPreview,
    displayedStory,
    entry.id,
    entry.tags,
    photo,
    shouldClearPhoto,
    storyText,
    tags,
  ])

  // 削除の確認の表示
  const showDeleteConfirm = useCallback(() => {
    setIsConfirmVisible(true)
  }, [])

  // 削除の確認の取り消し
  const cancelDelete = useCallback(() => {
    setIsConfirmVisible(false)
  }, [])

  // 日記の削除
  const remove = useCallback(async () => {
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
  }, [entry.id, onDeleted])

  // 日付の表示
  const createdDate = new Date(entry.created_at)
  const createdLabel = `${createdDate.getFullYear()}年${createdDate.getMonth() + 1}月${createdDate.getDate()}日`

  // 画面に渡す状態と操作
  return {
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
  }
}
