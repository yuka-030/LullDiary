// apps/server/src/db/client.ts
import { Database } from 'bun:sqlite'
import path from 'node:path'

const dbPath = path.join(import.meta.dir, '..', '..', 'data', 'verify.db')

export const db = new Database(dbPath, { create: true })

db.exec('PRAGMA journal_mode = WAL;')
