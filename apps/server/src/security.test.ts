// apps/server/src/security.test.ts
import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

// テスト対象のサーバーディレクトリ
const SERVER_ROOT = path.resolve(import.meta.dir, '..')

// 別プロセスで実行するAPI点検
const RUNNER = String.raw`
import assert from 'node:assert/strict'
import sharp from 'sharp'
import server from './src/index.ts'

// 外部APIへの意図しない接続の禁止
globalThis.fetch = async () => {
  throw new Error('このテストでは外部APIを呼び出せません')
}

const origin = 'http://localhost:1420'
const failures = []
let checks = 0

async function check(name, action) {
  try {
    await action()
    checks += 1
  } catch (error) {
    failures.push(name + ': ' + String(error))
  }
}

function request(route, options = {}) {
  const headers = new Headers(options.headers)

  if (!headers.has('Host')) {
    headers.set('Host', 'localhost:3000')
  }

  return server.fetch(
    new Request('http://localhost:3000' + route, {
      ...options,
      headers,
    })
  )
}

function entryForm(story = '保存する物語') {
  const form = new FormData()

  form.set('input_type', 'text')
  form.set('raw_input_text', '今日は静かに過ごしました')
  form.set('story_text', story)
  form.set('tags', JSON.stringify({ シーン: '家', 感情: ['穏やか'] }))

  return form
}

async function entries() {
  const response = await request('/entries')

  assert.equal(response.status, 200)

  return (await response.json()).entries
}

await check('許可されたHostでヘルスチェックできる', async () => {
  for (const host of ['localhost:3000', '127.0.0.1:3000']) {
    const response = await request('/health', { headers: { Host: host } })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
  }
})

await check('不正なHostを読み取り要求でも拒否する', async () => {
  for (const host of [
    'outside.example:3000',
    'localhost.evil.example:3000',
    'localhost:4000',
  ]) {
    const response = await request('/entries', { headers: { Host: host } })

    assert.equal(response.status, 403)
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
  }
})

await check('Hostが欠けた要求を拒否する', async () => {
  const response = await server.fetch(new Request('http://localhost:3000/health'))

  assert.equal(response.status, 403)
})

await check('不正または不明な送信元からの保存要求を拒否する', async () => {
  for (const value of [
    undefined,
    'null',
    'https://outside.example',
    'http://localhost:1420.evil.example',
  ]) {
    const headers = value === undefined ? {} : { Origin: value }
    const response = await request('/entries', {
      method: 'POST',
      headers,
      body: entryForm(),
    })

    assert.equal(response.status, 403)
  }

  assert.equal((await entries()).length, 0)
})

await check('不正な送信元からの更新・削除要求を拒否する', async () => {
  for (const method of ['PATCH', 'DELETE']) {
    const response = await request('/entries/12345678-1234-4234-8234-123456789abc', {
      method,
      headers: { Origin: 'https://outside.example' },
    })

    assert.equal(response.status, 403)
  }
})

await check('開発版と製品版の送信元を受け付ける', async () => {
  for (const value of [
    'http://localhost:1420',
    'tauri://localhost',
    'http://tauri.localhost',
  ]) {
    const response = await request('/entries', {
      method: 'POST',
      headers: { Origin: value },
      body: new FormData(),
    })

    // 送信元検証を通過し、空の日記入力の検証で拒否
    assert.equal(response.status, 400)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), value)
  }
})

await check('Windows製品版のプリフライトを受け付ける', async () => {
  const response = await request('/entries', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://tauri.localhost',
      'Access-Control-Request-Method': 'PATCH',
    },
  })

  assert.equal(response.status, 204)
  assert.equal(
    response.headers.get('Access-Control-Allow-Origin'),
    'http://tauri.localhost'
  )
})

await check('フォーム全体の容量超過を拒否する', async () => {
  const response = await request('/entries', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Length': String(41 * 1024 * 1024 + 1),
    },
    body: 'x',
  })

  assert.equal(response.status, 413)
  assert.equal((await entries()).length, 0)
})

await check('Content-Lengthなしの音声容量超過を拒否する', async () => {
  let remaining = 20 * 1024 * 1024 + 1

  const body = new ReadableStream({
    pull(controller) {
      if (remaining === 0) {
        controller.close()
        return
      }

      const size = Math.min(remaining, 1024 * 1024)

      controller.enqueue(new Uint8Array(size))
      remaining -= size
    },
  })

  const response = await request('/stt', {
    method: 'POST',
    headers: { Origin: origin },
    body,
    duplex: 'half',
  })

  assert.equal(response.status, 413)
})

await check('不正なWAVを文字起こし前に拒否する', async () => {
  const response = await request('/stt', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'audio/wav',
    },
    body: 'not a wav',
  })

  assert.equal(response.status, 400)
})

await check('不正な写真を日記作成前に拒否する', async () => {
  const form = entryForm()

  form.set(
    'photos',
    new File(['<script>alert(1)</script>'], 'photo.jpg', { type: 'image/jpeg' })
  )

  const response = await request('/entries', {
    method: 'POST',
    headers: { Origin: origin },
    body: form,
  })

  assert.equal(response.status, 400)
  assert.equal((await entries()).length, 0)
})

await check('写真2枚を日記作成前に拒否する', async () => {
  const form = entryForm()
  const photo = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' })

  form.append('photos', photo)
  form.append('photos', photo)

  const response = await request('/entries', {
    method: 'POST',
    headers: { Origin: origin },
    body: form,
  })

  assert.equal(response.status, 400)
  assert.equal((await entries()).length, 0)
})

await check('写真を保存・配信し、不正な更新では元の内容を保持する', async () => {
  const png = await sharp({
    create: {
      width: 40,
      height: 20,
      channels: 3,
      background: 'white',
    },
  }).png().toBuffer()

  const form = entryForm()

  form.set(
    'photos',
    new File([new Uint8Array(png)], 'photo.png', { type: 'image/png' })
  )

  const created = await request('/entries', {
    method: 'POST',
    headers: { Origin: origin },
    body: form,
  })

  assert.equal(created.status, 201)

  const { entry } = await created.json()
  const photoRoute = '/entries/' + entry.id + '/photos/photo1.jpg'
  const before = await request(photoRoute)

  assert.equal(before.status, 200)
  assert.equal(before.headers.get('Content-Type'), 'image/jpeg')
  assert.equal(before.headers.get('X-Content-Type-Options'), 'nosniff')

  const beforeBytes = Buffer.from(await before.arrayBuffer())
  const metadata = await sharp(beforeBytes).metadata()

  assert.equal(metadata.format, 'jpeg')

  const update = new FormData()

  update.set('story_text', 'この変更は保存されない')
  update.set(
    'photos',
    new File(['broken'], 'photo.jpg', { type: 'image/jpeg' })
  )

  const rejected = await request('/entries/' + entry.id, {
    method: 'PATCH',
    headers: { Origin: origin },
    body: update,
  })

  assert.equal(rejected.status, 400)

  const detail = await request('/entries/' + entry.id)
  const afterEntry = (await detail.json()).entry
  const afterPhoto = await request(photoRoute)

  assert.equal(afterEntry.story_text, '保存する物語')
  assert.deepEqual(Buffer.from(await afterPhoto.arrayBuffer()), beforeBytes)
})

await check('SQLに見える入力を文字列として保存し、ID検索へ埋め込まない', async () => {
  const text = "'; DROP TABLE entries; --"
  const form = entryForm(text)

  form.set('raw_input_text', text)

  const response = await request('/entries', {
    method: 'POST',
    headers: { Origin: origin },
    body: form,
  })

  assert.equal(response.status, 201)

  const { entry } = await response.json()

  assert.equal(entry.raw_input_text, text)
  assert.equal(entry.story_text, text)

  const injected = await request('/entries/' + encodeURIComponent("' OR 1=1 --"))

  assert.equal(injected.status, 404)
  assert.equal((await entries()).length, 2)
})

process.stdout.write(JSON.stringify({ checks, failures }))
`

test('実際のAPIでHost・送信元・容量・保存前検証・配信ヘッダーを確認する', async () => {
  const temporaryRoot = await mkdtemp(path.join(SERVER_ROOT, '.security-test-'))

  try {
    // 実際の日記DBを参照しないテスト用ソース
    await cp(path.join(SERVER_ROOT, 'src'), path.join(temporaryRoot, 'src'), { recursive: true })

    await writeFile(path.join(temporaryRoot, 'runner.ts'), RUNNER)

    // 起動するサーバーや外部APIを必要としない別プロセス
    const child = Bun.spawn([process.execPath, path.join(temporaryRoot, 'runner.ts')], {
      cwd: temporaryRoot,
      env: {
        ...process.env,
        VOICEVOX_URL: 'http://127.0.0.1:1',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])

    if (exitCode !== 0) {
      throw new Error(`APIテストの起動に失敗しました\n${stderr}\n${stdout}`)
    }

    const result = JSON.parse(stdout) as {
      checks: number
      failures: string[]
    }

    expect(result.failures).toEqual([])
    expect(result.checks).toBe(14)
  } finally {
    // このテストで作成した一時フォルダーの削除
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}, 60000)
