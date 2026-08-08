// apps/server/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { generateStory, OllamaError } from './story/ollama'
import { transcribe, WhisperError } from './stt/whisper'

const app = new Hono()

/** /generate-story のリクエストボディ */
type GenerateStoryRequest = {
  text?: unknown
}

/**
 * Tauriアプリ(localhost:1420)から別オリジンの本サーバーへ
 * リクエストするため、CORSを許可する。
 */
app.use(
  '/*',
  cors({
    origin: ['http://localhost:1420', 'tauri://localhost'],
  })
)

app.get('/health', (c) => {
  return c.json({ status: 'ok' }, 200)
})

app.post('/stt', async (c) => {
  const body = await c.req.arrayBuffer()

  if (body.byteLength === 0) {
    return c.json({ error: '音声データが空です' }, 400)
  }

  try {
    const text = await transcribe(body)
    return c.json({ text }, 200)
  } catch (err) {
    if (err instanceof WhisperError) {
      return c.json({ error: err.message }, 500)
    }
    return c.json({ error: '音声のテキスト化に失敗しました' }, 500)
  }
})

app.post('/generate-story', async (c) => {
  const body = (await c.req.json().catch(() => null)) as GenerateStoryRequest | null

  if (!body || typeof body.text !== 'string' || body.text.trim().length === 0) {
    return c.json({ error: '入力テキストが空です' }, 400)
  }

  try {
    const storyText = await generateStory(body.text)
    return c.json({ story_text: storyText }, 200)
  } catch (err) {
    if (err instanceof OllamaError) {
      return c.json({ error: err.message }, 500)
    }
    return c.json({ error: '物語の生成に失敗しました' }, 500)
  }
})

export default {
  port: 3000,
  fetch: app.fetch,
}
