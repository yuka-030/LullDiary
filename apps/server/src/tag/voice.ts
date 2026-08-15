// apps/server/src/tag/voice.ts

// 話し方の特徴
export type VoiceProfile = {
  // 発話中の平均音量(0〜1)
  averageLevel: number
  // 音量の変動の大きさ
  levelVariation: number
}

// 声が大きいとみなす境界
const LOUD_LEVEL = 0.08

// 抑揚があるとみなす境界
const VARIED_VARIATION = 0.03

// 気持ちの方向を示さない感情
const NEUTRAL_EMOTIONS = ['驚き']

// 声が高ぶっている場合に加える感情
const LIVELY_EMOTION = '嬉しい'

// テキストから抽出した感情を、話し方をもとに補正する
export function adjustEmotions<T extends string>(
  emotions: T[],
  profile: VoiceProfile
): (T | typeof LIVELY_EMOTION)[] {
  const isLively = profile.averageLevel >= LOUD_LEVEL && profile.levelVariation >= VARIED_VARIATION

  const hasNeutralOnly =
    emotions.length > 0 && emotions.every((emotion) => NEUTRAL_EMOTIONS.includes(emotion))

  if (isLively && hasNeutralOnly) {
    return [...emotions, LIVELY_EMOTION]
  }

  return emotions
}
