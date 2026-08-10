// apps/server/src/tag/ollama.ts
import { adjustEmotions, type VoiceProfile } from './voice'

/** OllamaのローカルAPI */
const OLLAMA_URL = process.env.OLLAMA_URL

/** タグ抽出に使用するモデル。抽出ルールは Modelfile.tag 側で定義している */
const MODEL = process.env.OLLAMA_TAG_MODEL

if (!OLLAMA_URL) {
  throw new Error('OLLAMA_URL が設定されていません')
}

if (!MODEL) {
  throw new Error('OLLAMA_TAG_MODEL が設定されていません')
}

/**
 * タグの選択肢。
 * 挿絵は人物を描かず情景と雰囲気のみを扱う方針のため、シーンと感情の2軸としている。
 * シーンは挿絵の背景として絵が変わる単位で分け、感情は他の語に含められるものを設けていない。
 */
export const TAG_OPTIONS = {
  シーン: ['家', '職場', '学校', 'お店', '移動中', '自然', '病院', 'その他'],
  感情: [
    '嬉しい',
    '楽しい',
    '悲しい',
    '悔しい',
    '怒り',
    '安心',
    '穏やか',
    '不安',
    '驚き',
    '疲れた',
    'もやもや',
  ],
} as const

/** どの場所がどのシーンにあたるかの目安 */
const SCENE_HINTS: Record<string, string> = {
  家: '自宅、部屋、庭など',
  職場: '会社、仕事場、在宅勤務中など',
  学校: '教室、校庭、保育園、習い事など',
  お店: 'カフェ、レストラン、買い物先など',
  移動中: '電車、車、歩いている時など',
  自然: '公園、海、山、散歩道など',
  病院: '通院、検査、看病など',
  その他: '上のどれにも当てはまらない場所',
}

/** どの言葉がどの感情にあたるかの目安。近い感情の取り違えを防ぐために示す */
const EMOTION_HINTS: Record<string, string> = {
  嬉しい: 'よかった、ありがたい、誇らしい、報われた',
  楽しい: '面白かった、笑った、夢中になった、わくわくした',
  悲しい: '寂しい、つらい、泣きたい、痛かった、残念だった',
  悔しい: '納得できない、うまくいかなかった、自分が情けない',
  怒り: '腹が立つ、許せない、理不尽だ',
  安心: 'ほっとした、心配が消えた、無事でよかった',
  穏やか: 'のんびりした、落ち着いた、ゆっくりできた、静かだった',
  不安: '心配だ、怖い、どうなるか分からない',
  驚き: 'びっくりした、思いがけなかった、意外だった',
  疲れた: 'へとへと、力が出ない、体がしんどい',
  もやもや: '嫌になった、面倒だった、割り切れない、すっきりしない',
}

export type Tags = {
  シーン: string
  感情: string[]
}

export type { VoiceProfile }

/** Ollamaの生成APIが返すレスポンス */
type OllamaGenerateResponse = {
  response?: unknown
}

export class TagExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TagExtractionError'
  }
}

/** 目安を「名前: 内容」の形に並べる */
function formatHints(hints: Record<string, string>): string {
  return Object.entries(hints)
    .map(([name, hint]) => `${name}: ${hint}`)
    .join('\n')
}

function buildPrompt(input: string): string {
  return `次の文章から、指定された選択肢の中だけを使ってタグを抽出してください。

【選択肢】
シーン: ${TAG_OPTIONS.シーン.join(' / ')}
感情(複数可): ${TAG_OPTIONS.感情.join(' / ')}

【シーンの目安】
${formatHints(SCENE_HINTS)}

【感情の目安】
${formatHints(EMOTION_HINTS)}

【出力形式】
{"シーン": "", "感情": []}

【文章】
${input}`
}

/** 選択肢に含まれない値を除いた配列を返す */
function keepValidValues(values: unknown, options: readonly string[]): string[] {
  if (!Array.isArray(values)) {
    return []
  }
  return values.filter(
    (value): value is string => typeof value === 'string' && options.includes(value)
  )
}

/** 選択肢に含まれていれば返し、含まれなければ「その他」を返す */
function keepValidScene(value: unknown): string {
  return typeof value === 'string' && TAG_OPTIONS.シーン.includes(value as never) ? value : 'その他'
}

/**
 * モデルの出力からタグを組み立てる。
 * 選択肢にない値が返る場合があるため、ここで取り除く。
 */
function parseTags(raw: string): Tags {
  /** コードフェンスが付く場合があるため、最初の波括弧から最後の波括弧までを取り出す */
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')

  if (start === -1 || end === -1) {
    throw new TagExtractionError('JSON形式の出力が得られませんでした')
  }

  const parsed = JSON.parse(raw.slice(start, end + 1))

  return {
    シーン: keepValidScene(parsed.シーン),
    感情: keepValidValues(parsed.感情, TAG_OPTIONS.感情),
  }
}

/**
 * 入力テキストからタグを抽出する。
 *
 * 音声入力の場合は、話し方の特徴をもとに感情を補正する。
 * 話し方の情報をプロンプトに渡してもモデルが利用しなかったため、
 * 音量という数値から判定できる部分はコード側で扱う設計にしている。
 *
 * JSONのパースに失敗する場合があるため、指定回数まで再試行する。
 */
export async function extractTags(
  input: string,
  profile?: VoiceProfile,
  retryCount = 2
): Promise<Tags> {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: buildPrompt(input),
      stream: false,
      format: 'json',
    }),
  }).catch(() => {
    throw new TagExtractionError('Ollamaに接続できませんでした')
  })

  if (!response.ok) {
    throw new TagExtractionError(`Ollamaの応答が不正です(${response.status})`)
  }

  const body = (await response.json()) as OllamaGenerateResponse

  if (typeof body.response !== 'string') {
    throw new TagExtractionError('Ollamaの応答形式が想定と異なります')
  }

  try {
    const tags = parseTags(body.response)

    return profile ? { ...tags, 感情: adjustEmotions(tags.感情, profile) } : tags
  } catch (err) {
    if (retryCount > 0) {
      return extractTags(input, profile, retryCount - 1)
    }
    throw err instanceof TagExtractionError
      ? err
      : new TagExtractionError('タグの抽出に失敗しました')
  }
}
