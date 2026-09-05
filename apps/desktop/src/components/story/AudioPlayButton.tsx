// apps/desktop/src/components/story/AudioPlayButton.tsx
type Props = {
  // 停止中かどうか
  isPaused: boolean
  // 再生と停止の切り替え
  onToggle: () => void
}

export default function AudioPlayButton({ isPaused, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="font-body border-sub text-sub hover:bg-sub rounded-full border-2 px-6 py-2 text-sm transition-colors hover:text-white"
    >
      {isPaused ? '再生する' : '止める'}
    </button>
  )
}
