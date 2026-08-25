// apps/desktop/src/App.tsx
import { useState } from 'react'
import type { Entry } from './lib/entryTypes'
import BookshelfScreen from './screens/BookshelfScreen'
import EntryDetailScreen from './screens/EntryDetailScreen'
import HomeScreen from './screens/HomeScreen'
import RecordingScreen from './screens/RecordingScreen'

type Screen = 'home' | 'recording' | 'bookshelf' | 'detail'

function App() {
  // 表示中の画面
  const [screen, setScreen] = useState<Screen>('home')
  // 詳細画面で開いている日記
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  // 本棚で開いていた月(YYYY-MM)
  const [openedMonth, setOpenedMonth] = useState<string | undefined>(undefined)
  // 本棚の再取得を促す値
  const [bookshelfKey, setBookshelfKey] = useState(0)

  // 日付リストを開いた状態で本棚へ戻る
  function handleBackToDates() {
    setSelectedEntry(null)
    setBookshelfKey((key) => key + 1)
    setScreen('bookshelf')
  }

  // 本棚へ戻る
  function handleBackToBookshelf() {
    setSelectedEntry(null)
    setOpenedMonth(undefined)
    setBookshelfKey((key) => key + 1)
    setScreen('bookshelf')
  }

  if (screen === 'recording') {
    return (
      <RecordingScreen
        onBack={() => setScreen('home')}
        onSaved={() => {
          setOpenedMonth(undefined)
          setBookshelfKey((key) => key + 1)
          setScreen('bookshelf')
        }}
      />
    )
  }

  if (screen === 'detail' && selectedEntry) {
    return (
      <EntryDetailScreen
        entry={selectedEntry}
        onBackToDates={handleBackToDates}
        onBackToBookshelf={handleBackToBookshelf}
        onDeleted={handleBackToDates}
      />
    )
  }

  if (screen === 'bookshelf') {
    return (
      <BookshelfScreen
        key={bookshelfKey}
        initialMonth={openedMonth}
        onBack={() => setScreen('home')}
        onSelectEntry={(entry, month) => {
          setSelectedEntry(entry)
          setOpenedMonth(month)
          setScreen('detail')
        }}
      />
    )
  }

  return (
    <HomeScreen
      onStartRecording={() => setScreen('recording')}
      onOpenBookshelf={() => {
        setOpenedMonth(undefined)
        setScreen('bookshelf')
      }}
    />
  )
}

export default App
