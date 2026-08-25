// apps/desktop/src/lib/useRecordingFlow.ts
import { useCallback, useState } from 'react'
import { useRecorder } from './useRecorder'

export type InputMode = 'voice' | 'text'

type Options = {
  // ホーム画面への遷移
  onBack: () => void
  // 保存が完了した後の処理
  onSaved: () => void
}

export function useRecordingFlow({ onBack, onSaved }: Options) {
  // 入力方法
  const [mode, setMode] = useState<InputMode>('voice')
  // テキスト入力欄の内容
  const [inputText, setInputText] = useState('')
  // 確定済みの入力テキスト
  const [confirmedText, setConfirmedText] = useState<string | null>(null)
  // 確定した入力の入力方法
  const [confirmedMode, setConfirmedMode] = useState<InputMode>('voice')

  const { status, start, stop, cancel, transcript, clearTranscript, errorMessage, level } =
    useRecorder()

  const isRecording = status === 'recording'
  const isProcessing = status === 'processing'
  // 送信ボタンの有効判定
  const canSubmitText = inputText.trim().length > 0

  // 録音の開始と停止の切り替え
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stop()
    } else {
      await start()
    }
  }, [isRecording, start, stop])

  // 音声入力テキストの確定
  const confirmTranscript = useCallback(
    (text: string) => {
      setConfirmedMode('voice')
      setConfirmedText(text)
      clearTranscript()
    },
    [clearTranscript]
  )

  // 入力中のテキストの確定
  const submitText = useCallback(() => {
    if (!canSubmitText) {
      return
    }

    setConfirmedMode('text')
    setConfirmedText(inputText.trim())
  }, [canSubmitText, inputText])

  // 入力方法の切り替え
  const toggleMode = useCallback(async () => {
    await cancel()

    setMode((previous) => (previous === 'voice' ? 'text' : 'voice'))
  }, [cancel])

  // ホーム画面への遷移
  const backToHome = useCallback(async () => {
    await cancel()

    onBack()
  }, [cancel, onBack])

  // 保存後の画面の初期化
  const finishSave = useCallback(() => {
    setConfirmedText(null)
    setInputText('')
    onSaved()
  }, [onSaved])

  // 画面に渡す状態と操作
  return {
    mode,
    inputText,
    setInputText,
    confirmedText,
    confirmedMode,
    isRecording,
    isProcessing,
    canSubmitText,
    level,
    transcript,
    errorMessage,
    toggleRecording,
    confirmTranscript,
    clearTranscript,
    submitText,
    toggleMode,
    backToHome,
    finishSave,
  }
}
