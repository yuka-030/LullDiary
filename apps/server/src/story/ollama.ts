// apps/server/src/story/ollama.ts

// Ollamaの生成APIが返すレスポンス
type OllamaGenerateResponse = {
  response?: unknown
}

export class OllamaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OllamaError'
  }
}

// 物語生成のプロンプト
function buildStoryPrompt(input: string): string {
  return `次の文章を、読み聞かせのような語り口に書き直してください。

例を二つ見せます。

元の文章:
今日は友達と公園に行った。ブランコで遊んだけど、途中で転んで膝をすりむいた。痛かったけど楽しかった。

書き直した文章:
今日は、お友だちと公園へ出かけた日でした。
ブランコに座って、二人で並んで揺れました。
そんな途中で、転んでしまいました。膝を、すりむいてしまいました。
じんじんと痛みました。
それでも、楽しい一日でした。

元の文章:
今日は一日中、部屋の片づけをした。思ったより物が多くて、途中で嫌になった。またそのうちやろうと思う。

書き直した文章:
今日は、部屋の片づけをした一日でした。
引き出しを開けると、しまい込んでいたものが次々に出てきます。思っていたよりも、ずっとたくさんありました。
途中で、嫌になってしまいました。
またそのうちやろうと思いました。

同じように書き直してください。書き直した文章だけを出力してください。

元の文章:
${input}

書き直した文章:
`
}

// 添削のプロンプト
function buildPolishPrompt(story: string): string {
  return `次の文章を、ルールに沿って直してください。直した文章だけを出力してください。

文章:
${story}

直した文章:
`
}

// Ollamaへの生成要求
async function generate(model: string, prompt: string): Promise<string> {
  const url = process.env.OLLAMA_URL

  if (!url) {
    throw new OllamaError('OLLAMA_URL が設定されていません')
  }

  const response = await fetch(`${url}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
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

// 入力テキストから物語文を生成し、ルールに沿って整える
export async function generateStory(input: string): Promise<string> {
  const storyModel = process.env.OLLAMA_MODEL
  const polishModel = process.env.OLLAMA_POLISH_MODEL

  if (!storyModel) {
    throw new OllamaError('OLLAMA_MODEL が設定されていません')
  }

  if (!polishModel) {
    throw new OllamaError('OLLAMA_POLISH_MODEL が設定されていません')
  }

  const story = await generate(storyModel, buildStoryPrompt(input))

  return generate(polishModel, buildPolishPrompt(story))
}
