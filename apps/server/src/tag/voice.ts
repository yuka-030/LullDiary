// apps/server/src/tag/voice.ts

/**
 * 話し方の特徴。
 * テキストだけでは同じ言葉でも気持ちが判別できないため、補助的な手がかりとして使う。
 */
export type VoiceProfile = {
  /** 発話中の平均音量(0〜1) */
  averageLevel: number
  /** 音量の変動の大きさ。抑揚があるほど大きくなる */
  levelVariation: number
}

/** 声が大きいとみなす境界 */
const LOUD_LEVEL = 0.08

/** 抑揚があるとみなす境界 */
const VARIED_VARIATION = 0.03

/** どちらとも言えない感情 */
const NEUTRAL_EMOTIONS = ['驚き']

/**
 * テキストから抽出した感情を、話し方をもとに補正する。
 *
 * 音量から読み取れるのは気持ちの高ぶりまでであり、沈んだ気持ちの中身までは
 * 判別できない。誤った感情を付けると記録として不自然になるため、
 * 中立的な感情しかない場合に、声が高ぶっていれば上向きの感情を足すことに限定している。
 */
export function adjustEmotions(emotions: string[], profile: VoiceProfile): string[] {
  const isLively = profile.averageLevel >= LOUD_LEVEL && profile.levelVariation >= VARIED_VARIATION

  const hasNeutralOnly =
    emotions.length > 0 && emotions.every((emotion) => NEUTRAL_EMOTIONS.includes(emotion))

  if (isLively && hasNeutralOnly) {
    return [...emotions, '嬉しい']
  }

  return emotions
}
