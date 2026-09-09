// apps/server/src/index.integration.test.ts
import type { Database } from 'bun:sqlite'
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import type { Entry, EntryRow, Tags } from './db/schema'

// テスト対象のサーバー
const SERVER_ROOT = path.resolve(import.meta.dir, '..')

// 子プロセスの実行情報
const workerDirectory = process.env.LULLDIARY_INTEGRATION_DIRECTORY
const workerTestName = process.env.LULLDIARY_INTEGRATION_NAME
const isWorker = Boolean(workerDirectory && workerTestName)

// テスト用のサーバーとDB
let server: ReturnType<typeof Bun.serve> | undefined
let database: Database | undefined
let baseUrl = ''

// 外部処理の記録
let receivedAudio: Uint8Array | undefined
const generationCalls: { text: string; seed: number }[] = []
let transcriptionFailure: Error | undefined
let generationFailure: Error | undefined
let whisperModule: typeof import('./stt/whisper')
let ollamaModule: typeof import('./story/ollama')

// 外部処理の応答
const TRANSCRIPT = '今日は家で本を読みました。'
const STORY = '今日は、家で本を読んだ一日でした。'

// 日記の初期タグ
const DEFAULT_TAGS: Tags = { シーン: '家', 感情: ['穏やか'] }

// 無音のWAVデータ
function wav(sample = 0): ArrayBuffer {
  const buffer = new ArrayBuffer(48)
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const encoder = new TextEncoder()

  bytes.set(encoder.encode('RIFF'), 0)
  view.setUint32(4, 40, true)
  bytes.set(encoder.encode('WAVE'), 8)
  bytes.set(encoder.encode('fmt '), 12)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 16000, true)
  view.setUint32(28, 32000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  bytes.set(encoder.encode('data'), 36)
  view.setUint32(40, 4, true)
  view.setInt16(44, sample, true)
  view.setInt16(46, sample, true)

  return buffer
}

// テスト用の写真
async function photo(width = 40, height = 20): Promise<File> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 240, g: 210, b: 180 },
    },
  })
    .png()
    .toBuffer()

  return new File([new Uint8Array(buffer)], 'photo.png', { type: 'image/png' })
}

// 保存用のフォーム
function entryForm(tags: Tags = DEFAULT_TAGS): FormData {
  const form = new FormData()

  form.set('input_type', 'text')
  form.set('raw_input_text', TRANSCRIPT)
  form.set('story_text', STORY)
  form.set('tags', JSON.stringify(tags))

  return form
}

// メディア付きのフォーム
async function mediaForm(): Promise<FormData> {
  const form = entryForm()

  form.set('narration', new File([wav()], 'narration.wav', { type: 'audio/wav' }))
  form.set('photos', await photo())

  return form
}

// テスト用HTTPリクエスト
async function request(route: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)

  headers.set('Host', 'localhost:3000')
  headers.set('Origin', 'http://localhost:1420')

  return fetch(`${baseUrl}${route}`, { ...init, headers })
}

// 日記の応答
async function entryResponse(response: Response, status = 200): Promise<Entry> {
  expect(response.status).toBe(status)

  const body = (await response.json()) as { entry: Entry }

  expect(body.entry).toBeDefined()

  return body.entry
}

// API経由の日記保存
async function saveEntry(form = entryForm()): Promise<Entry> {
  return entryResponse(await request('/entries', { method: 'POST', body: form }), 201)
}

// API経由の日記一覧
async function list(query = ''): Promise<Entry[]> {
  const response = await request(`/entries${query}`)

  expect(response.status).toBe(200)

  const body = (await response.json()) as { entries: Entry[] }

  return body.entries
}

// DB内の日記
function row(id: string): EntryRow | null {
  if (!database) {
    throw new Error('テスト用DBが初期化されていません')
  }

  return database.query('SELECT * FROM entries WHERE id = ?').get(id) as EntryRow | null
}

// DB内の日記数
function entryCount(): number {
  if (!database) {
    throw new Error('テスト用DBが初期化されていません')
  }

  const result = database.query('SELECT COUNT(*) AS count FROM entries').get() as {
    count: number
  }

  return result.count
}

// 指定日時の日記
async function datedEntry(createdAt: string, tags: Tags): Promise<Entry> {
  const entry = await saveEntry(entryForm(tags))

  if (!database) {
    throw new Error('テスト用DBが初期化されていません')
  }

  database.prepare('UPDATE entries SET created_at = ? WHERE id = ?').run(createdAt, entry.id)

  return { ...entry, created_at: createdAt }
}

// テスト用メディアの保存先
function mediaPaths(id: string) {
  if (!workerDirectory) {
    throw new Error('テスト用ディレクトリが指定されていません')
  }

  const root = path.join(workerDirectory, 'app_data')

  return {
    narration: path.join(root, 'narration', `${id}.wav`),
    photoDirectory: path.join(root, 'photos', id),
    photo: path.join(root, 'photos', id, 'photo1.jpg'),
  }
}

// 子プロセスでの結合テスト
function integrationTest(name: string, assertion: () => Promise<void>): void {
  if (isWorker) {
    if (name === workerTestName) {
      test(name, assertion, 15_000)
    }

    return
  }

  test(
    name,
    async () => {
      const directory = await mkdtemp(path.join(SERVER_ROOT, '.integration-test-'))

      try {
        await cp(path.join(SERVER_ROOT, 'src'), path.join(directory, 'src'), {
          recursive: true,
          filter: (source) => !source.endsWith('.test.ts'),
        })

        const child = Bun.spawn(
          [process.execPath, 'test', path.join(import.meta.dir, 'index.integration.test.ts')],
          {
            cwd: SERVER_ROOT,
            env: {
              ...process.env,
              LULLDIARY_INTEGRATION_DIRECTORY: directory,
              LULLDIARY_INTEGRATION_NAME: name,
              VOICEVOX_URL: 'http://127.0.0.1:1',
              OLLAMA_URL: 'http://127.0.0.1:1',
              OLLAMA_MODEL: 'test-story',
              OLLAMA_POLISH_MODEL: 'test-polish',
            },
            stdout: 'pipe',
            stderr: 'pipe',
          }
        )

        const timer = setTimeout(() => child.kill(), 20_000)

        try {
          const [stdout, stderr, exitCode] = await Promise.all([
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
            child.exited,
          ])

          if (exitCode !== 0) {
            throw new Error(`${name}\n${stdout}\n${stderr}`)
          }
        } finally {
          clearTimeout(timer)
        }
      } finally {
        await rm(directory, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 100,
        })
      }
    },
    30_000
  )
}

describe('APIとDB・保存ファイルの連携', () => {
  beforeAll(async () => {
    if (!isWorker || !workerDirectory) {
      return
    }

    const moduleUrl = (relativePath: string) =>
      pathToFileURL(path.join(workerDirectory, 'src', relativePath)).href

    // 文字起こしの差し替え
    const whisperUrl = moduleUrl('stt/whisper.ts')
    whisperModule = (await import(whisperUrl)) as typeof import('./stt/whisper')

    mock.module(whisperUrl, () => ({
      ...whisperModule,
      transcribe: async (audio: ArrayBuffer) => {
        receivedAudio = new Uint8Array(audio)

        if (transcriptionFailure) {
          throw transcriptionFailure
        }

        return TRANSCRIPT
      },
    }))

    // 物語生成の差し替え
    const ollamaUrl = moduleUrl('story/ollama.ts')
    ollamaModule = (await import(ollamaUrl)) as typeof import('./story/ollama')

    mock.module(ollamaUrl, () => ({
      ...ollamaModule,
      generateStory: async (text: string, seed: number) => {
        generationCalls.push({ text, seed })

        if (generationFailure) {
          throw generationFailure
        }

        return STORY
      },
    }))

    // 未使用の外部処理への接続防止
    const tagUrl = moduleUrl('tag/ollama.ts')
    const tagModule = (await import(tagUrl)) as typeof import('./tag/ollama')

    mock.module(tagUrl, () => ({
      ...tagModule,
      extractTags: async () => {
        throw new Error('この結合テストではタグ抽出を呼び出しません')
      },
    }))

    const voicevoxUrl = moduleUrl('tts/voicevox.ts')
    const voicevoxModule = (await import(voicevoxUrl)) as typeof import('./tts/voicevox')

    mock.module(voicevoxUrl, () => ({
      ...voicevoxModule,
      synthesize: async () => {
        throw new Error('この結合テストでは音声生成を呼び出しません')
      },
    }))

    // 実際のAPIとテスト用DB
    const application = (await import(moduleUrl('index.ts'))) as typeof import('./index')
    const client = (await import(moduleUrl('db/client.ts'))) as typeof import('./db/client')

    database = client.db

    server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: application.default.fetch,
    })

    baseUrl = `http://127.0.0.1:${server.port}`
  })

  afterAll(async () => {
    if (isWorker) {
      await server?.stop(true)
      database?.close()
    }
  })

  integrationTest('POST /sttで音声が文字起こしへ渡りテキストが返る', async () => {
    const audio = wav()
    const response = await request('/stt', {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: audio,
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ text: TRANSCRIPT })
    expect(receivedAudio).toEqual(new Uint8Array(audio))
    expect(entryCount()).toBe(0)
  })

  integrationTest('POST /sttで外部処理が失敗すると500を返す', async () => {
    transcriptionFailure = new whisperModule.WhisperError('テスト用の文字起こし失敗')

    const response = await request('/stt', {
      method: 'POST',
      body: wav(),
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'テスト用の文字起こし失敗' })
    expect(entryCount()).toBe(0)
  })

  integrationTest('POST /generate-storyで入力が生成処理へ渡り物語が返る', async () => {
    const response = await request('/generate-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: TRANSCRIPT, input_type: 'text' }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ story_text: STORY })
    expect(generationCalls).toHaveLength(1)
    expect(generationCalls[0].text).toBe(TRANSCRIPT)
    expect(Number.isFinite(generationCalls[0].seed)).toBe(true)
    expect(entryCount()).toBe(0)
  })

  integrationTest('POST /generate-storyで外部処理が失敗すると500を返す', async () => {
    generationFailure = new ollamaModule.OllamaError('テスト用の物語生成失敗')

    const response = await request('/generate-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: TRANSCRIPT, input_type: 'text' }),
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'テスト用の物語生成失敗' })
    expect(generationCalls).toHaveLength(1)
    expect(entryCount()).toBe(0)
  })

  integrationTest('POST /entriesでメディアなしの日記をDBへ保存する', async () => {
    const entry = await saveEntry()
    const saved = row(entry.id)

    expect(saved).not.toBeNull()
    expect(saved?.raw_input_text).toBe(TRANSCRIPT)
    expect(saved?.story_text).toBe(STORY)
    expect(saved?.input_type).toBe('text')
    expect(saved?.tags).toBe(JSON.stringify(DEFAULT_TAGS))
    expect(saved?.narration_path).toBeNull()
    expect(saved?.photo_paths).toBe('[]')
    expect(entry.narration_path).toBeNull()
    expect(entry.photo_paths).toEqual([])
    expect(entryCount()).toBe(1)
  })

  integrationTest('POST /entriesで音声と写真を所定の場所へ保存する', async () => {
    const entry = await saveEntry(await mediaForm())
    const locations = mediaPaths(entry.id)
    const saved = row(entry.id)

    expect(entry.narration_path).toBe(locations.narration)
    expect(entry.photo_paths).toEqual([locations.photo])
    expect(saved?.narration_path).toBe(locations.narration)
    expect(saved?.photo_paths).toBe(JSON.stringify([locations.photo]))
    expect(await readFile(locations.narration)).toEqual(Buffer.from(wav()))

    const metadata = await sharp(await readFile(locations.photo)).metadata()

    expect(metadata.format).toBe('jpeg')
    expect(metadata.width).toBe(40)
    expect(metadata.height).toBe(20)

    const narration = await request(`/entries/${entry.id}/narration`)
    expect(narration.status).toBe(200)
    expect(Buffer.from(await narration.arrayBuffer())).toEqual(Buffer.from(wav()))

    const image = await request(`/entries/${entry.id}/photos/photo1.jpg`)
    expect(image.status).toBe(200)
    expect(Buffer.from(await image.arrayBuffer())).toEqual(await readFile(locations.photo))
  })

  integrationTest('POST /entriesで不正な日記をDBへ保存しない', async () => {
    const form = entryForm()
    form.set('tags', '壊れたJSON')

    const response = await request('/entries', { method: 'POST', body: form })

    expect(response.status).toBe(400)
    expect(entryCount()).toBe(0)
  })

  integrationTest('GET /entriesで空の一覧と作成日時の降順を返す', async () => {
    expect(await list()).toEqual([])

    const older = await datedEntry('2026-08-01T12:00:00.000Z', DEFAULT_TAGS)
    const newer = await datedEntry('2026-09-01T12:00:00.000Z', DEFAULT_TAGS)

    expect(await list()).toEqual([newer, older])
  })

  integrationTest('GET /entriesでシーン・感情・月の条件と解除を反映する', async () => {
    const target = await datedEntry('2026-09-01T12:00:00.000Z', {
      シーン: '家',
      感情: ['嬉しい', '穏やか'],
    })
    const otherScene = await datedEntry('2026-09-02T12:00:00.000Z', {
      シーン: '職場',
      感情: ['嬉しい', '穏やか'],
    })
    const otherEmotion = await datedEntry('2026-09-03T12:00:00.000Z', {
      シーン: '家',
      感情: ['嬉しい'],
    })
    const otherYear = await datedEntry('2025-09-01T12:00:00.000Z', {
      シーン: '家',
      感情: ['嬉しい', '穏やか'],
    })

    const query = new URLSearchParams()
    query.set('scene', '家')
    query.append('emotion', '嬉しい')
    query.append('emotion', '穏やか')
    query.set('month', '2026-09')

    expect(await list(`?${query}`)).toEqual([target])
    expect(await list()).toEqual([otherEmotion, otherScene, target, otherYear])
  })

  integrationTest('GET /entriesで不正な絞り込み条件を400で返す', async () => {
    const response = await request('/entries?month=2026-13')

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: '絞り込み条件が不正です' })
  })

  integrationTest('GET /entries/:idで指定した日記を返し存在しなければ404を返す', async () => {
    const entry = await saveEntry()

    expect(await entryResponse(await request(`/entries/${entry.id}`))).toEqual(entry)

    const missing = await request(`/entries/${crypto.randomUUID()}`)

    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: '日記が見つかりません' })
  })

  integrationTest('PATCH /entries/:idで本文とタグを更新しメディアを保持する', async () => {
    const entry = await saveEntry(await mediaForm())
    const locations = mediaPaths(entry.id)
    const originalPhoto = await readFile(locations.photo)
    const tags: Tags = { シーン: '自然', 感情: ['嬉しい'] }
    const form = new FormData()

    form.set('story_text', '更新した物語です。')
    form.set('tags', JSON.stringify(tags))

    const updated = await entryResponse(
      await request(`/entries/${entry.id}`, { method: 'PATCH', body: form })
    )

    expect(updated).toEqual({
      ...entry,
      story_text: '更新した物語です。',
      tags,
    })
    expect(row(entry.id)?.story_text).toBe('更新した物語です。')
    expect(row(entry.id)?.tags).toBe(JSON.stringify(tags))
    expect(await readFile(locations.photo)).toEqual(originalPhoto)
    expect(await readFile(locations.narration)).toEqual(Buffer.from(wav()))
    expect(await entryResponse(await request(`/entries/${entry.id}`))).toEqual(updated)
  })

  integrationTest('PATCH /entries/:idで写真と音声を差し替える', async () => {
    const entry = await saveEntry(await mediaForm())
    const locations = mediaPaths(entry.id)
    const replacementAudio = wav(100)
    const form = new FormData()

    form.set('photos', await photo(60, 30))
    form.set('narration', new File([replacementAudio], 'replacement.wav', { type: 'audio/wav' }))

    const updated = await entryResponse(
      await request(`/entries/${entry.id}`, { method: 'PATCH', body: form })
    )

    expect(updated.narration_path).toBe(locations.narration)
    expect(updated.photo_paths).toEqual([locations.photo])
    expect(await readFile(locations.narration)).toEqual(Buffer.from(replacementAudio))
    expect(await readdir(locations.photoDirectory)).toEqual(['photo1.jpg'])

    const metadata = await sharp(await readFile(locations.photo)).metadata()

    expect(metadata.width).toBe(60)
    expect(metadata.height).toBe(30)
    expect(row(entry.id)?.photo_paths).toBe(JSON.stringify([locations.photo]))
  })

  integrationTest('PATCH /entries/:idで写真だけを削除する', async () => {
    const entry = await saveEntry(await mediaForm())
    const locations = mediaPaths(entry.id)
    const form = new FormData()

    form.set('clear_photos', 'true')

    const updated = await entryResponse(
      await request(`/entries/${entry.id}`, { method: 'PATCH', body: form })
    )

    expect(updated.photo_paths).toEqual([])
    expect(row(entry.id)?.photo_paths).toBe('[]')
    expect(existsSync(locations.photoDirectory)).toBe(false)
    expect(await readFile(locations.narration)).toEqual(Buffer.from(wav()))
    expect((await request(`/entries/${entry.id}/photos/photo1.jpg`)).status).toBe(404)
  })

  integrationTest('PATCH /entries/:idで不正な更新を拒否し元の値を保持する', async () => {
    const entry = await saveEntry()
    const form = new FormData()
    form.set('story_text', '')

    const response = await request(`/entries/${entry.id}`, {
      method: 'PATCH',
      body: form,
    })

    expect(response.status).toBe(400)
    expect(await entryResponse(await request(`/entries/${entry.id}`))).toEqual(entry)
    expect(row(entry.id)?.story_text).toBe(STORY)
  })

  integrationTest('PATCH /entries/:idで存在しない日記に404を返す', async () => {
    const form = new FormData()
    form.set('story_text', '更新した物語です。')

    const response = await request(`/entries/${crypto.randomUUID()}`, {
      method: 'PATCH',
      body: form,
    })

    expect(response.status).toBe(404)
    expect(entryCount()).toBe(0)
  })

  integrationTest('DELETE /entries/:idで日記と紐づくファイルを削除する', async () => {
    const target = await saveEntry(await mediaForm())
    const remaining = await saveEntry(await mediaForm())
    const targetPaths = mediaPaths(target.id)
    const remainingPaths = mediaPaths(remaining.id)

    expect(existsSync(targetPaths.narration)).toBe(true)
    expect(existsSync(targetPaths.photo)).toBe(true)

    const response = await request(`/entries/${target.id}`, { method: 'DELETE' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(row(target.id)).toBeNull()
    expect(existsSync(targetPaths.narration)).toBe(false)
    expect(existsSync(targetPaths.photoDirectory)).toBe(false)
    expect((await request(`/entries/${target.id}`)).status).toBe(404)
    expect((await request(`/entries/${target.id}/narration`)).status).toBe(404)
    expect((await request(`/entries/${target.id}/photos/photo1.jpg`)).status).toBe(404)
    expect(await list()).toEqual([remaining])
    expect(existsSync(remainingPaths.narration)).toBe(true)
    expect(existsSync(remainingPaths.photo)).toBe(true)
  })

  integrationTest('DELETE /entries/:idで存在しない日記に404を返す', async () => {
    const response = await request(`/entries/${crypto.randomUUID()}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: '日記が見つかりません' })
    expect(entryCount()).toBe(0)
  })
})
