// apps/desktop/src/lib/bookshelf/entryTypes.ts
import type { Tags } from '../shared/entryClient'

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

// 保存済みの日記
export type Entry = {
  id: string
  created_at: string
  input_type: 'voice' | 'text'
  raw_input_text: string
  story_text: string
  narration_path: string | null
  tags: Tags
  photo_paths: string[]
}

// 一覧の絞り込み条件
export type EntryFilter = {
  year?: number
  month?: number
  scene?: string
  emotions: string[]
}

// 月ごとにまとめた日記
export type MonthlyBook = {
  // 年月(YYYY-MM)
  month: string
  year: number
  monthNumber: number
  entries: Entry[]
}

// 日記を月ごとにまとめる
export function groupByMonth(entries: Entry[]): MonthlyBook[] {
  const books = new Map<string, Entry[]>()

  for (const entry of entries) {
    const month = entry.created_at.slice(0, 7)
    const grouped = books.get(month)

    if (grouped) {
      grouped.push(entry)
    } else {
      books.set(month, [entry])
    }
  }

  return [...books.entries()]
    .map(([month, grouped]) => ({
      month,
      year: Number(month.slice(0, 4)),
      monthNumber: Number(month.slice(5, 7)),
      entries: grouped,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

// 日記のある年を新しい順に取り出す
export function collectYears(books: MonthlyBook[]): number[] {
  return [...new Set(books.map((book) => book.year))].sort((a, b) => b - a)
}
