// apps/server/src/story/ollama.test.ts
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { generateStory, OllamaError } from './ollama'

// テスト対象の環境変数
const environmentKeys = ['OLLAMA_URL', 'OLLAMA_MODEL', 'OLLAMA_POLISH_MODEL'] as const

// 通信先へ渡す内容
type GenerateRequest = {
  model: string
  prompt: string
  stream: boolean
  keep_alive: string
  options: { seed: number }
}

// 送信内容の記録
type RecordedRequest = {
  url: string
  method: string
  headers: Headers
  body: GenerateRequest
}

// 通信の記録と復元処理
let requests: RecordedRequest[] = []
let responses: (Response | Error)[] = []
let restoreFetch: (() => void) | undefined
let savedEnvironment: Partial<Record<(typeof environmentKeys)[number], string>>

describe('物語の生成と添削', () => {
  beforeEach(() => {
    savedEnvironment = {}

    for (const key of environmentKeys) {
      savedEnvironment[key] = process.env[key]
    }

    process.env.OLLAMA_URL = 'http://ollama.test'
    process.env.OLLAMA_MODEL = 'test-story'
    process.env.OLLAMA_POLISH_MODEL = 'test-polish'

    requests = []
    responses = []

    // Bunのfetchに対応した通信の差し替え
    const fakeFetch: typeof fetch = Object.assign(
      async (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1]
      ): Promise<Response> => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

        if (typeof init?.body !== 'string') {
          throw new Error('生成要求の本文がJSON文字列ではありません')
        }

        requests.push({
          url,
          method: init.method ?? 'GET',
          headers: new Headers(init.headers),
          body: JSON.parse(init.body) as GenerateRequest,
        })

        const response = responses.shift()

        if (!response) {
          throw new Error('予定していないOllamaへの呼び出しです')
        }

        if (response instanceof Error) {
          throw response
        }

        return response
      },
      {
        preconnect: () => {},
      }
    )

    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(fakeFetch)

    restoreFetch = () => fetchSpy.mockRestore()
  })

  afterEach(() => {
    restoreFetch?.()

    for (const key of environmentKeys) {
      const value = savedEnvironment[key]

      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  test('生成結果と元の入力を添削へ渡し添削結果を返す', async () => {
    const input = '今日は図書館で星の本を読みました。'
    responses.push(
      Response.json({ response: '  生成された物語です。 \n' }),
      Response.json({ response: ' \n添削された物語です。  ' })
    )

    expect(await generateStory(input, 123)).toBe('添削された物語です。')
    expect(requests).toHaveLength(2)

    for (const request of requests) {
      expect(request.url).toBe('http://ollama.test/api/generate')
      expect(request.method).toBe('POST')
      expect(request.headers.get('Content-Type')).toBe('application/json')
    }

    const generation = requests[0].body
    const polishing = requests[1].body

    expect(generation).toMatchObject({
      model: 'test-story',
      stream: false,
      keep_alive: '30m',
      options: { seed: 123 },
    })
    expect(generation.prompt).toContain(`元の文章:\n${input}`)

    expect(polishing).toMatchObject({
      model: 'test-polish',
      stream: false,
      keep_alive: '30m',
      options: { seed: 123 },
    })
    expect(polishing.prompt).toContain(`元の文章:\n${input}`)
    expect(polishing.prompt).toContain('書き直された文章:\n生成された物語です。\n')
  })

  test('seedを省略すると両方の処理に既定値を渡す', async () => {
    responses.push(Response.json({ response: '生成結果' }), Response.json({ response: '添削結果' }))

    await generateStory('今日の出来事')

    expect(requests).toHaveLength(2)

    for (const request of requests) {
      expect(request.body.options.seed).toBe(42)
    }
  })

  for (const key of environmentKeys) {
    test(`${key}が未設定なら通信せずエラーになる`, async () => {
      delete process.env[key]

      await expect(generateStory('今日の出来事')).rejects.toThrow(
        new OllamaError(`${key} が設定されていません`)
      )
      expect(requests).toHaveLength(0)
    })
  }

  for (const stage of ['生成', '添削'] as const) {
    test(`${stage}で接続に失敗するとエラーになる`, async () => {
      if (stage === '添削') {
        responses.push(Response.json({ response: '生成結果' }))
      }

      responses.push(new Error('接続失敗'))

      await expect(generateStory('今日の出来事')).rejects.toThrow(
        new OllamaError('Ollamaに接続できませんでした')
      )
      expect(requests).toHaveLength(stage === '生成' ? 1 : 2)
    })

    test(`${stage}でHTTPエラーが返るとステータス付きのエラーになる`, async () => {
      if (stage === '添削') {
        responses.push(Response.json({ response: '生成結果' }))
      }

      responses.push(new Response('利用できません', { status: 503 }))

      await expect(generateStory('今日の出来事')).rejects.toThrow(
        new OllamaError('Ollamaの応答が不正です(503)')
      )
      expect(requests).toHaveLength(stage === '生成' ? 1 : 2)
    })

    test(`${stage}の応答に物語の文字列がなければエラーになる`, async () => {
      for (const body of [{}, { response: 123 }, { response: null }]) {
        requests = []
        responses = []

        if (stage === '添削') {
          responses.push(Response.json({ response: '生成結果' }))
        }

        responses.push(Response.json(body))

        await expect(generateStory('今日の出来事')).rejects.toThrow(
          new OllamaError('Ollamaの応答形式が想定と異なります')
        )
        expect(requests).toHaveLength(stage === '生成' ? 1 : 2)
      }
    })

    test(`${stage}の応答が壊れたJSONなら処理を失敗として返す`, async () => {
      if (stage === '添削') {
        responses.push(Response.json({ response: '生成結果' }))
      }

      responses.push(
        new Response('{"response":', {
          headers: { 'Content-Type': 'application/json' },
        })
      )

      await expect(generateStory('今日の出来事')).rejects.toThrow()
      expect(requests).toHaveLength(stage === '生成' ? 1 : 2)
    })
  }
})
