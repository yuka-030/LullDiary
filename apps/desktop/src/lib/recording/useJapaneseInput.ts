// apps/desktop/src/lib/recording/useJapaneseInput.ts
import { invoke, isTauri } from '@tauri-apps/api/core'
import { useCallback, useRef } from 'react'

// 入力開始時の日本語入力への切り替え
export function useJapaneseInput() {
  const requested = useRef(false)

  return useCallback(() => {
    if (!isTauri() || requested.current) {
      return
    }

    requested.current = true

    void invoke<boolean>('enable_japanese_input')
      .then((sent) => {
        if (!sent) {
          requested.current = false
        }
      })
      .catch((error: unknown) => {
        requested.current = false
        console.warn('日本語入力への切り替えに失敗しました', error)
      })
  }, [])
}
