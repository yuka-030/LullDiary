// apps/server/src/tag/ollama.test.ts
import { describe, expect, test } from 'bun:test'
import { extractTags, parseTags, TagExtractionError } from './ollama'

describe('parseTags', () => {
  test('正しいJSONからタグを取り出す', () => {
    const raw = '{"シーン":"職場","感情":["悔しい"]}'

    expect(parseTags(raw)).toEqual({
      シーン: '職場',
      感情: ['悔しい'],
    })
  })

  test('コードフェンスが付いていても取り出せる', () => {
    const raw = '```json\n{"シーン":"家","感情":["もやもや"]}\n```'

    expect(parseTags(raw)).toEqual({
      シーン: '家',
      感情: ['もやもや'],
    })
  })

  test('JSONが含まれていなければエラーになる', () => {
    expect(() => parseTags('タグを抽出できませんでした')).toThrow(TagExtractionError)
  })

  test('JSONとして壊れていればエラーになる', () => {
    expect(() => parseTags('{"シーン":"職場","感情":[')).toThrow()
  })

  test('選択肢にないシーンはエラーになる', () => {
    expect(() => parseTags('{"シーン":"宇宙","感情":["嬉しい"]}')).toThrow()
  })

  test('選択肢にない感情はエラーになる', () => {
    expect(() => parseTags('{"シーン":"家","感情":["うんざり"]}')).toThrow()
  })

  test('感情が空配列ならエラーになる', () => {
    expect(() => parseTags('{"シーン":"家","感情":[]}')).toThrow()
  })

  test('項目が欠けていればエラーになる', () => {
    expect(() => parseTags('{"シーン":"家"}')).toThrow()
  })
})

describe('extractTags', () => {
  test('1回目で正しい出力が得られればそのまま返す', async () => {
    let calls = 0

    const tags = await extractTags('今日は職場で資料を作った。', {
      requestTags: async () => {
        calls++
        return '{"シーン":"職場","感情":["疲れた"]}'
      },
    })

    expect(calls).toBe(1)
    expect(tags).toEqual({ シーン: '職場', 感情: ['疲れた'] })
  })

  test('崩れた出力でも、再試行で正しい結果が得られる', async () => {
    let calls = 0

    const tags = await extractTags('今日は職場で資料を作った。', {
      requestTags: async () => {
        calls++
        return calls < 3 ? 'タグを抽出できませんでした' : '{"シーン":"職場","感情":["疲れた"]}'
      },
    })

    expect(calls).toBe(3)
    expect(tags).toEqual({ シーン: '職場', 感情: ['疲れた'] })
  })

  test('選択肢にない値でも、再試行で正しい結果が得られる', async () => {
    let calls = 0

    const tags = await extractTags('今日は家で片づけをした。', {
      requestTags: async () => {
        calls++
        return calls === 1
          ? '{"シーン":"宇宙","感情":["うんざり"]}'
          : '{"シーン":"家","感情":["もやもや"]}'
      },
    })

    expect(calls).toBe(2)
    expect(tags).toEqual({ シーン: '家', 感情: ['もやもや'] })
  })

  test('試行回数の上限に達したらエラーになる', async () => {
    let calls = 0

    const promise = extractTags('今日は職場で資料を作った。', {
      requestTags: async () => {
        calls++
        return '崩れた出力'
      },
    })

    expect(promise).rejects.toThrow(TagExtractionError)
    await promise.catch(() => {})
    expect(calls).toBe(3)
  })

  test('試行回数は指定した値まで', async () => {
    let calls = 0

    const promise = extractTags('今日は職場で資料を作った。', {
      maxAttempts: 5,
      requestTags: async () => {
        calls++
        return '崩れた出力'
      },
    })

    await promise.catch(() => {})
    expect(calls).toBe(5)
  })

  test('話し方の特徴を渡すと感情が補正される', async () => {
    const tags = await extractTags('スーパーで友人に会って驚いた。', {
      profile: { averageLevel: 0.2, levelVariation: 0.08 },
      requestTags: async () => '{"シーン":"お店","感情":["驚き"]}',
    })

    expect(tags.感情).toEqual(['驚き', '嬉しい'])
  })
})
