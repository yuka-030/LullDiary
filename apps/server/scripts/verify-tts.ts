// apps/server/scripts/verify-tts.ts
import { synthesize } from '../src/tts/voicevox'

const TEXT =
  '今日は、朝から開発の作業をしていた日でした。パソコンの前で、コードと向き合います。明日は、もう少し進められたらいいですね。'

async function main() {
  const audio = await synthesize(TEXT)
  await Bun.write('verify-tts.wav', audio)

  console.log('生成しました: verify-tts.wav')
}

main()
