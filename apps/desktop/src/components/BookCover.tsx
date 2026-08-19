// apps/desktop/src/components/BookCover.tsx

type Props = {
  // 外側に付与するクラス名
  className?: string
  // 表紙が開く進行度(0〜1)
  progress?: number
}

export default function BookCover({ className, progress = 0 }: Props) {
  const clampedProgress = Math.max(0, Math.min(progress, 1))

  return (
    <div
      className={`book-cover-wrap ${className ?? ''}`}
      style={
        {
          '--cover-progress': clampedProgress,
        } as React.CSSProperties
      }
    >
      {/* 背表紙 */}
      <div className="book-cover-spine" />

      {/* 表紙下のページ */}
      <div className="book-cover-pages">
        <div className="book-cover-page book-cover-page-1" />
        <div className="book-cover-page book-cover-page-2" />
        <div className="book-cover-page book-cover-page-3" />
      </div>

      {/* 表紙本体 */}
      <div className="book-cover-body">
        <div className="book-cover-face">
          <div className="book-cover-title-plate">
            <div className="book-cover-title">LullDiary</div>
          </div>
        </div>
      </div>
    </div>
  )
}
