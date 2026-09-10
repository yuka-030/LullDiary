// tests/e2e/seed.mjs
import { readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const cacheRoot = path.join(projectRoot, 'apps/server/node_modules/.cache')
const testRoot = path.resolve(process.env.E2E_ROOT ?? '.')
const relative = path.relative(cacheRoot, testRoot)

// 初期化対象が今回のテスト用フォルダーであることの確認
if (
  relative.startsWith('..') ||
  path.isAbsolute(relative) ||
  !path.basename(testRoot).startsWith('lulldiary-e2e-') ||
  !process.env.E2E_TOKEN ||
  readFileSync(path.join(testRoot, '.e2e-token'), 'utf8') !== process.env.E2E_TOKEN
) {
  throw new Error('テスト用DBの場所を確認できません')
}

const { db } = await import(pathToFileURL(path.join(testRoot, 'src/db/client.ts')).href)
const { createEntry } = await import(pathToFileURL(path.join(testRoot, 'src/db/entries.ts')).href)

// 絞り込み条件が異なる日記
const fixtures = [
  {
    story: '家でお茶を飲んで、嬉しい気持ちになりました。',
    scene: '家',
    emotions: ['嬉しい'],
    date: '2024-01-10T03:00:00.000Z',
  },
  {
    story: '家で本を読んで、穏やかな時間を過ごしました。',
    scene: '家',
    emotions: ['穏やか'],
    date: '2024-02-12T03:00:00.000Z',
  },
  {
    story: '職場で仕事が終わって、嬉しい気持ちになりました。',
    scene: '職場',
    emotions: ['嬉しい'],
    date: '2024-03-15T03:00:00.000Z',
  },
]

try {
  const entries = db.transaction(() => {
    db.exec('DELETE FROM entries')

    return fixtures.map((fixture) => {
      const entry = createEntry({
        input_type: 'text',
        raw_input_text: fixture.story,
        story_text: fixture.story,
        tags: {
          シーン: fixture.scene,
          感情: fixture.emotions,
        },
      })

      db.prepare('UPDATE entries SET created_at = ? WHERE id = ?').run(fixture.date, entry.id)

      return { ...entry, created_at: fixture.date }
    })
  })()

  // 前のシナリオで保存したテスト用メディアの初期化
  for (const directory of ['photos', 'narration']) {
    rmSync(path.join(testRoot, 'app_data', directory), {
      recursive: true,
      force: true,
    })
  }

  process.stdout.write(JSON.stringify(entries))
} finally {
  db.close()
}
