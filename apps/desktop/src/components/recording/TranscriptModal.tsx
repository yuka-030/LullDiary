// apps/desktop/src/components/recording/TranscriptModal.tsx
import { useEffect, useRef, useState } from 'react'

// 1文字を表示する間隔(ミリ秒)
const TYPING_INTERVAL_MS = 90

type Props = {
  // STTが返した認識結果
  text: string
  // 編集内容を確定して次に進む
  onConfirm: (text: string) => void
  // 確定せずに閉じる
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

  // 演出がまだ終わっていないかどうか
  const isTyping = displayedLength < text.length

  // 一文字ずつ表示する
  useEffect(() => {
    if (!isTyping) {
      return
    }

    const timer = setTimeout(() => {
      setDisplayedLength((length) => length + 1)
    }, TYPING_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [displayedLength, isTyping])

  // 演出の完了後、テキストエリアにフォーカスを当てる
  useEffect(() => {
    if (!isTyping) {
      textareaRef.current?.focus()
    }
  }, [isTyping])

  // 表示中の文字数を全体まで進める
  function skipTyping() {
    setDisplayedLength(text.length)
  }

  // EnterキーまたはSpaceキーで演出をスキップする
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
            // 演出中はタップまたはキー操作でスキップできる
            <div
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
            // 演出後は編集可能なテキストエリアに切り替わる
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
            className="font-body bg-bg2 text-txt2 hover:bg-txt2 cursor-pointer rounded-full px-6 py-2 transition-colors hover:text-white"
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
