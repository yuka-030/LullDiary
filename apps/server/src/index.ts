// apps/server/src/index.ts
import { Hono } from 'hono'
import { transcribe, WhisperError } from './stt/whisper'

const app = new Hono()

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
