// apps/desktop/src/lib/storyClient.ts

// ローカルAPIサーバー(Hono)のベースURL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL が設定されていません')
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
