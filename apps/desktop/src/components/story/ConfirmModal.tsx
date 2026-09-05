// apps/desktop/src/components/story/ConfirmModal.tsx
type Props = {
  // 確認の見出し
  title: string
  // 確認の本文
  message: string
  // 実行ボタンの文言
  confirmLabel: string
  // 実行したときの処理
  onConfirm: () => void
  // 取り消したときの処理
  onCancel: () => void
}

export default function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <p className="confirm-modal-title">{title}</p>
        <p className="confirm-modal-message">{message}</p>

        <div className="confirm-modal-actions">
          <button type="button" onClick={onCancel} className="confirm-modal-cancel">
            やめる
          </button>
          <button type="button" onClick={onConfirm} className="confirm-modal-confirm">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
