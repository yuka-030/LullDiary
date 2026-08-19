// apps/server/src/tts/voicevox.ts

// VOICEVOXのローカルAPI
const VOICEVOX_URL = process.env.VOICEVOX_URL

if (!VOICEVOX_URL) {
  throw new Error('VOICEVOX_URL が設定されていません')
}

// 暁記ミタマ ノーマル
const SPEAKER_ID = 122

// 読み上げの調整値
const VOICE_SETTINGS = {
  speedScale: 0.74,
  pitchScale: 0.038,
  intonationScale: 1.55,
  volumeScale: 0.55,
  prePhonemeLength: 0.2,
  pauseLengthScale: 1.1,
  postPhonemeLength: 0.35,
}

// 長音の母音の倍率
const LONG_VOWEL_LENGTH_SCALE = 1.3

// ノイズが出やすい母音
const NOISY_VOWELS = ['a', 'u']

// ノイズが出やすい母音の長音の倍率
const NOISY_VOWEL_LENGTH_SCALE = 0.75

// ノイズが出やすい母音の長さの上限
const NOISY_VOWEL_LENGTH_LIMIT = 0.1

// モーラ1つ分の読み方の情報
type Mora = {
  text: string
  consonant: string | null
  consonant_length: number | null
  vowel: string
  vowel_length: number
  pitch: number
}

type AccentPhrase = {
  moras: Mora[]
  accent: number
  pause_mora: Mora | null
  is_interrogative?: boolean
}

// audio_query が返す読み方の情報
type AudioQuery = {
  accent_phrases: AccentPhrase[]
  [key: string]: unknown
}

export class VoicevoxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VoicevoxError'
  }
}

// 長音かどうかの判定
function isLongVowel(mora: Mora, previous: Mora | undefined): boolean {
  if (!previous || mora.consonant !== null) {
    return false
  }

  return mora.vowel === previous.vowel
}

// ピッチの欠損の判定
function isBrokenPitch(mora: Mora): boolean {
  return !Number.isFinite(mora.pitch) || mora.pitch <= 0
}

// 長音の母音の長さの調整
function adjustLongVowels(moras: Mora[]): void {
  for (let index = 0; index < moras.length; index += 1) {
    const mora = moras[index]

    if (!isLongVowel(mora, moras[index - 1])) {
      continue
    }

    // ノイズが出やすい母音とそれ以外で倍率を切り替え
    mora.vowel_length *= NOISY_VOWELS.includes(mora.vowel)
      ? NOISY_VOWEL_LENGTH_SCALE
      : LONG_VOWEL_LENGTH_SCALE
  }
}

// ノイズが出やすい母音の長さの制限
function limitNoisyVowels(moras: Mora[]): void {
  for (const mora of moras) {
    if (!NOISY_VOWELS.includes(mora.vowel)) {
      continue
    }

    mora.vowel_length = Math.min(mora.vowel_length, NOISY_VOWEL_LENGTH_LIMIT)
  }
}

// 長音のピッチの平滑化
function smoothLongVowelPitches(moras: Mora[]): void {
  for (let index = 0; index < moras.length; index += 1) {
    const mora = moras[index]
    const previous = moras[index - 1]

    if (!isLongVowel(mora, previous) || isBrokenPitch(mora) || isBrokenPitch(previous)) {
      continue
    }

    mora.pitch = (previous.pitch + mora.pitch) / 2
  }
}

// 欠損したピッチの線形補間
function interpolatePitches(moras: Mora[]): void {
  let index = 0

  while (index < moras.length) {
    if (!isBrokenPitch(moras[index])) {
      index += 1
      continue
    }

    // 欠損が続く範囲の最後を探す
    let end = index

    while (end < moras.length && isBrokenPitch(moras[end])) {
      end += 1
    }

    const before = index > 0 ? moras[index - 1].pitch : null
    const after = end < moras.length ? moras[end].pitch : null

    // 補間の基準が無い場合
    if (before === null && after === null) {
      index = end
      continue
    }

    const startPitch = before ?? (after as number)
    const endPitch = after ?? (before as number)
    const steps = end - index + 1

    // 欠損した範囲に補間値を入れる
    for (let offset = 0; offset < end - index; offset += 1) {
      const ratio = (offset + 1) / steps
      moras[index + offset].pitch = startPitch + (endPitch - startPitch) * ratio
    }

    index = end
  }
}

// 読み方の情報の加工
function smoothQuery(query: AudioQuery): AudioQuery {
  for (const phrase of query.accent_phrases) {
    adjustLongVowels(phrase.moras)
    limitNoisyVowels(phrase.moras)
    interpolatePitches(phrase.moras)
    smoothLongVowelPitches(phrase.moras)
  }

  return query
}

// 物語文から読み上げ音声を生成する
export async function synthesize(text: string): Promise<ArrayBuffer> {
  const queryResponse = await fetch(
    `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER_ID}`,
    { method: 'POST' }
  ).catch(() => {
    throw new VoicevoxError('VOICEVOXに接続できませんでした')
  })

  if (!queryResponse.ok) {
    throw new VoicevoxError(`audio_query に失敗しました(${queryResponse.status})`)
  }

  const query = smoothQuery((await queryResponse.json()) as AudioQuery)

  const synthesisResponse = await fetch(`${VOICEVOX_URL}/synthesis?speaker=${SPEAKER_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...query, ...VOICE_SETTINGS }),
  }).catch(() => {
    throw new VoicevoxError('VOICEVOXに接続できませんでした')
  })

  if (!synthesisResponse.ok) {
    throw new VoicevoxError(`synthesis に失敗しました(${synthesisResponse.status})`)
  }

  return synthesisResponse.arrayBuffer()
}
