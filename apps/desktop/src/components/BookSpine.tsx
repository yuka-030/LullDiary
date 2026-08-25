// apps/desktop/src/components/BookSpine.tsx
type Props = {
  // 背表紙に表示する月
  monthNumber: number
  // 本の高さの変化(0〜1)
  variant: number
  // 本を選んだときの処理
  onSelect: () => void
}

export default function BookSpine({ monthNumber, variant, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="book-spine"
      style={
        {
          '--spine-height': `${89 + variant * 4}%`,
        } as React.CSSProperties
      }
    >
      <span className="book-spine-band" />

      <span className="book-spine-label">
        <span className="book-spine-number">{monthNumber}</span>
        <span className="book-spine-unit">月</span>
      </span>

      <span className="book-spine-band" />
    </button>
  )
}
