// apps/server/scripts/verify-schema.ts
import { db } from '../src/db/client'
import { migrate } from '../src/db/migrate'

migrate()

// 作成済みテーブルの一覧
const tables = db.query("SELECT name FROM sqlite_master WHERE type='table';").all()

console.log('テーブル:', tables)

// entriesテーブルのカラム定義
const columns = db.query('PRAGMA table_info(entries);').all()

console.log('entriesのカラム:', columns)

// 適用済みマイグレーション
const migrations = db.query('SELECT * FROM schema_migrations;').all()

console.log('適用済みマイグレーション:', migrations)
