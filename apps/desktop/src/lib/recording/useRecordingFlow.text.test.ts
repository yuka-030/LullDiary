// apps/desktop/src/lib/recording/useRecordingFlow.text.test.ts
import { act, renderHook } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { useRecordingFlow } from './useRecordingFlow'

describe('useRecordingFlowのテキスト入力', () => {
  test('120字を確定できる', () => {
    const { result, unmount } = renderHook(() =>
      useRecordingFlow({ onBack: () => {}, onSaved: () => {} })
    )
    const text = 'あ'.repeat(120)

    act(() => result.current.setInputText(text))

    expect(result.current.inputCharacterCount).toBe(120)
    expect(result.current.canSubmitText).toBe(true)

    act(() => result.current.submitText())

    expect(result.current.confirmedText).toBe(text)
    expect(result.current.confirmedMode).toBe('text')

    unmount()
  })

  test('121字を切り捨てずに保持し確定を拒否する', () => {
    const { result, unmount } = renderHook(() =>
      useRecordingFlow({ onBack: () => {}, onSaved: () => {} })
    )
    const text = 'あ'.repeat(121)

    act(() => result.current.setInputText(text))

    expect(result.current.inputText).toBe(text)
    expect(result.current.inputCharacterCount).toBe(121)
    expect(result.current.textInputError).toBe('120字以内で入力してください')
    expect(result.current.canSubmitText).toBe(false)

    act(() => result.current.submitText())

    expect(result.current.confirmedText).toBeNull()

    act(() => result.current.setInputText('あ'.repeat(120)))

    expect(result.current.textInputError).toBeNull()
    expect(result.current.canSubmitText).toBe(true)

    unmount()
  })

  test('空文字と空白だけの入力を確定できない', () => {
    const { result, unmount } = renderHook(() =>
      useRecordingFlow({ onBack: () => {}, onSaved: () => {} })
    )

    for (const text of ['', '　 \n']) {
      act(() => result.current.setInputText(text))

      expect(result.current.canSubmitText).toBe(false)

      act(() => result.current.submitText())

      expect(result.current.confirmedText).toBeNull()
    }

    unmount()
  })

  test('日本語変換中は確定できず変換終了後に再判定する', () => {
    const { result, unmount } = renderHook(() =>
      useRecordingFlow({ onBack: () => {}, onSaved: () => {} })
    )

    act(() => {
      result.current.setIsTextComposing(true)
      result.current.setInputText('あ'.repeat(120))
    })

    expect(result.current.canSubmitText).toBe(false)

    act(() => result.current.submitText())

    expect(result.current.confirmedText).toBeNull()

    act(() => {
      result.current.setInputText('あ'.repeat(121))
      result.current.setIsTextComposing(false)
    })

    expect(result.current.canSubmitText).toBe(false)
    expect(result.current.textInputError).toBe('120字以内で入力してください')

    unmount()
  })

  test('音声入力の確定には120字制限を適用しない', () => {
    const { result, unmount } = renderHook(() =>
      useRecordingFlow({ onBack: () => {}, onSaved: () => {} })
    )
    const text = 'あ'.repeat(121)

    act(() => result.current.confirmTranscript(text))

    expect(result.current.confirmedText).toBe(text)
    expect(result.current.confirmedMode).toBe('voice')

    unmount()
  })
})
