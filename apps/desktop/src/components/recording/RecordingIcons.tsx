// apps/desktop/src/components/recording/RecordingIcons.tsx

// ハート型の図形
export function HeartShape({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
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
export function MicIcon({ className }: { className?: string }) {
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
export function StopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" />
    </svg>
  )
}

// 鉛筆アイコン
export function PencilIcon({ className }: { className?: string }) {
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
