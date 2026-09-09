// apps/server/src/db/entries.test.ts
import type { Database } from 'bun:sqlite'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { CreateEntryInput } from './entries'

// 子プロセスの実行情報
const workerDirectory = process.env.LULLDIARY_ENTRIES_TEST_DIRECTORY
const workerTestName = process.env.LULLDIARY_ENTRIES_TEST_NAME
const isWorker = Boolean(workerDirectory && workerTestName)

// テスト用のDBと操作
let temporaryDirectory: string | undefined
let database: Database | undefined
let entries: typeof import('./entries')

// 日記の入力値
function input(overrides: Partial<CreateEntryInput> = {}): CreateEntryInput {
  return {
    input_type: 'text',
    raw_input_text: '今日は家で本を読みました。',
    story_text: '今日は、家で本を読んだ一日でした。',
    tags: { シーン: '家', 感情: ['穏やか'] },
    ...overrides,
  }
}

// 指定日時の日記
function datedEntry(createdAt: string, overrides: Partial<CreateEntryInput> = {}) {
  const entry = entries.createEntry(input(overrides))

  if (!database) {
    throw new Error('テスト用DBが初期化されていません')
  }

  database.prepare('UPDATE entries SET created_at = ? WHERE id = ?').run(createdAt, entry.id)

  return { ...entry, created_at: createdAt }
}

// 子プロセスでの単体テスト
function isolatedTest(name: string, assertion: () => void): void {
  if (isWorker) {
    if (name === workerTestName) {
      test(name, assertion)
    }

    return
  }

  test(
    name,
    async () => {
      if (!temporaryDirectory) {
        throw new Error('テスト用ディレクトリが初期化されていません')
      }

      const child = Bun.spawn(
        [process.execPath, 'test', path.join(import.meta.dir, 'entries.test.ts')],
        {
          cwd: path.resolve(import.meta.dir, '..', '..'),
          env: {
            ...process.env,
            LULLDIARY_ENTRIES_TEST_DIRECTORY: temporaryDirectory,
            LULLDIARY_ENTRIES_TEST_NAME: name,
          },
          stdout: 'pipe',
          stderr: 'pipe',
        }
      )

      // 子プロセスの実行期限
      const timer = setTimeout(() => child.kill(), 10_000)

      try {
        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ])

        if (exitCode !== 0) {
          throw new Error(`${name}\n${stdout}\n${stderr}`)
        }
      } finally {
        clearTimeout(timer)
      }
    },
    15_000
  )
}

describe('日記のCRUDと絞り込み', () => {
  beforeAll(async () => {
    if (!isWorker) {
      temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'lulldiary-entries-'))
      const directory = path.join(temporaryDirectory, 'src', 'db')

      await mkdir(directory, { recursive: true })

      for (const filename of ['client.ts', 'schema.ts', 'migrate.ts', 'entries.ts']) {
        await copyFile(path.join(import.meta.dir, filename), path.join(directory, filename))
      }

      return
    }

    if (!workerDirectory) {
      throw new Error('テスト用ディレクトリが指定されていません')
    }

    const directory = path.join(workerDirectory, 'src', 'db')

    const client = (await import(
      pathToFileURL(path.join(directory, 'client.ts')).href
    )) as typeof import('./client')

    database = client.db

    const migration = (await import(
      pathToFileURL(path.join(directory, 'migrate.ts')).href
    )) as typeof import('./migrate')

    migration.migrate()

    entries = (await import(
      pathToFileURL(path.join(directory, 'entries.ts')).href
    )) as typeof import('./entries')
  })

  beforeEach(() => {
    if (!isWorker) {
      return
    }

    if (!database) {
      throw new Error('テスト用DBが初期化されていません')
    }

    database.exec('DELETE FROM entries')
  })

  afterAll(async () => {
    if (isWorker) {
      database?.close()
      return
    }

    if (temporaryDirectory) {
      await rm(temporaryDirectory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      })
    }
  })

  isolatedTest('日記を作成し保存した値を取得できる', () => {
    const before = Date.now()
    const values = input()
    const entry = entries.createEntry(values)
    const after = Date.now()

    expect(entry.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(Date.parse(entry.created_at)).toBeGreaterThanOrEqual(before)
    expect(Date.parse(entry.created_at)).toBeLessThanOrEqual(after)
    expect(entry).toMatchObject({
      ...values,
      narration_path: null,
      photo_paths: [],
    })
    expect(entries.getEntry(entry.id)).toEqual(entry)
  })

  isolatedTest('音声入力とメディアパスを保存できる', () => {
    const entry = entries.createEntry(
      input({
        input_type: 'voice',
        narration_path: '/narration/example.wav',
        photo_paths: ['/photos/example/photo1.jpg'],
      })
    )

    expect(entries.getEntry(entry.id)).toEqual(entry)
    expect(entry.input_type).toBe('voice')
    expect(entry.narration_path).toBe('/narration/example.wav')
    expect(entry.photo_paths).toEqual(['/photos/example/photo1.jpg'])
  })

  isolatedTest('同じ内容の日記にも異なるIDが付く', () => {
    const first = entries.createEntry(input())
    const second = entries.createEntry(input())

    expect(first.id).not.toBe(second.id)
    expect(entries.listEntries()).toHaveLength(2)
  })

  isolatedTest('指定した日記だけを取得できる', () => {
    const first = entries.createEntry(input())
    entries.createEntry(input({ story_text: '別の日の物語です。' }))

    expect(entries.getEntry(first.id)).toEqual(first)
    expect(entries.getEntry(crypto.randomUUID())).toBeNull()
  })

  isolatedTest('物語文だけを更新し他の値を保持する', () => {
    const entry = entries.createEntry(
      input({
        narration_path: '/narration/example.wav',
        photo_paths: ['/photos/example/photo1.jpg'],
      })
    )

    expect(entries.updateEntry(entry.id, { story_text: '更新した物語です。' })).toBe(true)
    expect(entries.getEntry(entry.id)).toEqual({
      ...entry,
      story_text: '更新した物語です。',
    })
  })

  isolatedTest('タグだけを更新し他の値を保持する', () => {
    const entry = entries.createEntry(input())
    const tags: CreateEntryInput['tags'] = {
      シーン: '自然',
      感情: ['嬉しい', '穏やか'],
    }

    expect(entries.updateEntry(entry.id, { tags })).toBe(true)
    expect(entries.getEntry(entry.id)).toEqual({ ...entry, tags })
  })

  isolatedTest('物語文とタグを同時に更新できる', () => {
    const entry = entries.createEntry(input())
    const tags: CreateEntryInput['tags'] = {
      シーン: '職場',
      感情: ['疲れた'],
    }

    expect(
      entries.updateEntry(entry.id, {
        story_text: '仕事を終えた日の物語です。',
        tags,
      })
    ).toBe(true)
    expect(entries.getEntry(entry.id)).toEqual({
      ...entry,
      story_text: '仕事を終えた日の物語です。',
      tags,
    })
  })

  isolatedTest('更新項目がない場合は変更せずfalseを返す', () => {
    const entry = entries.createEntry(input())

    expect(entries.updateEntry(entry.id, {})).toBe(false)
    expect(entries.getEntry(entry.id)).toEqual(entry)
  })

  isolatedTest('存在しない日記の更新はfalseを返す', () => {
    expect(entries.updateEntry(crypto.randomUUID(), { story_text: '更新内容' })).toBe(false)
    expect(entries.listEntries()).toEqual([])
  })

  isolatedTest('メディアパスを更新し解除できる', () => {
    const entry = entries.createEntry(input())

    entries.updateEntryMediaPaths(entry.id, '/narration/example.wav', [
      '/photos/example/photo1.jpg',
    ])

    expect(entries.getEntry(entry.id)).toEqual({
      ...entry,
      narration_path: '/narration/example.wav',
      photo_paths: ['/photos/example/photo1.jpg'],
    })

    entries.updateEntryMediaPaths(entry.id, null, [])

    expect(entries.getEntry(entry.id)).toEqual(entry)
  })

  isolatedTest('指定した日記を削除し他の日記を保持する', () => {
    const target = entries.createEntry(input())
    const remaining = entries.createEntry(input())

    expect(entries.deleteEntry(target.id)).toBe(true)
    expect(entries.getEntry(target.id)).toBeNull()
    expect(entries.listEntries()).toEqual([remaining])
  })

  isolatedTest('存在しない日記の削除はfalseを返す', () => {
    expect(entries.deleteEntry(crypto.randomUUID())).toBe(false)
  })

  isolatedTest('日記がない場合は空の一覧を返す', () => {
    expect(entries.listEntries()).toEqual([])
  })

  isolatedTest('作成日時の新しい順に一覧を返す', () => {
    const middle = datedEntry('2026-08-15T12:00:00.000Z')
    const newest = datedEntry('2026-09-01T12:00:00.000Z')
    const oldest = datedEntry('2025-09-01T12:00:00.000Z')

    expect(entries.listEntries()).toEqual([newest, middle, oldest])
  })

  isolatedTest('シーンが一致する日記だけを返す', () => {
    const home = entries.createEntry(input())
    entries.createEntry(input({ tags: { シーン: '職場', 感情: ['穏やか'] } }))

    expect(entries.listEntries({ scene: '家' })).toEqual([home])
    expect(entries.listEntries({ scene: '自然' })).toEqual([])
  })

  isolatedTest('指定した感情を含む日記だけを返す', () => {
    const target = entries.createEntry(
      input({ tags: { シーン: '家', 感情: ['嬉しい', '穏やか'] } })
    )
    entries.createEntry(input({ tags: { シーン: '家', 感情: ['疲れた'] } }))

    expect(entries.listEntries({ emotions: ['嬉しい'] })).toEqual([target])
  })

  isolatedTest('複数の感情をすべて含む日記だけを返す', () => {
    const target = entries.createEntry(
      input({ tags: { シーン: '家', 感情: ['嬉しい', '穏やか'] } })
    )
    entries.createEntry(input({ tags: { シーン: '家', 感情: ['嬉しい'] } }))
    entries.createEntry(input({ tags: { シーン: '家', 感情: ['穏やか'] } }))

    expect(entries.listEntries({ emotions: ['嬉しい', '穏やか'] })).toEqual([target])
  })

  isolatedTest('年月を区別して指定月の日記だけを返す', () => {
    const target = datedEntry('2026-09-01T00:00:00.000Z')
    datedEntry('2025-09-01T00:00:00.000Z')
    datedEntry('2026-08-31T23:59:59.999Z')
    datedEntry('2026-10-01T00:00:00.000Z')

    expect(entries.listEntries({ month: '2026-09' })).toEqual([target])
  })

  isolatedTest('シーン・感情・月の条件をすべて反映する', () => {
    const target = datedEntry('2026-09-01T12:00:00.000Z')
    datedEntry('2026-08-01T12:00:00.000Z')
    datedEntry('2026-09-02T12:00:00.000Z', {
      tags: { シーン: '職場', 感情: ['穏やか'] },
    })
    datedEntry('2026-09-03T12:00:00.000Z', {
      tags: { シーン: '家', 感情: ['疲れた'] },
    })

    expect(
      entries.listEntries({
        scene: '家',
        emotions: ['穏やか'],
        month: '2026-09',
      })
    ).toEqual([target])
  })

  isolatedTest('絞り込み条件を解除すると全件を返す', () => {
    const older = datedEntry('2026-08-01T12:00:00.000Z')
    const newer = datedEntry('2026-09-01T12:00:00.000Z', {
      tags: { シーン: '職場', 感情: ['疲れた'] },
    })

    expect(entries.listEntries({ scene: '家' })).toEqual([older])
    expect(entries.listEntries({ scene: '', emotions: [], month: '' })).toEqual([newer, older])
    expect(entries.listEntries()).toEqual([newer, older])
  })
})
