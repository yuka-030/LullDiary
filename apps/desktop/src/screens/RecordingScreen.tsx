// apps/desktop/src/screens/RecordingScreen.tsx
import { useState } from 'react'
import { useRecorder } from '../lib/useRecorder'

export default function RecordingScreen() {
  const [mode, setMode] = useState<'voice' | 'text'>('voice')
  const { status, start, stop, lastSavedPath, errorMessage } = useRecorder()

  const isRecording = status === 'recording'
  const isSaving = status === 'saving'

  async function handleMicClick() {
    if (isRecording) {
      await stop()
    } else {
      await start()
    }
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center gap-10 bg-bg px-6 py-12">
      <p className="font-disp text-xl text-txt sm:text-2xl">今日は どんな一日だった?</p>

      {mode === 'voice' ? (
        <>
          <button
            type="button"
            aria-label={isRecording ? '録音を停止する' : '録音を開始する'}
            onClick={handleMicClick}
            disabled={isSaving}
            className={`relative flex h-44 w-44 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-glow motion-reduce:animate-none disabled:opacity-60 ${
              isRecording ? 'bg-secondary animate-pulse' : 'bg-main animate-breathe'
            }`}
          >
            <MicIcon className="h-16 w-16" />
          </button>

          <p className="font-body text-sm text-txt2">
            {isSaving
              ? '保存しているよ…'
              : isRecording
                ? 'タップして録音を終える'
                : 'タップして話しかけてね'}
          </p>

          {errorMessage && <p className="font-body text-sm text-secondary">{errorMessage}</p>}

          {lastSavedPath && <p className="font-body text-xs text-txt2">保存先: {lastSavedPath}</p>}
        </>
      ) : (
        <textarea
          className="font-body h-44 w-full max-w-md rounded-3xl border-2 border-bg2 bg-white/60 p-5 text-txt placeholder:text-txt2 focus:border-main focus:outline-none"
          placeholder="今日あったことを書いてみてね"
        />
      )}

      <button
        type="button"
        onClick={() => setMode(mode === 'voice' ? 'text' : 'voice')}
        className="font-body flex items-center gap-2 rounded-full border-2 border-sub px-6 py-2 text-sub transition-colors hover:bg-sub hover:text-white"
      >
        {mode === 'voice' ? <PencilIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
        {mode === 'voice' ? '文字で書く' : '声で話す'}
      </button>
    </main>
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
