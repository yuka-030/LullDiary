// apps/desktop/src/screens/BookshelfScreen.tsx
type Props = {
  // ホーム画面への遷移
  onBack: () => void
}

export default function BookshelfScreen({ onBack }: Props) {
  return (
    <main className="bg-bg flex min-h-screen w-full flex-col items-center justify-center gap-10 px-6 py-12">
      <p className="font-disp text-txt text-xl sm:text-2xl">ほんだな</p>

      <button
        type="button"
        onClick={onBack}
        className="font-body border-txt2 text-txt2 hover:bg-txt2 cursor-pointer rounded-full border-2 px-6 py-2 transition-colors hover:text-white"
      >
        もどる
      </button>
    </main>
  )
}
