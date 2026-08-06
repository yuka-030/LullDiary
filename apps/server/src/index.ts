// apps/server/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { transcribe, WhisperError } from './stt/whisper'

const app = new Hono()

/**
 * Tauriアプリ(localhost:1420)から別オリジンの本サーバーへ
 * リクエストするため、CORSを許可する。
 * ローカル完結の構成のため、開発用オリジンのみを対象にしている。
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

export default {
  port: 3000,
  fetch: app.fetch,
}
