// apps/desktop/src/screens/RecordingScreen.tsx
import { useState } from 'react'
import TranscriptModal from '../components/TranscriptModal'
import { useRecorder } from '../lib/useRecorder'
import StoryScreen from './StoryScreen'

type Props = {
  // ホーム画面への遷移
  onBack: () => void
}

export default function RecordingScreen({ onBack }: Props) {
  // 入力方法
  const [mode, setMode] = useState<'voice' | 'text'>('voice')
  // テキスト入力欄の内容
  const [inputText, setInputText] = useState('')
  // 確定済みの入力テキスト
  const [confirmedText, setConfirmedText] = useState<string | null>(null)
  // 確定した入力の入力方法
  const [confirmedMode, setConfirmedMode] = useState<'voice' | 'text'>('voice')
  const { status, start, stop, transcript, clearTranscript, errorMessage, level } = useRecorder()

  const isRecording = status === 'recording'
  const isProcessing = status === 'processing'
  // 送信ボタンの有効判定
  const canSubmitText = inputText.trim().length > 0

  // 声が大きいほど波紋が遠くまで広がる
  const rippleScale = 1.1 + level * 0.35

  // 録音の開始と停止の切り替え
  async function handleMicClick() {
    if (isRecording) {
      await stop()
    } else {
      await start()
    }
  }

  // 確定したテキストを保持し、生成結果画面へ遷移する
  function handleConfirm(text: string) {
    setConfirmedMode('voice')
    setConfirmedText(text)
    clearTranscript()
  }

  // 入力中のテキストの確定
  function handleTextSubmit() {
    if (!canSubmitText) {
      return
    }

    setConfirmedMode('text')
    setConfirmedText(inputText.trim())
  }

  // 入力方法の切り替え
  function toggleMode() {
    setMode(mode === 'voice' ? 'text' : 'voice')
  }

  // 保存が完了したら、記録画面の初期状態に戻す
  function handleSave() {
    setConfirmedText(null)
    setInputText('')
  }

  // 確定済みなら生成結果画面を表示
  if (confirmedText) {
    return <StoryScreen inputText={confirmedText} inputType={confirmedMode} onSave={handleSave} />
  }

  return (
    <main className="bg-bg flex min-h-screen w-full flex-col items-center justify-center gap-10 px-6 py-12">
      <p className="font-disp text-txt text-xl sm:text-2xl">今日は どんな１日だった？</p>

      {/* 入力領域 */}
      <div className="flex h-56 w-full max-w-md items-center justify-center">
        {mode === 'voice' ? (
          <div className="relative flex h-56 w-56 items-center justify-center">
            {/* 録音中の波紋 */}
            {isRecording && (
              <>
                <HeartShape
                  className="animate-ripple text-rec2 absolute inset-0 h-full w-full"
                  style={{ ['--ripple-scale' as string]: rippleScale }}
                />
                <HeartShape
                  className="animate-ripple text-rec2 absolute inset-0 h-full w-full"
                  style={{
                    ['--ripple-scale' as string]: rippleScale,
                    animationDelay: '2.5s',
                  }}
                />
              </>
            )}

            {/* 待機中の光 */}
            {!isRecording && (
              <HeartShape className="animate-glow-pulse text-glow absolute inset-0 h-full w-full" />
            )}

            {/* 録音ボタン */}
            <button
              type="button"
              aria-label={isRecording ? '録音を停止する' : '録音を開始する'}
              onClick={handleMicClick}
              disabled={isProcessing}
              className="relative h-full w-full cursor-pointer transition-transform hover:scale-105 disabled:opacity-60"
            >
              <HeartShape
                className={`absolute inset-0 h-full w-full transition-colors ${
                  isRecording ? 'text-rec' : 'text-main'
                }`}
              />
              {isRecording ? (
                <StopIcon className="absolute top-1/2 left-1/2 h-14 w-14 -translate-x-1/2 -translate-y-[55%] text-white" />
              ) : (
                <MicIcon className="absolute top-1/2 left-1/2 h-16 w-16 -translate-x-1/2 -translate-y-[55%] text-white" />
              )}
            </button>
          </div>
        ) : (
          // テキスト入力欄
          <textarea
            lang="ja"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="font-body border-bg2 text-txt placeholder:text-txt2 focus:border-main h-full w-full resize-none rounded-3xl border-2 bg-white/60 p-5 focus:outline-none"
            placeholder="今日あったことを書いてみてね"
          />
        )}
      </div>

      {/* 案内文と送信ボタンの領域 */}
      <div className="flex h-10 flex-col items-center justify-center gap-1">
        {mode === 'voice' ? (
          <>
            {/* 録音状態に応じた案内文 */}
            <p className="font-body text-txt2 text-sm">
              {isProcessing
                ? 'いま聞いているよ…'
                : isRecording
                  ? 'タップで録音終わるよ'
                  : 'タップして話しかけてね'}
            </p>

            {errorMessage && <p className="font-body text-sub text-sm">{errorMessage}</p>}
          </>
        ) : (
          // テキストの送信ボタン
          <button
            type="button"
            onClick={handleTextSubmit}
            disabled={!canSubmitText}
            className="font-body bg-glow hover:bg-main disabled:hover:bg-glow cursor-pointer rounded-full px-8 py-2 text-sm text-white [text-shadow:0_1px_2px_rgba(74,59,49,0.35)] transition-colors disabled:opacity-40"
          >
            書けたよ
          </button>
        )}
      </div>

      {/* 入力方法の切り替えボタン */}
      <button
        type="button"
        onClick={toggleMode}
        className="font-body border-sub text-sub hover:bg-sub flex cursor-pointer items-center gap-2 rounded-full border-2 px-6 py-2 transition-colors hover:text-white"
      >
        {mode === 'voice' ? <PencilIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
        {mode === 'voice' ? '文字で書く' : '声で話す'}
      </button>

      {/* ホーム画面への戻り */}
      <button
        type="button"
        onClick={onBack}
        className="font-body text-txt2 hover:text-txt cursor-pointer text-sm transition-colors"
      >
        もどる
      </button>

      {/* 音声入力の確認モーダル */}
      {transcript && (
        <TranscriptModal text={transcript} onConfirm={handleConfirm} onCancel={clearTranscript} />
      )}
    </main>
  )
}

// ハート型の図形
function HeartShape({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 92" className={className} style={style} aria-hidden="true">
      <path
        d="M46 88C38 82 20 68 10 55C3 45 0 38 0 28C0 12 12 2 26 2C40 2 48 12 50 19C52 12 60 2 74 2C88 2 100 12 100 28C100 38 97 45 90 55C80 68 62 82 54 88C51 90 49 90 46 88Z"
        fill="currentColor"
      />
    </svg>
  )
}

// マイクアイコン
function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth={1.8}
      />
      <path
        d="M19 11a7 7 0 0 1-14 0M12 18v3"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  )
}

// 停止アイコン
function StopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" />
    </svg>
  )
}

// 鉛筆アイコン
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 20h4L18.5 9.5a2.121 2.121 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </svg>
  )
}
