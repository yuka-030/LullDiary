// apps/desktop/src/screens/RecordingScreen.tsx
import { useState } from 'react'
import TranscriptModal from '../components/TranscriptModal'
import { useRecorder } from '../lib/useRecorder'
import StoryScreen from './StoryScreen'

export default function RecordingScreen() {
  const [mode, setMode] = useState<'voice' | 'text'>('voice')
  // 確定済みテキスト。物語生成画面への遷移トリガーを兼ねる
  const [confirmedText, setConfirmedText] = useState<string | null>(null)
  const { status, start, stop, transcript, clearTranscript, errorMessage, level } = useRecorder()

  const isRecording = status === 'recording'
  const isProcessing = status === 'processing'

  // 声が大きいほど波紋が遠くまで広がる
  const rippleScale = 1.1 + level * 0.35

  async function handleMicClick() {
    if (isRecording) {
      await stop()
    } else {
      await start()
    }
  }

  // 確定したテキストを保持し、生成結果画面へ遷移する
  function handleConfirm(text: string) {
    setConfirmedText(text)
    clearTranscript()
  }

  // 保存が完了したら、記録画面の初期状態に戻す
  function handleSave() {
    setConfirmedText(null)
  }

  if (confirmedText) {
    return <StoryScreen inputText={confirmedText} onSave={handleSave} />
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center gap-10 bg-bg px-6 py-12">
      <p className="font-disp text-txt text-xl sm:text-2xl">今日は どんな１日だった？</p>

      {mode === 'voice' ? (
        <>
          <div className="relative flex h-56 w-56 items-center justify-center">
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

            {!isRecording && (
              <HeartShape className="animate-glow-pulse text-glow absolute inset-0 h-full w-full" />
            )}

            <button
              type="button"
              aria-label={isRecording ? '録音を停止する' : '録音を開始する'}
              onClick={handleMicClick}
              disabled={isProcessing}
              className="relative h-full w-full transition-transform hover:scale-105 disabled:opacity-60"
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
        <textarea
          className="font-body border-bg2 text-txt placeholder:text-txt2 focus:border-main h-44 w-full max-w-md rounded-3xl border-2 bg-white/60 p-5 focus:outline-none"
          placeholder="今日あったことを書いてみてね"
        />
      )}

      <button
        type="button"
        onClick={() => setMode(mode === 'voice' ? 'text' : 'voice')}
        className="font-body border-sub text-sub hover:bg-sub flex items-center gap-2 rounded-full border-2 px-6 py-2 transition-colors hover:text-white"
      >
        {mode === 'voice' ? <PencilIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
        {mode === 'voice' ? '文字で書く' : '声で話す'}
      </button>

      {transcript && (
        <TranscriptModal text={transcript} onConfirm={handleConfirm} onCancel={clearTranscript} />
      )}
    </main>
  )
}

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

function StopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" />
    </svg>
  )
}

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
