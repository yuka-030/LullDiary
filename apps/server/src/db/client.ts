// apps/server/src/db/client.ts
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

// DBファイルの保存先
const dbDir = path.join(import.meta.dir, '..', '..', 'app_data', 'db')
const dbPath = path.join(dbDir, 'lulldiary.db')

mkdirSync(dbDir, { recursive: true })

export const db = new Database(dbPath, { create: true })

// 書き込みモードと外部キー制約の設定
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')
