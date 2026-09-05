// apps/desktop/src/lib/recording/useRecordingFlow.test.ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { useRecordingFlow } from './useRecordingFlow'

// マイクのトラックの停止
let stopTrack: ReturnType<typeof mock>
// AudioContextの終了
let closeAudioContext: ReturnType<typeof mock>
// 動いているタイマーの処理
let intervalHandlers: Map<number, () => void>
// 次に払い出すタイマーID
let nextIntervalId: number

// 差し替え前のグローバル
const originalMediaDevices = navigator.mediaDevices
const originalAudioContext = globalThis.AudioContext
const originalSetInterval = window.setInterval
const originalClearInterval = window.clearInterval

beforeEach(() => {
  stopTrack = mock(() => {})
  closeAudioContext = mock(() => Promise.resolve())
  intervalHandlers = new Map()
  nextIntervalId = 1

  // マイクの差し替え
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => ({
        getTracks: () => [{ stop: stopTrack }],
      }),
    },
  })

  // 音声処理の差し替え
  class FakeAudioContext {
    sampleRate = 16000
    state = 'running'
    destination = {}

    createMediaStreamSource() {
      return { connect: () => {}, disconnect: () => {} }
    }

    createScriptProcessor() {
      return { connect: () => {}, disconnect: () => {}, onaudioprocess: null }
    }

    close = closeAudioContext
  }

  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: FakeAudioContext,
  })

  // 経過時間のタイマーの差し替え
  Object.defineProperty(window, 'setInterval', {
    configurable: true,
    value: (handler: () => void) => {
      const id = nextIntervalId

      nextIntervalId += 1
      intervalHandlers.set(id, handler)

      return id
    },
  })

  Object.defineProperty(window, 'clearInterval', {
    configurable: true,
    value: (id: number) => {
      intervalHandlers.delete(id)
    },
  })
})

// 差し替えたグローバルの復元
afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: originalMediaDevices,
  })

  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: originalAudioContext,
  })

  Object.defineProperty(window, 'setInterval', {
    configurable: true,
    value: originalSetInterval,
  })

  Object.defineProperty(window, 'clearInterval', {
    configurable: true,
    value: originalClearInterval,
  })
})

// 指定した秒数だけ経過させる
async function advanceSeconds(seconds: number) {
  for (let count = 0; count < seconds; count += 1) {
    const handlers = [...intervalHandlers.values()]

    if (handlers.length === 0) {
      return
    }

    await act(async () => {
      handlers.forEach((handler) => handler())
    })
  }
}

describe('useRecordingFlow', () => {
  test('録音を止めると作成と録り直しを選べる', async () => {
    const { result } = renderHook(() => useRecordingFlow({ onBack: () => {}, onSaved: () => {} }))

    // 録音の開始
    await act(async () => {
      await result.current.toggleRecording()
    })

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true)
    })

    // 録音の停止
    await act(async () => {
      await result.current.toggleRecording()
    })

    // 録音後の状態
    expect(result.current.isRecorded).toBe(true)
    expect(result.current.isRecording).toBe(false)
    expect(stopTrack).toHaveBeenCalledTimes(1)
  })

  test('録り直すと録音がやり直される', async () => {
    const { result } = renderHook(() => useRecordingFlow({ onBack: () => {}, onSaved: () => {} }))

    // 録音の開始と停止
    await act(async () => {
      await result.current.toggleRecording()
    })

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true)
    })

    await act(async () => {
      await result.current.toggleRecording()
    })

    // 録り直し
    await act(async () => {
      await result.current.retryRecording()
    })

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true)
    })

    // 前の録音の破棄と再開
    expect(result.current.isRecorded).toBe(false)
    expect(result.current.remainingDots).toBe(6)
  })

  test('3分で録音が自動的に止まる', async () => {
    const { result } = renderHook(() => useRecordingFlow({ onBack: () => {}, onSaved: () => {} }))

    // 録音の開始
    await act(async () => {
      await result.current.toggleRecording()
    })

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true)
    })

    // 3分の経過
    await advanceSeconds(180)

    await waitFor(() => {
      expect(result.current.isRecorded).toBe(true)
    })

    expect(result.current.isRecording).toBe(false)
    expect(stopTrack).toHaveBeenCalledTimes(1)
  })

  test('録音が進むと残り時間のドットが減る', async () => {
    const { result } = renderHook(() => useRecordingFlow({ onBack: () => {}, onSaved: () => {} }))

    // 録音の開始
    await act(async () => {
      await result.current.toggleRecording()
    })

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true)
    })

    expect(result.current.remainingDots).toBe(6)

    // 1つ目が消えるまでの10秒の経過
    await advanceSeconds(10)

    expect(result.current.remainingDots).toBe(5)

    // 2つ目が消えるまでの34秒の経過
    await advanceSeconds(34)

    expect(result.current.remainingDots).toBe(4)
  })

  test('入力方法を切り替えると録音が止まる', async () => {
    const { result } = renderHook(() => useRecordingFlow({ onBack: () => {}, onSaved: () => {} }))

    // 録音の開始
    await act(async () => {
      await result.current.toggleRecording()
    })

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true)
    })

    // 入力方法の切り替え
    await act(async () => {
      await result.current.toggleMode()
    })

    // マイクと音声処理の解放
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(closeAudioContext).toHaveBeenCalledTimes(1)
    expect(result.current.isRecording).toBe(false)
    expect(result.current.mode).toBe('text')
  })

  test('ホーム画面へもどると録音が止まる', async () => {
    const onBack = mock(() => {})
    const { result } = renderHook(() => useRecordingFlow({ onBack, onSaved: () => {} }))

    // 録音の開始
    await act(async () => {
      await result.current.toggleRecording()
    })

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true)
    })

    // ホーム画面への遷移
    await act(async () => {
      await result.current.backToHome()
    })

    // マイクと音声処理の解放
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(closeAudioContext).toHaveBeenCalledTimes(1)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  test('画面を離れると録音が止まる', async () => {
    const { result, unmount } = renderHook(() =>
      useRecordingFlow({ onBack: () => {}, onSaved: () => {} })
    )

    // 録音の開始
    await act(async () => {
      await result.current.toggleRecording()
    })

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true)
    })

    // 画面の破棄
    await act(async () => {
      unmount()
    })

    // マイクと音声処理の解放
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(closeAudioContext).toHaveBeenCalledTimes(1)
  })

  test('録音していないときの切り替えでは停止処理を呼ばない', async () => {
    const { result } = renderHook(() => useRecordingFlow({ onBack: () => {}, onSaved: () => {} }))

    // 録音を始めずに入力方法を切り替え
    await act(async () => {
      await result.current.toggleMode()
    })

    expect(stopTrack).not.toHaveBeenCalled()
    expect(closeAudioContext).not.toHaveBeenCalled()
  })
})
