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

// audio_query が返す読み方の情報
type AudioQuery = Record<string, unknown>

export class VoicevoxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VoicevoxError'
  }
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

  const query = (await queryResponse.json()) as AudioQuery

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
