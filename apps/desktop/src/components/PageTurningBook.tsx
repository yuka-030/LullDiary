// apps/desktop/src/components/PageTurningBook.tsx

type Props = {
  // 外側に付与するクラス名
  className?: string
  // ページがめくれる進行度(0〜1)
  pageProgress: number
  // 左ページの罫線を表示するかどうか
  showLeftLines?: boolean
}

export default function PageTurningBook({ className, pageProgress, showLeftLines = true }: Props) {
  const progress = Math.max(0, Math.min(pageProgress, 1))

  return (
    <div className={`page-turning-book ${className ?? ''}`}>
      <div className="page-turning-book-shadow" />

      <BookBase />

      <PageStack side="left" />
      <PageStack side="right" />

      <div className="page-turning-surface">
        <PageSheet side="left" showLines={showLeftLines} />
        <PageSheet side="right" />

        <div
          className="turning-page"
          style={{
            transform: `rotateY(${-180 * progress}deg)`,
          }}
        >
          <PageSheet side="right" />

          <div className="turning-page-back">
            <PageSheet side="left" showLines={showLeftLines} />
          </div>
        </div>
      </div>
    </div>
  )
}

// 本の外郭と表紙の形
function BookBase() {
  return (
    <svg
      className="page-turning-base"
      viewBox="0 0 1200 760"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="book-cover-gradient" x1="0" x2="1">
          <stop offset="0" className="book-gradient-left" />
          <stop offset="0.5" className="book-gradient-center" />
          <stop offset="1" className="book-gradient-right" />
        </linearGradient>
      </defs>

      {/* 表紙全体の輪郭 */}
      <path
        d="
          M54 88
          Q250 34 590 96
          Q950 34 1146 88
          L1146 670
          Q950 726 600 666
          Q250 726 54 670
          Z
        "
        fill="url(#book-cover-gradient)"
      />

      {/* 左ページの下地 */}
      <path
        d="
          M78 102
          Q260 55 575 111
          L575 636
          Q270 688 78 650
          Z
        "
        className="fill-bg"
      />

      {/* 右ページの下地 */}
      <path
        d="
          M625 111
          Q940 55 1122 102
          L1122 650
          Q930 688 625 636
          Z
        "
        className="fill-bg"
      />

      {/* 綴じ目の谷 */}
      <path
        d="
          M575 106
          Q600 98 625 106
          L625 640
          Q600 649 575 640
          Z
        "
        className="fill-bg2"
        opacity="0.7"
      />

      {/* 綴じ目の影 */}
      <path
        d="
          M590 102
          Q600 98 610 102
          L610 642
          Q600 646 590 642
          Z
        "
        className="fill-txt2"
        opacity="0.12"
      />
    </svg>
  )
}

// 左右それぞれの、ページが重なった厚みの層
function PageStack({ side }: { side: 'left' | 'right' }) {
  const pages = [0, 1, 2, 3, 4]

  return (
    <div className={`page-stack page-stack-${side}`}>
      {pages.map((page) => (
        <div
          key={page}
          className="page-stack-sheet"
          style={{
            transform: side === 'left' ? `translateX(${-page * 4}px)` : `translateX(${page * 4}px)`,
          }}
        />
      ))}
    </div>
  )
}

// 1枚のページの見た目
function PageSheet({
  side,
  showLines = true,
}: {
  side: 'left' | 'right'
  // 罫線の有無
  showLines?: boolean
}) {
  return (
    <div className={`page-sheet page-sheet-${side}`}>
      <div className="page-sheet-inner">{showLines && <div className="page-lines" />}</div>
    </div>
  )
}
