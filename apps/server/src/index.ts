// apps/server/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createEntry, deleteEntry, getEntry, listEntries } from './db/entries'
import { CreateEntrySchema, ListEntriesQuerySchema } from './db/entrySchema'
import { migrate } from './db/migrate'
import { generateStory, OllamaError } from './story/ollama'
import { transcribe, WhisperError } from './stt/whisper'
import { extractTags, TagExtractionError } from './tag/ollama'
import type { VoiceProfile } from './tag/voice'
import { synthesize, VoicevoxError } from './tts/voicevox'

migrate()

const app = new Hono()

// /generate-story のリクエストボディ
type GenerateStoryRequest = {
  text?: unknown
}

// /extract-tags のリクエストボディ
type ExtractTagsRequest = {
  text?: unknown
  voice?: unknown
}

// /tts のリクエストボディ
type TtsRequest = {
  text?: unknown
}

// CORSを許可するオリジン
app.use(
  '/*',
  cors({
    origin: ['http://localhost:1420', 'tauri://localhost'],
  })
)

// unknown型を話し方の情報として扱えるかの判定
function toVoiceProfile(value: unknown): VoiceProfile | undefined {
  // オブジェクトの判定
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const { averageLevel, levelVariation } = value as Record<string, unknown>

  // 数値の判定
  if (typeof averageLevel !== 'number' || typeof levelVariation !== 'number') {
    return undefined
  }

  return { averageLevel, levelVariation }
}

app.get('/health', (c) => {
  return c.json({ status: 'ok' }, 200)
})

app.post('/stt', async (c) => {
  // リクエストボディを音声データとして取得
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

  // 入力テキストの判定
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

app.post('/extract-tags', async (c) => {
  const body = (await c.req.json().catch(() => null)) as ExtractTagsRequest | null

  // 入力テキストの判定
  if (!body || typeof body.text !== 'string' || body.text.trim().length === 0) {
    return c.json({ error: '入力テキストが空です' }, 400)
  }

  try {
    // 話し方の情報を感情の補正に渡す
    const tags = await extractTags(body.text, { profile: toVoiceProfile(body.voice) })
    return c.json({ tags }, 200)
  } catch (err) {
    if (err instanceof TagExtractionError) {
      return c.json({ error: err.message }, 500)
    }
    return c.json({ error: 'タグの抽出に失敗しました' }, 500)
  }
})

app.post('/tts', async (c) => {
  const body = (await c.req.json().catch(() => null)) as TtsRequest | null

  // 入力テキストの判定
  if (!body || typeof body.text !== 'string' || body.text.trim().length === 0) {
    return c.json({ error: '入力テキストが空です' }, 400)
  }

  try {
    const audio = await synthesize(body.text)
    // 音声データをWAVとして返す
    return new Response(audio, {
      status: 200,
      headers: { 'Content-Type': 'audio/wav' },
    })
  } catch (err) {
    if (err instanceof VoicevoxError) {
      return c.json({ error: err.message }, 500)
    }
    return c.json({ error: '音声の生成に失敗しました' }, 500)
  }
})

// 日記エントリの新規作成
app.post('/entries', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = CreateEntrySchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: '日記の内容が不正です' }, 400)
  }

  try {
    const entry = createEntry(parsed.data)
    return c.json({ entry }, 201)
  } catch {
    return c.json({ error: '日記の保存に失敗しました' }, 500)
  }
})

// 日記エントリの一覧取得
app.get('/entries', (c) => {
  const query = {
    scene: c.req.query('scene'),
    emotions: c.req.queries('emotion'),
    month: c.req.query('month'),
  }

  const parsed = ListEntriesQuerySchema.safeParse(query)

  if (!parsed.success) {
    return c.json({ error: '絞り込み条件が不正です' }, 400)
  }

  try {
    const entries = listEntries(parsed.data)
    return c.json({ entries }, 200)
  } catch {
    return c.json({ error: '日記の取得に失敗しました' }, 500)
  }
})

// 日記エントリの詳細取得
app.get('/entries/:id', (c) => {
  try {
    const entry = getEntry(c.req.param('id'))

    if (!entry) {
      return c.json({ error: '日記が見つかりません' }, 404)
    }

    return c.json({ entry }, 200)
  } catch {
    return c.json({ error: '日記の取得に失敗しました' }, 500)
  }
})

// 日記エントリの削除
app.delete('/entries/:id', (c) => {
  try {
    const deleted = deleteEntry(c.req.param('id'))

    if (!deleted) {
      return c.json({ error: '日記が見つかりません' }, 404)
    }

    return c.json({ ok: true }, 200)
  } catch {
    return c.json({ error: '日記の削除に失敗しました' }, 500)
  }
})

export default {
  port: 3000,
  fetch: app.fetch,
}
