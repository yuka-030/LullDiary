// apps/server/src/db/migrate.ts
import { db } from './client'
import { CREATE_ENTRIES_CREATED_AT_INDEX, CREATE_ENTRIES_TABLE } from './schema'

// recording_path列を除いたテーブルへの作り直し
const DROP_RECORDING_PATH = `
  CREATE TABLE entries_new (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    input_type TEXT NOT NULL CHECK (input_type IN ('voice', 'text')),
    raw_input_text TEXT NOT NULL,
    story_text TEXT NOT NULL,
    narration_path TEXT,
    tags TEXT NOT NULL DEFAULT '{}',
    photo_paths TEXT NOT NULL DEFAULT '[]'
  );

  INSERT INTO entries_new (id, created_at, input_type, raw_input_text, story_text, narration_path, tags, photo_paths)
  SELECT id, created_at, input_type, raw_input_text, story_text, narration_path, tags, photo_paths
  FROM entries;

  DROP TABLE entries;

  ALTER TABLE entries_new RENAME TO entries;
`

// バージョンごとのマイグレーション
const MIGRATIONS: { version: number; up: () => void }[] = [
  {
    version: 1,
    up: () => {
      db.exec(CREATE_ENTRIES_TABLE)
      db.exec(CREATE_ENTRIES_CREATED_AT_INDEX)
    },
  },
  {
    version: 2,
    up: () => {
      db.exec(DROP_RECORDING_PATH)
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
