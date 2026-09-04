// apps/desktop/src/lib/useStory.test.ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { Tags } from './entryClient'
import { useStory, type StoryDeps } from './useStory'

const INPUT_TEXT = '公園でねこを見かけて、しばらくながめていた。'

const STORY_TEXT =
  '今日は、公園で猫を見かけた日でした。丸くなって、日なたでじっとしています。しばらく、その姿を眺めていました。'

const TAGS: Tags = { シーン: '自然', 感情: ['穏やか'] }

// テスト用の生成処理
function createDeps(overrides: Partial<StoryDeps> = {}): StoryDeps {
  return {
    requestStory: async () => STORY_TEXT,
    requestNarration: async () => new ArrayBuffer(8),
    requestTags: async () => TAGS,
    ...overrides,
  }
}

beforeEach(() => {
  // Blob URLの生成と解放をテスト環境で扱えるようにする
  URL.createObjectURL = mock(() => 'blob:narration')
  URL.revokeObjectURL = mock(() => {})
})

describe('useStory', () => {
  test('すべて成功すると物語・タグ・音声がそろう', async () => {
    const { result } = renderHook(() => useStory(createDeps()))

    // 物語の生成
    await act(async () => {
      await result.current.generate(INPUT_TEXT)
    })

    await waitFor(() => {
      expect(result.current.narrationStatus).toBe('ready')
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.storyText).toBe(STORY_TEXT)
    expect(result.current.tags).toEqual(TAGS)
    expect(result.current.audioUrl).toBe('blob:narration')
  })

  test('音声の生成に失敗しても物語文が残る', async () => {
    const deps = createDeps({
      requestNarration: async () => {
        throw new Error('音声の生成に失敗しました')
      },
    })

    const { result } = renderHook(() => useStory(deps))

    // 物語の生成
    await act(async () => {
      await result.current.generate(INPUT_TEXT)
    })

    await waitFor(() => {
      expect(result.current.narrationStatus).toBe('error')
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.storyText).toBe(STORY_TEXT)
    expect(result.current.errorMessage).toBeNull()
  })

  test('音声の生成に失敗しても保存に必要なタグがそろう', async () => {
    const deps = createDeps({
      requestNarration: async () => {
        throw new Error('音声の生成に失敗しました')
      },
    })

    const { result } = renderHook(() => useStory(deps))

    // 物語の生成
    await act(async () => {
      await result.current.generate(INPUT_TEXT)
    })

    await waitFor(() => {
      expect(result.current.narrationStatus).toBe('error')
    })

    expect(result.current.tags).toEqual(TAGS)
    expect(result.current.audioUrl).toBeNull()
    expect(result.current.narrationBlobRef.current).toBeNull()
  })

  test('再試行で音声の生成に成功すると再生できる', async () => {
    let narrationCalls = 0

    const deps = createDeps({
      requestNarration: async () => {
        narrationCalls++

        if (narrationCalls === 1) {
          throw new Error('音声の生成に失敗しました')
        }

        return new ArrayBuffer(8)
      },
    })

    const { result } = renderHook(() => useStory(deps))

    // 物語の生成
    await act(async () => {
      await result.current.generate(INPUT_TEXT)
    })

    await waitFor(() => {
      expect(result.current.narrationStatus).toBe('error')
    })

    // 音声の再試行
    await act(async () => {
      result.current.retryNarration()
    })

    await waitFor(() => {
      expect(result.current.narrationStatus).toBe('ready')
    })

    expect(narrationCalls).toBe(2)
    expect(result.current.audioUrl).toBe('blob:narration')
    expect(result.current.narrationBlobRef.current).not.toBeNull()
    expect(result.current.storyText).toBe(STORY_TEXT)
  })

  test('物語の生成に失敗するとエラーになる', async () => {
    const deps = createDeps({
      requestStory: async () => {
        throw new Error('物語の生成に失敗しました')
      },
    })

    const { result } = renderHook(() => useStory(deps))

    // 物語の生成
    await act(async () => {
      await result.current.generate(INPUT_TEXT)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('物語の生成に失敗しました')
    expect(result.current.storyText).toBe('')
  })
})
