// apps/desktop/src/lib/story/useStoryScreen.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { createEntry } from '../shared/entryClient'
import { requestNarrationTimings, type NarrationTiming } from './storyClient'
import { useAudioNarration } from './useAudioNarration'
import { useStory, type InputType } from './useStory'

export type StoryStage = 'cover' | 'turning' | 'open'

// 表紙を消すまでの時間
const COVER_HIDE_MS = 1200

// 閉じた本を表示する時間
const COVER_SHOW_MS = 2000

// 表紙が開くまでの時間
const COVER_OPEN_MS = 2500

// ページめくり1周の時間
const PAGE_TURN_MS = 2400

type Options = {
  // 記録画面で確定した入力テキスト
  inputText: string
  // 入力方法
  inputType: InputType
  // 保存が完了した後の処理
  onSave: () => void
}

export function useStoryScreen({ inputText, inputType, onSave }: Options) {
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
  // 文字ごとの発話タイミング
  const [narrationTimings, setNarrationTimings] = useState<NarrationTiming[]>([])

  const coverTimerRef = useRef<number | null>(null)
  const coverHideTimerRef = useRef<number | null>(null)
  const pageTimerRef = useRef<number | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  // 初回表示時の自動生成を一度だけ実行するための入力値
  const generationInputRef = useRef<string | null>(null)

  // 読み上げ音声の成否が決着してから見開きへ切り替える
  const isReady = status === 'ready' && narrationStatus !== 'generating'

  const { displayedLength, isPaused, isTyping, togglePause, reset } = useAudioNarration({
    audioUrl,
    storyText,
    isActive: stage === 'open',
    audioRef,
    timings: narrationTimings,
  })

  // 発話タイミングの取得
  useEffect(() => {
    if (!audioUrl || storyText.length === 0) {
      setNarrationTimings([])
      return
    }

    let cancelled = false

    setNarrationTimings([])

    void requestNarrationTimings(storyText)
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
  }, [audioUrl, storyText])

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
    if (generationInputRef.current === inputText) {
      return
    }

    generationInputRef.current = inputText
    startGeneration()

    return () => {
      clearTimers()
      reset()
      clearPhoto()
    }
  }, [clearPhoto, clearTimers, inputText, reset, startGeneration])

  // 閉じた本を表示してから表紙を開く
  useEffect(() => {
    if (stage !== 'cover') {
      return
    }

    coverTimerRef.current = window.setTimeout(() => {
      setCoverProgress(1)

      window.setTimeout(() => {
        setStage('turning')
      }, COVER_OPEN_MS)
    }, COVER_SHOW_MS)

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

    let progress = 0

    setPageProgress(0)

    pageTimerRef.current = window.setInterval(() => {
      progress += 0.1

      if (progress >= 1) {
        progress = 0
      }

      setPageProgress(progress)
    }, PAGE_TURN_MS / 10)

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
  const selectPhoto = useCallback(
    (file: File) => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl)
      }

      setPhoto(file)
      setPhotoUrl(URL.createObjectURL(file))
    },
    [photoUrl]
  )

  // 日記の保存
  const save = useCallback(async () => {
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
  }, [inputText, inputType, narrationBlobRef, onSave, photo, storyText, tags])

  // 画面に渡す状態と操作
  return {
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
  }
}
