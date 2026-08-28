// apps/server/src/tag/ollama.ts
import { z } from 'zod'
import { adjustEmotions, type VoiceProfile } from './voice'

// タグの選択肢
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

// モデルの出力を検証するスキーマ
const TagsSchema = z.object({
  シーン: z.enum(TAG_OPTIONS.シーン),
  感情: z.array(z.enum(TAG_OPTIONS.感情)).min(1),
})

// シーンの選択の目安
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

// 感情の選択の目安
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

export type Tags = z.infer<typeof TagsSchema>

export type { VoiceProfile }

// Ollamaの生成APIが返すレスポンス
type OllamaGenerateResponse = {
  response?: unknown
}

// タグ抽出の設定
export type ExtractTagsOptions = {
  profile?: VoiceProfile
  maxAttempts?: number
  requestTags?: (input: string) => Promise<string>
}

export class TagExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TagExtractionError'
  }
}

// 目安を「名前: 内容」の形に並べる
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
{"シーン": "家", "感情": ["穏やか"]}

【文章】
${input}`
}

// モデルの出力からJSONを取り出し、スキーマで検証する
export function parseTags(raw: string): Tags {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')

  if (start === -1 || end === -1) {
    throw new TagExtractionError('JSON形式の出力が得られませんでした')
  }

  const parsed = JSON.parse(raw.slice(start, end + 1))

  return TagsSchema.parse(parsed)
}

// Ollamaにタグ抽出を依頼し、生の出力を受け取る
async function requestTagsFromOllama(input: string): Promise<string> {
  const url = process.env.OLLAMA_URL
  const model = process.env.OLLAMA_TAG_MODEL

  if (!url) {
    throw new TagExtractionError('OLLAMA_URL が設定されていません')
  }

  if (!model) {
    throw new TagExtractionError('OLLAMA_TAG_MODEL が設定されていません')
  }

  const response = await fetch(`${url}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
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

  return body.response
}

// 入力テキストからタグを抽出する
export async function extractTags(input: string, options: ExtractTagsOptions = {}): Promise<Tags> {
  const { profile, maxAttempts = 3, requestTags = requestTagsFromOllama } = options

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const raw = await requestTags(input)

    try {
      const tags = parseTags(raw)

      return profile ? { ...tags, 感情: adjustEmotions(tags.感情, profile) } : tags
    } catch {
      if (attempt === maxAttempts) {
        throw new TagExtractionError(`タグの抽出に失敗しました(${maxAttempts}回試行)`)
      }
    }
  }

  throw new TagExtractionError('タグの抽出に失敗しました')
}
