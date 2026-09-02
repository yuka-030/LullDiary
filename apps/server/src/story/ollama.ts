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

例を四つ見せます。

元の文章:
今日は友達と公園に行った。ブランコで遊んだけど、途中で転んで膝をすりむいた。痛かったけど楽しかった。

書き直した文章:
今日は、お友だちと公園へ出かけた日でした。ブランコに座って、二人で並んで揺れます。ふとした拍子に、転んでしまいました。膝をすりむいて、じんじんと痛みます。それでも、楽しい一日でした。

元の文章:
今日は一日中、部屋の片づけをした。思ったより物が多くて、途中で嫌になった。またそのうちやろうと思う。

書き直した文章:
今日は、部屋の片づけをした一日でした。あちこちに散らばったものを、一つずつ手に取っては片付けていきます。思っていたよりも、ずっとたくさんありました。途中で、嫌になってしまいました。またそのうちやろうと思いました。

元の文章:
朝から歯医者に行きました。麻酔が効くまで待つ時間が長くて、そわそわしました。終わったあとは口の中が変な感じでした。

書き直した文章:
今日は、朝から歯医者へ行きました。診察台に座って麻酔をしてもらうと、効いてくるまでの時間は長くて、そわそわと落ち着かない気持ちになりました。ようやく治療が終わったあとは、口の中が変な感じが残っていました。

元の文章:
夕方にスーパーへ寄りました。買うつもりのなかったアイスをかごに入れてしまいました。帰ってすぐに食べました。

書き直した文章:
夕方になり、近くのスーパーへ足を運びました。並んだ商品を眺めながら歩いていると、ふと目に留まったアイスを、つい買うつもりもなくかごに入れてしまいました。家に帰ると、袋から取り出して、すぐにそのアイスを食べました。

同じように書き直してください。元の文章の最初から最後まで、すべての内容を含めてください。改行は入れず、適宜「、」と「。」を入れて、続けて書いてください。書き直した文章だけを出力してください。

元の文章:
${input}

書き直した文章:
`
}

// 添削のプロンプト
function buildPolishPrompt(input: string, story: string): string {
  return `書き直された文章を、元の文章と見比べて、ルールに沿って直してください。直した文章だけを出力してください。

元の文章:
${input}

書き直された文章:
${story}

直した文章:
`
}

// Ollamaへの生成要求
async function generate(model: string, prompt: string, seed: number): Promise<string> {
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
      options: { seed },
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
export async function generateStory(input: string, seed = 42): Promise<string> {
  const storyModel = process.env.OLLAMA_MODEL
  const polishModel = process.env.OLLAMA_POLISH_MODEL

  if (!storyModel) {
    throw new OllamaError('OLLAMA_MODEL が設定されていません')
  }

  if (!polishModel) {
    throw new OllamaError('OLLAMA_POLISH_MODEL が設定されていません')
  }

  const story = await generate(storyModel, buildStoryPrompt(input), seed)

  return generate(polishModel, buildPolishPrompt(input, story), seed)
}
