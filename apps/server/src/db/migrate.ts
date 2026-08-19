// apps/server/src/db/migrate.ts
import { db } from './client'
import { CREATE_ENTRIES_CREATED_AT_INDEX, CREATE_ENTRIES_TABLE } from './schema'

// バージョンごとのマイグレーション
const MIGRATIONS: { version: number; up: () => void }[] = [
  {
    version: 1,
    up: () => {
      db.exec(CREATE_ENTRIES_TABLE)
      db.exec(CREATE_ENTRIES_CREATED_AT_INDEX)
    },
  },
]

// 適用済みバージョンの記録テーブル
const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`

// 適用済みの最新バージョンの取得
function getCurrentVersion(): number {
  const row = db.query('SELECT MAX(version) AS version FROM schema_migrations;').get() as {
    version: number | null
  }

  return row.version ?? 0
}

// 未適用のマイグレーションの実行
export function migrate(): void {
  db.exec(CREATE_MIGRATIONS_TABLE)

  const currentVersion = getCurrentVersion()
  const pending = MIGRATIONS.filter((migration) => migration.version > currentVersion)

  if (pending.length === 0) {
    return
  }

  const record = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);')

  // 失敗時のロールバック
  const runAll = db.transaction(() => {
    for (const migration of pending) {
      migration.up()
      record.run(migration.version, new Date().toISOString())
    }
  })

  runAll()
}
