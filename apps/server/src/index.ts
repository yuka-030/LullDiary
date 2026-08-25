// apps/server/src/index.ts

import { Hono } from 'hono'

import { cors } from 'hono/cors'

import {
  createEntry,
  deleteEntry,
  getEntry,
  listEntries,
  updateEntry,
  updateEntryMediaPaths,
} from './db/entries'

import {
  CreateEntryFieldsSchema,
  ListEntriesQuerySchema,
  UpdateEntryFieldsSchema,
} from './db/entrySchema'

import { migrate } from './db/migrate'

import { narrationPath, photoPath, removeMedia, removePhotos } from './media/paths'

import { saveNarration, savePhotos } from './media/save'

import { generateStory, OllamaError } from './story/ollama'

import { transcribe, WhisperError } from './stt/whisper'

import { extractTags, TagExtractionError } from './tag/ollama'

import type { VoiceProfile } from './tag/voice'

import { synthesize, VoicevoxError } from './tts/voicevox'

// VOICEVOXのローカルAPI

const VOICEVOX_URL = process.env.VOICEVOX_URL

if (!VOICEVOX_URL) {
  throw new Error('VOICEVOX_URL が設定されていません')
}

// 暁記ミタマ ノーマル

const SPEAKER_ID = 122

// 物語生成リクエスト

type GenerateStoryRequest = {
  text?: unknown
}

// タグ抽出リクエスト

type ExtractTagsRequest = {
  text?: unknown
  voice?: unknown
}

// 音声合成リクエスト

type TtsRequest = {
  text?: unknown
}

// 音声タイミング取得リクエスト

type TtsTimingsRequest = {
  text?: unknown
}

// 文字ごとの発話タイミング

type NarrationTiming = {
  index: number
  start: number
  end: number
}

// VOICEVOXのモーラ情報

type TimingMora = {
  text: string
  consonant: string | null
  consonant_length: number | null
  vowel: string
  vowel_length: number
}

// VOICEVOXのアクセント句情報

type TimingAccentPhrase = {
  moras: TimingMora[]
  pause_mora: TimingMora | null
}

// VOICEVOXの音声クエリ情報

type TimingAudioQuery = {
  accent_phrases: TimingAccentPhrase[]
  pre_phoneme_length?: number
  post_phoneme_length?: number
}

// 読み上げ速度

const TIMING_SPEED_SCALE = 0.74

// ポーズ時間の補正倍率

const TIMING_PAUSE_LENGTH_SCALE = 1.1

// 音声開始前の時間

const TIMING_PRE_PHONEME_LENGTH = 0.2

// 長音の母音長補正倍率

const LONG_VOWEL_LENGTH_SCALE = 1.3

// 短縮対象の母音

const NOISY_VOWELS = ['a', 'u']

// 短縮対象の母音長補正倍率

const NOISY_VOWEL_LENGTH_SCALE = 0.75

// 短縮対象の母音長上限

const NOISY_VOWEL_LENGTH_LIMIT = 0.1

// 写真ファイル名

const PHOTO_FILENAME_PATTERN = /^photo\d+\.jpg$/

// データベースを初期化する

migrate()

// Honoアプリを作成する

const app = new Hono()

// CORSを設定する

app.use(
  '/*',
  cors({
    origin: ['http://localhost:1420', 'tauri://localhost'],
  })
)

// 音声プロファイルを取得する

function toVoiceProfile(value: unknown): VoiceProfile | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const { averageLevel, levelVariation } = value as Record<string, unknown>

  if (typeof averageLevel !== 'number' || typeof levelVariation !== 'number') {
    return undefined
  }

  return { averageLevel, levelVariation }
}

// VOICEVOXのaudio_queryを取得する

async function requestTimingQuery(text: string): Promise<TimingAudioQuery> {
  const response = await fetch(
    `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER_ID}`,
    {
      method: 'POST',
    }
  ).catch(() => {
    throw new VoicevoxError('VOICEVOXに接続できませんでした')
  })

  if (!response.ok) {
    throw new VoicevoxError(`audio_query に失敗しました(${response.status})`)
  }

  return (await response.json()) as TimingAudioQuery
}

// 長音かどうかを判定する

function isLongVowel(mora: TimingMora, previous: TimingMora | undefined): boolean {
  if (!previous || mora.consonant !== null) {
    return false
  }

  return mora.vowel === previous.vowel
}

// 長音の母音長を調整する

function adjustLongVowels(moras: TimingMora[]): void {
  for (let index = 0; index < moras.length; index += 1) {
    const mora = moras[index]

    if (!isLongVowel(mora, moras[index - 1])) {
      continue
    }

    mora.vowel_length *= NOISY_VOWELS.includes(mora.vowel)
      ? NOISY_VOWEL_LENGTH_SCALE
      : LONG_VOWEL_LENGTH_SCALE
  }
}

// 特定の母音の長さを制限する

function limitNoisyVowels(moras: TimingMora[]): void {
  for (const mora of moras) {
    if (!NOISY_VOWELS.includes(mora.vowel)) {
      continue
    }

    mora.vowel_length = Math.min(mora.vowel_length, NOISY_VOWEL_LENGTH_LIMIT)
  }
}

// モーラ1つ分の発話時間を取得する

function getMoraDuration(mora: TimingMora): number {
  const consonantLength =
    typeof mora.consonant_length === 'number' && Number.isFinite(mora.consonant_length)
      ? mora.consonant_length
      : 0

  const vowelLength =
    typeof mora.vowel_length === 'number' && Number.isFinite(mora.vowel_length)
      ? mora.vowel_length
      : 0

  return consonantLength + vowelLength
}

// 文字ごとの発話タイミングを取得する

async function createNarrationTimings(text: string): Promise<NarrationTiming[]> {
  if (text.length === 0) {
    return []
  }

  const query = await requestTimingQuery(text)

  const timings: NarrationTiming[] = text.split('').map((_, index) => ({
    index,
    start: TIMING_PRE_PHONEME_LENGTH,
    end: TIMING_PRE_PHONEME_LENGTH,
  }))

  const characterDurations: number[] = Array.from({ length: text.length }, () => 0)
  const characterPauses: number[] = Array.from({ length: text.length }, () => 0)

  // 「、」「。」は発話文字に含めず、直前の発話と次の発話の間に置く

  const punctuationIndices = new Set<number>()

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '、' || text[index] === '。') {
      punctuationIndices.add(index)
    }
  }

  // VOICEVOXのモーラを発話文字に順番に割り当てる

  let characterIndex = 0

  for (const phrase of query.accent_phrases) {
    adjustLongVowels(phrase.moras)
    limitNoisyVowels(phrase.moras)

    for (const mora of phrase.moras) {
      while (characterIndex < text.length && punctuationIndices.has(characterIndex)) {
        characterIndex += 1
      }

      if (characterIndex >= text.length) {
        break
      }

      characterDurations[characterIndex] =
        (characterDurations[characterIndex] ?? 0) + getMoraDuration(mora)

      characterIndex += 1
    }

    // 句の間のポーズは次の発話文字が始まる前に置く

    if (phrase.pause_mora) {
      const pauseDuration = getMoraDuration(phrase.pause_mora) * TIMING_PAUSE_LENGTH_SCALE

      let nextCharacterIndex = characterIndex

      while (nextCharacterIndex < text.length && punctuationIndices.has(nextCharacterIndex)) {
        nextCharacterIndex += 1
      }

      if (nextCharacterIndex < text.length) {
        characterPauses[nextCharacterIndex] =
          (characterPauses[nextCharacterIndex] ?? 0) + pauseDuration
      }
    }
  }

  const phonemeDuration = characterDurations.reduce((total, duration) => total + duration, 0)

  if (phonemeDuration <= 0) {
    return timings
  }

  const prePhonemeLength =
    typeof query.pre_phoneme_length === 'number' && Number.isFinite(query.pre_phoneme_length)
      ? query.pre_phoneme_length
      : TIMING_PRE_PHONEME_LENGTH

  const postPhonemeLength =
    typeof query.post_phoneme_length === 'number' && Number.isFinite(query.post_phoneme_length)
      ? query.post_phoneme_length
      : 0

  // VOICEVOXの実際の発話時間に合わせてモーラの長さを伸ばす

  const pauseDuration = characterPauses.reduce((total, duration) => total + duration, 0)

  const targetDuration =
    phonemeDuration / TIMING_SPEED_SCALE +
    pauseDuration / TIMING_SPEED_SCALE +
    prePhonemeLength +
    postPhonemeLength

  const rawDuration = phonemeDuration + pauseDuration + prePhonemeLength + postPhonemeLength

  const scale = rawDuration > 0 ? targetDuration / rawDuration : 1

  let currentTime = prePhonemeLength

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    // 「、」「。」は次の音が始まる直前に表示する

    if (character === '、' || character === '。') {
      timings[index] = {
        index,
        start: currentTime,
        end: currentTime,
      }

      continue
    }

    // 次の発話文字の前に句読点のポーズを反映する

    currentTime += (characterPauses[index] ?? 0) * scale

    const duration = (characterDurations[index] ?? 0) * scale

    const start = currentTime
    const end = start + duration

    timings[index] = {
      index,
      start,
      end,
    }

    currentTime = end
  }

  return timings
}

// ヘルスチェック

app.get('/health', (c) => {
  return c.json({ status: 'ok' }, 200)
})

// 音声を文字起こしする

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

// 物語を生成する

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

// タグを抽出する

app.post('/extract-tags', async (c) => {
  const body = (await c.req.json().catch(() => null)) as ExtractTagsRequest | null

  if (!body || typeof body.text !== 'string' || body.text.trim().length === 0) {
    return c.json({ error: '入力テキストが空です' }, 400)
  }

  try {
    const tags = await extractTags(body.text, {
      profile: toVoiceProfile(body.voice),
    })

    return c.json({ tags }, 200)
  } catch (err) {
    if (err instanceof TagExtractionError) {
      return c.json({ error: err.message }, 500)
    }

    return c.json({ error: 'タグの抽出に失敗しました' }, 500)
  }
})

// 音声を生成する

app.post('/tts', async (c) => {
  const body = (await c.req.json().catch(() => null)) as TtsRequest | null

  if (!body || typeof body.text !== 'string' || body.text.trim().length === 0) {
    return c.json({ error: '入力テキストが空です' }, 400)
  }

  try {
    const audio = await synthesize(body.text)

    return new Response(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
      },
    })
  } catch (err) {
    if (err instanceof VoicevoxError) {
      return c.json({ error: err.message }, 500)
    }

    return c.json({ error: '音声の生成に失敗しました' }, 500)
  }
})

// 文字表示用の発話タイミングを取得する

app.post('/tts-timings', async (c) => {
  const body = (await c.req.json().catch(() => null)) as TtsTimingsRequest | null

  if (!body || typeof body.text !== 'string' || body.text.trim().length === 0) {
    return c.json({ error: '入力テキストが空です' }, 400)
  }

  try {
    const timings = await createNarrationTimings(body.text)

    return c.json({ timings }, 200)
  } catch (err) {
    if (err instanceof VoicevoxError) {
      return c.json({ error: err.message }, 500)
    }

    return c.json({ error: '文字表示用のタイミング取得に失敗しました' }, 500)
  }
})

// 日記を新規保存する

app.post('/entries', async (c) => {
  const form = await c.req.parseBody({ all: true }).catch(() => null)

  if (!form) {
    return c.json({ error: 'リクエストの形式が不正です' }, 400)
  }

  const tagsRaw = form.tags
  let tagsValue: unknown = undefined

  // タグJSONを解析する

  if (typeof tagsRaw === 'string') {
    try {
      tagsValue = JSON.parse(tagsRaw)
    } catch {
      return c.json({ error: 'tagsの形式が不正です' }, 400)
    }
  }

  // 日記入力値を検証する

  const parsed = CreateEntryFieldsSchema.safeParse({
    input_type: form.input_type,
    raw_input_text: form.raw_input_text,
    story_text: form.story_text,
    tags: tagsValue,
  })

  if (!parsed.success) {
    return c.json({ error: '日記の内容が不正です' }, 400)
  }

  // ナレーションファイルを取得する

  const narrationFile = form.narration instanceof File ? form.narration : undefined

  // 写真ファイルを取得する

  const photoFiles = Array.isArray(form.photos)
    ? form.photos.filter((item): item is File => item instanceof File)
    : form.photos instanceof File
      ? [form.photos]
      : []

  try {
    // 日記をデータベースに保存する

    const entry = createEntry(parsed.data)

    // ナレーションを保存する

    const savedNarrationPath = narrationFile ? await saveNarration(entry.id, narrationFile) : null

    // 写真を保存する

    const savedPhotoPaths = photoFiles.length > 0 ? await savePhotos(entry.id, photoFiles) : []

    // メディアパスを更新する

    if (savedNarrationPath || savedPhotoPaths.length > 0) {
      updateEntryMediaPaths(entry.id, savedNarrationPath, savedPhotoPaths)
    }

    return c.json(
      {
        entry: {
          ...entry,
          narration_path: savedNarrationPath,
          photo_paths: savedPhotoPaths,
        },
      },
      201
    )
  } catch {
    return c.json({ error: '日記の保存に失敗しました' }, 500)
  }
})

// 日記一覧を取得する

app.get('/entries', (c) => {
  const query = {
    scene: c.req.query('scene'),
    emotions: c.req.queries('emotion'),
    month: c.req.query('month'),
  }

  // 一覧取得条件を検証する

  const parsed = ListEntriesQuerySchema.safeParse(query)

  if (!parsed.success) {
    return c.json({ error: '絞り込み条件が不正です' }, 400)
  }

  try {
    // 日記一覧を取得する

    const entries = listEntries(parsed.data)

    return c.json({ entries }, 200)
  } catch {
    return c.json({ error: '日記の取得に失敗しました' }, 500)
  }
})

// 日記のナレーション音声を取得する

app.get('/entries/:id/narration', async (c) => {
  const id = c.req.param('id')
  const entry = getEntry(id)

  if (!entry || !entry.narration_path) {
    return c.json({ error: '読み上げ音声が見つかりません' }, 404)
  }

  // ナレーションファイルを取得する

  const file = Bun.file(narrationPath(id))

  if (!(await file.exists())) {
    return c.json({ error: '読み上げ音声が見つかりません' }, 404)
  }

  return new Response(file, {
    status: 200,
    headers: {
      'Content-Type': 'audio/wav',
    },
  })
})

// 日記の写真を取得する

app.get('/entries/:id/photos/:filename', async (c) => {
  const id = c.req.param('id')
  const filename = c.req.param('filename')

  // 写真ファイル名を検証する

  if (!PHOTO_FILENAME_PATTERN.test(filename)) {
    return c.json({ error: '写真が見つかりません' }, 404)
  }

  // 日記の存在を確認する

  const entry = getEntry(id)

  if (!entry) {
    return c.json({ error: '写真が見つかりません' }, 404)
  }

  // 写真ファイルを取得する

  const file = Bun.file(photoPath(id, filename))

  if (!(await file.exists())) {
    return c.json({ error: '写真が見つかりません' }, 404)
  }

  return new Response(file, {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
    },
  })
})

// 日記を1件取得する

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

// 日記を更新する

app.patch('/entries/:id', async (c) => {
  const id = c.req.param('id')
  const existing = getEntry(id)

  // 更新対象の日記を確認する

  if (!existing) {
    return c.json({ error: '日記が見つかりません' }, 404)
  }

  const form = await c.req.parseBody({ all: true }).catch(() => null)

  if (!form) {
    return c.json({ error: 'リクエストの形式が不正です' }, 400)
  }

  const tagsRaw = form.tags
  let tagsValue: unknown = undefined

  // タグJSONを解析する

  if (typeof tagsRaw === 'string') {
    try {
      tagsValue = JSON.parse(tagsRaw)
    } catch {
      return c.json({ error: 'tagsの形式が不正です' }, 400)
    }
  }

  // 日記更新値を検証する

  const parsed = UpdateEntryFieldsSchema.safeParse({
    story_text: typeof form.story_text === 'string' ? form.story_text : undefined,
    tags: tagsValue,
  })

  if (!parsed.success) {
    return c.json({ error: '日記の内容が不正です' }, 400)
  }

  // ナレーションファイルを取得する

  const narrationFile = form.narration instanceof File ? form.narration : undefined

  // 写真ファイルを取得する

  const photoFiles = Array.isArray(form.photos)
    ? form.photos.filter((item): item is File => item instanceof File)
    : form.photos instanceof File
      ? [form.photos]
      : []

  // 写真削除指定を取得する

  const shouldClearPhotos = form.clear_photos === 'true'

  try {
    // 日記本文とタグを更新する

    updateEntry(id, parsed.data)

    let savedNarrationPath = existing.narration_path
    let savedPhotoPaths = existing.photo_paths

    // ナレーションを更新する

    if (narrationFile) {
      savedNarrationPath = await saveNarration(id, narrationFile)
    }

    // 写真を更新する

    if (photoFiles.length > 0) {
      removePhotos(id)
      savedPhotoPaths = await savePhotos(id, photoFiles)
    } else if (shouldClearPhotos) {
      // 写真を削除する

      removePhotos(id)
      savedPhotoPaths = []
    }

    // メディアパスを更新する

    updateEntryMediaPaths(id, savedNarrationPath, savedPhotoPaths)

    // 更新後の日記を取得する

    const entry = getEntry(id)

    return c.json({ entry }, 200)
  } catch {
    return c.json({ error: '日記の更新に失敗しました' }, 500)
  }
})

// 日記を削除する

app.delete('/entries/:id', (c) => {
  try {
    const id = c.req.param('id')

    // 日記を削除する

    const deleted = deleteEntry(id)

    if (!deleted) {
      return c.json({ error: '日記が見つかりません' }, 404)
    }

    // 日記に紐づくメディアを削除する

    removeMedia(id)

    return c.json({ ok: true }, 200)
  } catch {
    return c.json({ error: '日記の削除に失敗しました' }, 200)
  }
})

// Bunサーバーを起動する

export default {
  port: 3000,
  hostname: '127.0.0.1',
  fetch: app.fetch,
}
