// apps/desktop/src/components/story/ConfirmModal.tsx
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

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
  const titleId = useId()
  const messageId = useId()
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  // 表示時のフォーカス移動と背景操作の抑止
  useEffect(() => {
    const overlay = overlayRef.current

    if (!overlay) {
      return
    }

    const previousFocus = document.activeElement
    const backgroundStates = new Map<HTMLElement, boolean>()

    cancelButtonRef.current?.focus()

    // 背景要素の操作抑止
    function disableBackground() {
      for (const element of document.body.children) {
        if (!(element instanceof HTMLElement) || element === overlay) {
          continue
        }

        if (!backgroundStates.has(element)) {
          backgroundStates.set(element, element.inert)
        }

        element.inert = true
      }
    }

    disableBackground()

    // 表示中に追加された背景要素の監視
    const observer = new MutationObserver(disableBackground)
    observer.observe(document.body, { childList: true })

    return () => {
      observer.disconnect()

      for (const [element, wasInert] of backgroundStates) {
        element.inert = wasInert
      }

      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus()
      }
    }
  }, [])

  // Escapeキーでの終了とTabキーのフォーカス制御
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCancel()
        return
      }

      const dialog = dialogRef.current

      if (event.key !== 'Tab' || !dialog) {
        return
      }

      const buttons = Array.from(
        dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
      ).filter((button) => button.tabIndex >= 0)

      const first = buttons[0]
      const last = buttons[buttons.length - 1]

      if (!first || !last) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const activeElement = document.activeElement
      const activeIndex = buttons.findIndex((button) => button === activeElement)

      if (activeIndex === -1) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
        return
      }

      if (event.shiftKey && activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [onCancel])

  return createPortal(
    <div ref={overlayRef} className="confirm-modal-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <p id={titleId} className="confirm-modal-title">
          {title}
        </p>
        <p id={messageId} className="confirm-modal-message">
          {message}
        </p>

        <div className="confirm-modal-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="confirm-modal-cancel"
          >
            やめる
          </button>
          <button type="button" onClick={onConfirm} className="confirm-modal-confirm">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
