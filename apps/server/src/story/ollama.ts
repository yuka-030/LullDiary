// apps/server/src/story/ollama.ts

/** OllamaのローカルAPI。既定ポートで動作している前提 */
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'

/** 物語生成に使用するモデル */
const MODEL = process.env.OLLAMA_MODEL ?? 'gemma2:2b'

/** Ollamaの生成APIが返すレスポンス */
type OllamaGenerateResponse = {
  response?: unknown
}

export class OllamaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OllamaError'
  }
}

/**
 * 物語生成のプロンプト。
 * トーン・締めの型は requirements.md の世界観要件に基づく。
 * 詳細な調整は #20 で行う。
 */
function buildPrompt(input: string): string {
  return `あなたは、子供に寝る前の読み聞かせをする、優しいお母さんのような語り部です。
以下の「今日あった出来事」をもとに、短い物語を作ってください。

【ルール】
- 優しく温かい語り口で、短い文を使うこと
- 擬音語や擬態語を適度に使うこと(例:そよそよ、ぽかぽか)
- 嫌な出来事や悲しい出来事が含まれる場合は、まずその気持ちを
  「そうだったんだね」と一度受け止めてから、優しい着地に導くこと
  (いきなり前向きに変換しない)
- 教訓めいた説教("だから次はこうしよう"等)は入れないこと
- 最後は必ず「今日も一日おつかれさま。おやすみなさい」で締めること
- 文章の長さは300字程度を目安にすること
- 物語の本文のみを出力し、前置きや説明は書かないこと

【今日あった出来事】
${input}`
}

/**
 * 入力テキストから物語文を生成する。
 */
export async function generateStory(input: string): Promise<string> {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: buildPrompt(input),
      stream: false,
    }),
  }).catch(() => {
    throw new OllamaError('Ollamaに接続できませんでした')
  })

  if (!response.ok) {
    throw new OllamaError(`Ollamaの応答が不正です(${response.status})`)
  }

  const body = (await response.json()) as OllamaGenerateResponse

  if (typeof body.response !== 'string') {
    throw new OllamaError('Ollamaの応答形式が想定と異なります')
  }

  return body.response.trim()
}
