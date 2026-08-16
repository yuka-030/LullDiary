// apps/server/scripts/verify-tts.ts

// VOICEVOXのローカルAPI
const VOICEVOX_URL = process.env.VOICEVOX_URL

if (!VOICEVOX_URL) {
  throw new Error('VOICEVOX_URL が設定されていません')
}

// 暁記ミタマ ノーマル
const SPEAKER_ID = 122

// 読み上げの調整値
const VOICE_SETTINGS = {
  speedScale: 0.75,
  pitchScale: 0.035,
  intonationScale: 1.55,
  volumeScale: 0.85,
  pauseLengthScale: 1.0,
  postPhonemeLength: 0.35,
}

const TEXT =
  '今日は、朝から開発の作業をしていた日でした。パソコンの前で、コードと向き合います。明日は、もう少し進められたらいいですね。'

// audio_query が返す読み方の情報
type AudioQuery = Record<string, unknown>

async function main() {
  // 読み方の情報を作る
  const queryResponse = await fetch(
    `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(TEXT)}&speaker=${SPEAKER_ID}`,
    { method: 'POST' }
  )

  if (!queryResponse.ok) {
    console.error('audio_query に失敗しました:', queryResponse.status)
    return
  }

  const query = (await queryResponse.json()) as AudioQuery

  // 音声に変換する
  const synthesisResponse = await fetch(`${VOICEVOX_URL}/synthesis?speaker=${SPEAKER_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...query, ...VOICE_SETTINGS }),
  })

  if (!synthesisResponse.ok) {
    console.error('synthesis に失敗しました:', synthesisResponse.status)
    return
  }

  const audio = await synthesisResponse.arrayBuffer()
  await Bun.write('verify-tts.wav', audio)

  console.log('生成しました: verify-tts.wav')
}

main()
