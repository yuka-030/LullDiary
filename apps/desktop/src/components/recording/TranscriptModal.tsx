// apps/desktop/src/components/recording/TranscriptModal.tsx
import { useEffect, useRef, useState } from 'react'

// 1文字を表示する間隔(ミリ秒)
const TYPING_INTERVAL_MS = 90

type Props = {
  // STTが返した認識結果
  text: string
  // 編集内容の確定と次の処理への移行
  onConfirm: (text: string) => void
  // 未確定でのモーダルの終了
  onCancel: () => void
}

// 認識結果を確認・修正するモーダル
// 開発中の精度確認用で、実用化時には削除する想定
export default function TranscriptModal({ text, onConfirm, onCancel }: Props) {
  // 表示済みの文字数
  const [displayedLength, setDisplayedLength] = useState(0)
  // 編集中のテキスト
  const [editedText, setEditedText] = useState(text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const skipRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // 文字表示の演出中フラグ
  const isTyping = displayedLength < text.length

  // 一文字ずつの表示
  useEffect(() => {
    if (!isTyping) {
      return
    }

    const timer = setTimeout(() => {
      setDisplayedLength((length) => length + 1)
    }, TYPING_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [displayedLength, isTyping])

  // 演出完了後のテキストエリアへのフォーカス移動
  useEffect(() => {
    if (!isTyping) {
      textareaRef.current?.focus()
    }
  }, [isTyping])

  // 表示時のモーダル内へのフォーカス移動
  useEffect(() => {
    skipRef.current?.focus()
  }, [])

  // Escapeキーでの終了とTabキーのフォーカス制御
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button, [href], textarea, [tabindex]')
      ).filter((element) => !element.matches(':disabled') && element.tabIndex >= 0)

      if (focusable.length === 0) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  // 全文表示への切り替え
  function skipTyping() {
    setDisplayedLength(text.length)
  }

  // Enterキー・Spaceキーでの演出のスキップ
  function handleSkipKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      skipTyping()
    }
  }

  // 紙の罫線
  const paperStyle = {
    backgroundImage:
      'repeating-linear-gradient(to bottom, transparent, transparent 31px, rgba(140, 119, 104, 0.18) 31px, rgba(140, 119, 104, 0.18) 32px)',
    lineHeight: '32px',
  }

  return (
    <div
      ref={dialogRef}
      className="bg-txt/30 fixed inset-0 z-50 flex items-center justify-center px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="話した内容の確認"
    >
      <div className="bg-bg w-full max-w-md rounded-3xl p-8 shadow-2xl">
        <p className="font-disp text-txt mb-5 text-lg">こんなふうに聞こえたよ</p>

        {/* 紙を模した領域 */}
        <div className="rounded-2xl bg-[#fffdf8] p-5 shadow-inner">
          {isTyping ? (
            // 演出のスキップ用領域
            <div
              ref={skipRef}
              role="button"
              tabIndex={0}
              onClick={skipTyping}
              onKeyDown={handleSkipKeyDown}
              style={paperStyle}
              className="font-body text-txt h-40 w-full cursor-pointer overflow-hidden"
            >
              {text.slice(0, displayedLength)}
              <span className="bg-txt2 ml-0.5 inline-block h-4 w-0.5 animate-pulse align-middle" />
            </div>
          ) : (
            // 演出完了後の編集用テキストエリア
            <textarea
              ref={textareaRef}
              lang="ja"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              style={paperStyle}
              className="font-body text-txt h-40 w-full resize-none bg-transparent focus:outline-none"
              aria-label="認識結果"
            />
          )}
        </div>

        <p className="font-body text-txt2 mt-3 text-xs">
          {isTyping ? 'タップで全部表示するよ' : 'ちがうところがあったら直してね'}
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="font-body bg-white/20 text-txt2 hover:bg-txt2 cursor-pointer rounded-full px-6 py-2 transition-colors hover:text-white"
          >
            やめる
          </button>
          <button
            type="button"
            onClick={() => onConfirm(editedText)}
            disabled={isTyping || editedText.trim().length === 0}
            className="font-body bg-glow hover:bg-main disabled:hover:bg-glow cursor-pointer rounded-full px-6 py-2 text-white [text-shadow:0_1px_2px_rgba(74,59,49,0.35)] transition-colors disabled:opacity-40"
          >
            物語にする
          </button>
        </div>
      </div>
    </div>
  )
}
