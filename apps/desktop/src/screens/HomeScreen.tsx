// apps/desktop/src/screens/HomeScreen.tsx
type Props = {
  // 記録画面への遷移
  onStartRecording: () => void
  // 本棚画面への遷移
  onOpenBookshelf: () => void
}

export default function HomeScreen({ onStartRecording, onOpenBookshelf }: Props) {
  return (
    <main className="bg-bg flex min-h-screen w-full flex-col items-center justify-center gap-14 px-6 py-12">
      <div className="flex flex-col items-center gap-4">
        <img src="/LullDiary_logo.png" alt="LullDiary" className="w-64 max-w-full sm:w-80" />

        <p className="font-body text-txt2 text-sm sm:text-base">あなたの声が物語になる日記</p>
      </div>

      <div className="flex items-start justify-center gap-10 sm:gap-16">
        {/* ボタン:物語をつくる */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            aria-label="物語をつくる"
            onClick={onStartRecording}
            className="bg-bg2 hover:bg-glow/30 relative flex h-44 w-44 cursor-pointer items-center justify-center rounded-full transition-colors sm:h-56 sm:w-56"
          >
            <BookPenShape className="text-main h-32 w-32 sm:h-40 sm:w-40" />
          </button>

          <p className="font-body text-txt2 text-sm">物語をつくる</p>
        </div>

        {/* ボタン:本棚を見る */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            aria-label="本棚を見る"
            onClick={onOpenBookshelf}
            className="bg-bg2 hover:bg-glow/30 relative flex h-44 w-44 cursor-pointer items-center justify-center rounded-full transition-colors sm:h-56 sm:w-56"
          >
            <BookshelfShape className="text-sub h-32 w-32 sm:h-40 sm:w-40" />
          </button>

          <p className="font-body text-txt2 text-sm">本棚を見る</p>
        </div>
      </div>
    </main>
  )
}

// 見開きの本と鉛筆の図形
function BookPenShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {/* 左のページ */}
      <path
        d="M50 30C42 23 30 20 16 21C13 21 11 23 11 26V70C11 73 13 75 16 75C30 74 42 76 50 82V30Z"
        fill="currentColor"
      />
      {/* 右のページ */}
      <path
        d="M50 30C58 23 70 20 84 21C87 21 89 23 89 26V70C89 73 87 75 84 75C70 74 58 76 50 82V30Z"
        fill="currentColor"
        opacity="0.7"
      />
      {/* 鉛筆 */}
      <path
        d="M60 72L56 86L69 81L88 61C91 58 91 53 88 50C85 47 80 47 77 50L60 72Z"
        fill="currentColor"
      />
    </svg>
  )
}

// 棚に本が並んだ図形
function BookshelfShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {/* 上段の本 */}
      <path d="M24 28H31C32 28 33 29 33 30V50H22V30C22 29 23 28 24 28Z" fill="currentColor" />
      <path d="M24 33H31V36H24V33Z" fill="currentColor" opacity="0.35" />

      <path
        d="M36 34H42C43 34 44 35 44 36V50H34V36C34 35 35 34 36 34Z"
        fill="currentColor"
        opacity="0.6"
      />

      <path d="M48 30H55C56 30 57 31 57 32V50H46V32C46 31 47 30 48 30Z" fill="currentColor" />
      <path d="M48 35H55V38H48V35Z" fill="currentColor" opacity="0.35" />

      <path d="M63 34L70 32L76 50H66L63 34Z" fill="currentColor" opacity="0.6" />

      {/* 下段の本 */}
      <path
        d="M24 67H30C31 67 32 68 32 69V86H22V69C22 68 23 67 24 67Z"
        fill="currentColor"
        opacity="0.6"
      />

      <path d="M35 63H42C43 63 44 64 44 65V86H33V65C33 64 34 63 35 63Z" fill="currentColor" />
      <path d="M35 68H42V71H35V68Z" fill="currentColor" opacity="0.35" />

      <path
        d="M47 69H53C54 69 55 70 55 71V86H45V71C45 70 46 69 47 69Z"
        fill="currentColor"
        opacity="0.6"
      />

      <path d="M58 64H65C66 64 67 65 67 66V86H56V66C56 65 57 64 58 64Z" fill="currentColor" />
      <path d="M58 69H65V72H58V69Z" fill="currentColor" opacity="0.35" />

      <path
        d="M70 71H76C77 71 78 72 78 73V86H68V73C68 72 69 71 70 71Z"
        fill="currentColor"
        opacity="0.6"
      />

      {/* 棚の外枠 */}
      <rect
        x="16.5"
        y="16.5"
        width="67"
        height="72"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth={5}
      />

      {/* 中段の棚板 */}
      <path d="M19 52.5H81" stroke="currentColor" strokeWidth={5} strokeLinecap="round" />
    </svg>
  )
}
