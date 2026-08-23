// apps/desktop/src/App.tsx
import { useState } from 'react'
import BookshelfScreen from './screens/BookshelfScreen'
import HomeScreen from './screens/HomeScreen'
import RecordingScreen from './screens/RecordingScreen'

type Screen = 'home' | 'recording' | 'bookshelf'

function App() {
  // 表示中の画面
  const [screen, setScreen] = useState<Screen>('home')

  if (screen === 'recording') {
    return <RecordingScreen onBack={() => setScreen('home')} />
  }

  if (screen === 'bookshelf') {
    return <BookshelfScreen onBack={() => setScreen('home')} />
  }

  return (
    <HomeScreen
      onStartRecording={() => setScreen('recording')}
      onOpenBookshelf={() => setScreen('bookshelf')}
    />
  )
}

export default App
