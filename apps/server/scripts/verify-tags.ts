// apps/server/scripts/verify-tags.ts
import { extractTags } from '../src/tag/ollama'
import type { VoiceProfile } from '../src/tag/voice'

/** 声が小さく単調な話し方 */
const quietVoice: VoiceProfile = { averageLevel: 0.03, levelVariation: 0.01 }

/** 声が大きく抑揚のある話し方 */
const livelyVoice: VoiceProfile = { averageLevel: 0.2, levelVariation: 0.08 }

const cases: { input: string; profile?: VoiceProfile; label: string }[] = [
  {
    input: '今日は公園で友達とブランコに乗った。楽しかったけど、転んで膝をすりむいた。',
    label: '音声なし',
  },
  {
    input: '職場で提出した資料にミスがあった。上司に指摘されて、とても悔しかった。',
    label: '音声なし',
  },
  {
    input: '一日中ひとりで部屋の片づけをしていた。思ったより物が多くて、途中で嫌になった。',
    label: '音声なし',
  },
  {
    input: '久しぶりにカフェでゆっくりした。窓際の席で本を読んで、落ち着いた時間だった。',
    label: '音声なし',
  },
  { input: 'スーパーで買い物をしていたら、久しぶりの友人に会って驚いた。', label: '音声なし' },
  {
    input: 'スーパーで買い物をしていたら、久しぶりの友人に会って驚いた。',
    profile: quietVoice,
    label: '声が小さく単調',
  },
  {
    input: 'スーパーで買い物をしていたら、久しぶりの友人に会って驚いた。',
    profile: livelyVoice,
    label: '声が大きく抑揚あり',
  },
]

for (const { input, profile, label } of cases) {
  console.log('---')
  console.log('入力:', input)
  console.log('条件:', label)

  try {
    const tags = await extractTags(input, profile)
    console.log('タグ:', JSON.stringify(tags, null, 2))
  } catch (err) {
    console.log('エラー:', err instanceof Error ? err.message : String(err))
  }
}
