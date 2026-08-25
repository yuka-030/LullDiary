// apps/desktop/src/lib/useRecordingFlow.test.ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { useRecordingFlow } from './useRecordingFlow'

// マイクのトラックの停止
let stopTrack: ReturnType<typeof mock>
// AudioContextの終了
let closeAudioContext: ReturnType<typeof mock>

// 差し替え前のグローバル
const originalMediaDevices = navigator.mediaDevices
const originalAudioContext = globalThis.AudioContext

beforeEach(() => {
  stopTrack = mock(() => {})
  closeAudioContext = mock(() => Promise.resolve())

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
})

describe('useRecordingFlow', () => {
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
