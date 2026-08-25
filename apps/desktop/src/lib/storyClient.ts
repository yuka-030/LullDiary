// apps/desktop/src/lib/storyClient.ts
import type { Tags } from './entryClient'

// ローカルAPIサーバー(Hono)のベースURL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL が設定されていません')
}

// 音声再生中に表示する文字のタイミング
export type NarrationTiming = {
  index: number
  start: number
  end: number
}

// 確定したテキストを /generate-story に送信し、物語文を受け取る
export async function requestStory(text: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/generate-story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body && typeof body.error === 'string' ? body.error : '物語の生成に失敗しました'
    throw new Error(message)
  }

  const body = await response.json()
  return typeof body.story_text === 'string' ? body.story_text : ''
}

// 物語文を /tts に送信し、読み上げ音声(WAV)を受け取る
export async function requestNarration(text: string): Promise<ArrayBuffer> {
  const response = await fetch(`${API_BASE_URL}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body && typeof body.error === 'string' ? body.error : '音声の生成に失敗しました'
    throw new Error(message)
  }

  return response.arrayBuffer()
}

// 物語文の文字ごとの発話タイミングを取得する
export async function requestNarrationTimings(text: string): Promise<NarrationTiming[]> {
  const response = await fetch(`${API_BASE_URL}/tts-timings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message =
      body && typeof body.error === 'string'
        ? body.error
        : '文字表示用のタイミング取得に失敗しました'

    throw new Error(message)
  }

  const body = await response.json()

  if (!Array.isArray(body.timings)) {
    throw new Error('文字表示用のタイミングが不正です')
  }

  return body.timings.filter(
    (timing: unknown): timing is NarrationTiming =>
      typeof timing === 'object' &&
      timing !== null &&
      typeof (timing as NarrationTiming).index === 'number' &&
      typeof (timing as NarrationTiming).start === 'number' &&
      typeof (timing as NarrationTiming).end === 'number'
  )
}

// テキストを /extract-tags に送信し、シーンと感情のタグを受け取る
export async function requestTags(text: string): Promise<Tags> {
  const response = await fetch(`${API_BASE_URL}/extract-tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body && typeof body.error === 'string' ? body.error : 'タグの抽出に失敗しました'
    throw new Error(message)
  }

  const body = await response.json()
  return body.tags as Tags
}
