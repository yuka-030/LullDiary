// apps/desktop/src/components/shared/PhotoIcon.tsx

// 写真アイコン
export default function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth={1.5} />
      <circle cx="8.5" cy="10" r="1.5" stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M21 15l-5-5-9 9"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
