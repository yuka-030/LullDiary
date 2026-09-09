// apps/server/src/story/storyRoute.test.ts
import { describe, expect, mock, test } from 'bun:test'
import { createStoryRoute } from './storyRoute'

describe('物語生成APIの入力検証', () => {
  test('120字のテキスト入力を生成処理へ渡す', async () => {
    const generate = mock(async () => '物語')
    const app = createStoryRoute(generate)
    const text = 'あ'.repeat(120)

    const response = await app.request('/generate-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, input_type: 'text' }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ story_text: '物語' })
    expect(generate).toHaveBeenCalledWith(text, expect.any(Number))
  })

  test('121字のテキスト入力を400で拒否し生成処理を呼ばない', async () => {
    const generate = mock(async () => '物語')
    const app = createStoryRoute(generate)

    const response = await app.request('/generate-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'あ'.repeat(121), input_type: 'text' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: '120字以内で入力してください' })
    expect(generate).not.toHaveBeenCalled()
  })

  test('121字の音声入力を許可する', async () => {
    const generate = mock(async () => '物語')
    const app = createStoryRoute(generate)

    const response = await app.request('/generate-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'あ'.repeat(121), input_type: 'voice' }),
    })

    expect(response.status).toBe(200)
    expect(generate).toHaveBeenCalledTimes(1)
  })

  test('不正な入力と入力方法の省略を拒否する', async () => {
    for (const body of [
      null,
      { text: 'あ' },
      { text: 'あ', input_type: 'unknown' },
      { text: 100, input_type: 'text' },
      { text: '', input_type: 'text' },
      { text: '　 \n', input_type: 'text' },
      { text: '', input_type: 'voice' },
    ]) {
      const generate = mock(async () => '物語')
      const app = createStoryRoute(generate)

      const response = await app.request('/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      expect(response.status).toBe(400)
      expect(generate).not.toHaveBeenCalled()
    }
  })
})
