// apps/server/src/db/schema.ts
import type { Tags } from '../tag/ollama'

// 日記エントリ
export type Entry = {
  id: string
  created_at: string
  input_type: InputType
  raw_input_text: string
  story_text: string
  narration_path: string | null
  tags: Tags
  photo_paths: string[]
}

// 入力方法
export type InputType = 'voice' | 'text'

// タグ情報
export type { Tags }

// entriesテーブルの1行
export type EntryRow = {
  id: string
  created_at: string
  input_type: InputType
  raw_input_text: string
  story_text: string
  narration_path: string | null
  tags: string
  photo_paths: string
}

// 日記エントリテーブル
export const CREATE_ENTRIES_TABLE = `
  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    input_type TEXT NOT NULL CHECK (input_type IN ('voice', 'text')),
    raw_input_text TEXT NOT NULL,
    story_text TEXT NOT NULL,
    narration_path TEXT,
    tags TEXT NOT NULL DEFAULT '{}',
    photo_paths TEXT NOT NULL DEFAULT '[]'
  );
`

// 作成日時の降順のインデックス
export const CREATE_ENTRIES_CREATED_AT_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries (created_at DESC);
`

// 行から日記エントリへの変換
export function toEntry(row: EntryRow): Entry {
  return {
    ...row,
    tags: JSON.parse(row.tags) as Tags,
    photo_paths: JSON.parse(row.photo_paths) as string[],
  }
}
