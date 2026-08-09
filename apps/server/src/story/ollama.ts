// apps/server/src/story/ollama.ts

/** OllamaのローカルAPI */
const OLLAMA_URL = process.env.OLLAMA_URL

/** 物語生成に使用するモデル。語り手の設定とパラメータは Modelfile 側で定義している */
const MODEL = process.env.OLLAMA_MODEL

if (!OLLAMA_URL) {
  throw new Error('OLLAMA_URL が設定されていません')
}

if (!MODEL) {
  throw new Error('OLLAMA_MODEL が設定されていません')
}

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
 * 結末の型に引きずられないよう、締め方の異なる例を二つ示す。
 */
function buildPrompt(input: string): string {
  return `次の文章を、読み聞かせのような語り口に書き直してください。

例を二つ見せます。

元の文章:
今日は友達と公園に行った。ブランコで遊んだけど、途中で転んで膝をすりむいた。痛かったけど楽しかった。

書き直した文章:
今日は、お友だちと公園へ出かけた日でした。
ブランコに座って、二人で並んで揺れました。
そんな途中で、転んでしまいました。膝を、すりむいてしまったのです。
じんじんと痛みました。痛かったですね。
それでも、楽しい一日でした。

元の文章:
今日は一日中、部屋の片づけをした。思ったより物が多くて、途中で嫌になった。結局終わらなかった。

書き直した文章:
今日は、部屋の片づけをした一日でした。
引き出しを開けると、しまい込んでいたものが次々に出てきます。思っていたよりも、ずっとたくさんありました。
途中で、嫌になってしまいました。
結局、片づけは終わらないまま、一日が過ぎていきました。

同じように書き直してください。書き直した文章だけを出力してください。

元の文章:
${input}

書き直した文章:
`
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
