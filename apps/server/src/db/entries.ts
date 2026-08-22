// apps/server/src/db/entries.ts
import { db } from './client'
import { toEntry, type Entry, type EntryRow, type InputType, type Tags } from './schema'

// 作成時に受け取る値
export type CreateEntryInput = {
  input_type: InputType
  raw_input_text: string
  story_text: string
  narration_path?: string | null
  tags: Tags
  photo_paths?: string[]
}

// 一覧の絞り込み条件
export type ListEntriesFilter = {
  scene?: string
  emotions?: string[]
  month?: string
}

// 日記エントリの作成
export function createEntry(input: CreateEntryInput): Entry {
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  db.prepare(
    `INSERT INTO entries (
      id, created_at, input_type, raw_input_text, story_text,
      narration_path, tags, photo_paths
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`
  ).run(
    id,
    createdAt,
    input.input_type,
    input.raw_input_text,
    input.story_text,
    input.narration_path ?? null,
    JSON.stringify(input.tags),
    JSON.stringify(input.photo_paths ?? [])
  )

  return {
    id,
    created_at: createdAt,
    input_type: input.input_type,
    raw_input_text: input.raw_input_text,
    story_text: input.story_text,
    narration_path: input.narration_path ?? null,
    tags: input.tags,
    photo_paths: input.photo_paths ?? [],
  }
}

// メディアパスの更新
export function updateEntryMediaPaths(
  id: string,
  narrationPath: string | null,
  photoPaths: string[]
): void {
  db.prepare('UPDATE entries SET narration_path = ?, photo_paths = ? WHERE id = ?;').run(
    narrationPath,
    JSON.stringify(photoPaths),
    id
  )
}

// 日記エントリの一覧取得
export function listEntries(filter: ListEntriesFilter = {}): Entry[] {
  const conditions: string[] = []
  const params: string[] = []

  // シーンの一致
  if (filter.scene) {
    conditions.push("json_extract(tags, '$.シーン') = ?")
    params.push(filter.scene)
  }

  // 指定した感情をすべて含む
  for (const emotion of filter.emotions ?? []) {
    conditions.push("EXISTS (SELECT 1 FROM json_each(tags, '$.感情') WHERE json_each.value = ?)")
    params.push(emotion)
  }

  // 作成月の一致
  if (filter.month) {
    conditions.push('substr(created_at, 1, 7) = ?')
    params.push(filter.month)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db
    .query(`SELECT * FROM entries ${where} ORDER BY created_at DESC;`)
    .all(...params) as EntryRow[]

  return rows.map(toEntry)
}

// 日記エントリの取得
export function getEntry(id: string): Entry | null {
  const row = db.query('SELECT * FROM entries WHERE id = ?;').get(id) as EntryRow | null

  return row ? toEntry(row) : null
}

// 日記エントリの削除
export function deleteEntry(id: string): boolean {
  const result = db.prepare('DELETE FROM entries WHERE id = ?;').run(id)

  return result.changes > 0
}
