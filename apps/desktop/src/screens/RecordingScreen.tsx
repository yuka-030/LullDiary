// apps/desktop/src/screens/RecordingScreen.tsx
import TranscriptModal from '../components/TranscriptModal'
import { RECORDING_DOT_COUNT, useRecordingFlow } from '../lib/useRecordingFlow'
import StoryScreen from './StoryScreen'

type Props = {
  // ホーム画面への遷移
  onBack: () => void
  // 保存が完了した後の処理
  onSaved: () => void
}

export default function RecordingScreen({ onBack, onSaved }: Props) {
  const {
    mode,
    inputText,
    setInputText,
    confirmedText,
    confirmedMode,
    isRecording,
    isRecorded,
    isProcessing,
    canSubmitText,
    level,
    remainingDots,
    fadingDotOpacity,
    transcript,
    errorMessage,
    toggleRecording,
    retryRecording,
    transcribe,
    confirmTranscript,
    clearTranscript,
    submitText,
    toggleMode,
    backToHome,
    finishSave,
  } = useRecordingFlow({ onBack, onSaved })

  // 声での波紋の広がり
  const rippleScale = 1.1 + level * 0.35

  if (confirmedText) {
    return <StoryScreen inputText={confirmedText} inputType={confirmedMode} onSave={finishSave} />
  }

  return (
    <main className="bg-bg flex h-screen w-full flex-col items-center justify-center gap-6 px-6 py-8">
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
              onClick={toggleRecording}
              disabled={isProcessing || isRecorded}
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

      {/* 残り時間のドット */}
      <div className="flex h-2 items-center justify-center gap-2">
        {isRecording &&
          Array.from({ length: RECORDING_DOT_COUNT }, (_, index) => {
            const isFading = index === remainingDots - 1
            const isSpent = index >= remainingDots

            return (
              <span
                key={index}
                className="recording-dot"
                style={{ opacity: isSpent ? 0 : isFading ? fadingDotOpacity : 1 }}
              />
            )
          })}
      </div>

      {/* 案内文と操作ボタン */}
      <div className="flex h-10 flex-col items-center justify-center gap-1">
        {mode === 'voice' ? (
          isRecorded ? (
            // 録音後の操作ボタン
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={retryRecording}
                className="font-body border-sub text-sub hover:bg-sub cursor-pointer rounded-full border-2 px-6 py-2 text-sm transition-colors hover:text-white"
              >
                録り直す
              </button>

              <button
                type="button"
                onClick={transcribe}
                className="font-body bg-glow hover:bg-main cursor-pointer rounded-full px-8 py-2 text-sm text-white shadow-sm [text-shadow:0_1px_2px_rgba(74,59,49,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                作成する
              </button>
            </div>
          ) : (
            <>
              {/* 案内文 */}
              <p
                className={`font-body text-txt2 text-center text-sm ${isProcessing ? 'animate-text-fade' : ''}`}
              >
                {isProcessing
                  ? 'いま聞いているよ…'
                  : isRecording
                    ? 'タップで録音終わるよ'
                    : 'タップして話しかけてね'}
              </p>

              {!isProcessing && !isRecording && (
                <p className="font-body text-txt2 mt-1 text-xs">録音時間は3分です</p>
              )}

              {errorMessage && <p className="font-body text-sub text-sm">{errorMessage}</p>}
            </>
          )
        ) : (
          // テキストの送信ボタン
          <button
            type="button"
            onClick={submitText}
            disabled={!canSubmitText}
            className="font-body bg-glow hover:bg-main disabled:hover:bg-glow cursor-pointer rounded-full px-8 py-2 text-sm text-white shadow-sm [text-shadow:0_1px_2px_rgba(74,59,49,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-40 disabled:shadow-sm"
          >
            書けたよ
          </button>
        )}
      </div>

      {/* 入力方法の切り替えボタン */}
      <button
        type="button"
        onClick={toggleMode}
        disabled={isProcessing}
        className="font-body border-sub text-sub hover:bg-sub flex cursor-pointer items-center gap-2 rounded-full border-2 px-6 py-2 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {mode === 'voice' ? <PencilIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
        {mode === 'voice' ? '文字で書く' : '声で話す'}
      </button>

      {/* ホーム画面への遷移ボタン */}
      <button type="button" onClick={backToHome} className="back-link">
        ← ホームにもどる
      </button>

      {/* 音声入力の確認モーダル */}
      {transcript && (
        <TranscriptModal
          text={transcript}
          onConfirm={confirmTranscript}
          onCancel={clearTranscript}
        />
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
