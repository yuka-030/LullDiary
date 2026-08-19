// apps/desktop/src/components/BookOpen.tsx

type Props = {
  // 外側に付与するクラス名
  className?: string
}

export default function BookOpen({ className }: Props) {
  return (
    <svg viewBox="0 0 1200 760" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="open-book-cover" x1="0" x2="1">
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
        fill="url(#open-book-cover)"
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

      {/* 左ページの縁取り */}
      <path
        d="
          M78 102
          Q260 55 575 111
          L575 636
          Q270 688 78 650
          Z
        "
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-txt2"
        opacity="0.12"
      />

      {/* 右ページの縁取り */}
      <path
        d="
          M625 111
          Q940 55 1122 102
          L1122 650
          Q930 688 625 636
          Z
        "
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-txt2"
        opacity="0.12"
      />

      {/* 綴じ目の谷 */}
      <path
        d="
          M575 110
          Q600 101 625 110
          L625 636
          Q600 647 575 636
          Z
        "
        className="fill-bg2"
        opacity="0.7"
      />

      {/* 綴じ目の影 */}
      <path
        d="
          M591 108
          Q600 105 609 108
          L609 640
          Q600 644 591 640
          Z
        "
        className="fill-txt2"
        opacity="0.13"
      />

      {/* 左ページ下端の陰影 */}
      <path
        d="
          M80 650
          Q270 690 575 636
        "
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="text-txt2"
        opacity="0.14"
      />

      {/* 右ページ下端の陰影 */}
      <path
        d="
          M625 636
          Q930 690 1120 650
        "
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="text-txt2"
        opacity="0.14"
      />
    </svg>
  )
}
