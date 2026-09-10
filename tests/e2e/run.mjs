// tests/e2e/run.mjs
import { spawn, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { randomUUID } from 'node:crypto'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const serverRoot = path.join(projectRoot, 'apps/server')
const cacheRoot = path.join(serverRoot, 'node_modules/.cache')
const bunPath = process.execPath
const children = []
const token = randomUUID()

let testRoot
let vendorLinked = false
let cleaned = false

// 子プロセスの起動
function start(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, ...extraEnv },
  })

  child.on('error', (error) => {
    child.launchError = error
  })

  children.push(child)
  return child
}

// 子プロセスの終了待ち
function waitForExit(child) {
  if (child.launchError) {
    return Promise.reject(child.launchError)
  }

  if (child.exitCode !== null) {
    return Promise.resolve(child.exitCode)
  }

  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
}

// コマンドの正常終了の確認
async function run(command, args, extraEnv = {}) {
  const code = await waitForExit(start(command, args, extraEnv))

  if (code !== 0) {
    throw new Error(`${path.basename(command)} が終了コード ${code} で終了しました`)
  }
}

// 起動済みサーバーとの競合確認
async function requireFreePort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer()

    server.once('error', () => {
      reject(new Error(`${port}番ポートが使用中です。通常のアプリ・サーバーを終了してください。`))
    })

    server.listen(port, '127.0.0.1', () => {
      server.close(resolve)
    })
  })
}

// HTTPレスポンスの確認
async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(120000),
  })

  if (!response.ok) {
    throw new Error(`${url} が HTTP ${response.status} を返しました`)
  }

  return response
}

// サーバーの起動待ち
async function waitUntilReady(child, url, check) {
  const deadline = Date.now() + 30000

  while (Date.now() < deadline) {
    if (child.launchError) {
      throw child.launchError
    }

    if (child.exitCode !== null) {
      throw new Error(`${url} の起動前にプロセスが終了しました`)
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1000),
      })

      if (response.ok && (await check(response))) {
        return
      }
    } catch {
      // 起動が完了するまでの再確認
    }

    await delay(250)
  }

  throw new Error(`${url} の起動を確認できませんでした`)
}

// 録音テストに使用する合成音声
async function createSpeech(text, filename) {
  const voicevoxUrl = process.env.VOICEVOX_URL
  const params = new URLSearchParams({ text, speaker: '122' })

  const queryResponse = await request(`${voicevoxUrl}/audio_query?${params}`, {
    method: 'POST',
  })
  const query = await queryResponse.json()

  query.speedScale = 1
  query.prePhonemeLength = 0.2
  query.postPhonemeLength = 0.2

  const audioResponse = await request(`${voicevoxUrl}/synthesis?speaker=122`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  })

  writeFileSync(path.join(testRoot, filename), Buffer.from(await audioResponse.arrayBuffer()))
}

// この実行で起動したプロセスと一時ファイルの終了処理
function cleanup() {
  if (cleaned) {
    return
  }

  cleaned = true

  for (const child of [...children].reverse()) {
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      })
    }
  }

  if (!testRoot) {
    return
  }

  const relative = path.relative(cacheRoot, testRoot)

  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    !path.basename(testRoot).startsWith('lulldiary-e2e-')
  ) {
    console.error('一時フォルダーの場所を確認できないため、削除を中止しました')
    return
  }

  try {
    // 元のvendorフォルダーを残すためのリンク解除
    if (vendorLinked) {
      unlinkSync(path.join(testRoot, 'vendor'))
      vendorLinked = false
    }

    rmSync(testRoot, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 300,
    })
  } catch (error) {
    console.error(`一時フォルダーを削除できませんでした: ${testRoot}`)
    console.error(error.message)
  }
}

process.once('SIGINT', () => {
  cleanup()
  process.exit(130)
})

process.once('SIGTERM', () => {
  cleanup()
  process.exit(143)
})

try {
  if (process.platform !== 'win32') {
    throw new Error('このE2E設定はWindows用です')
  }

  await requireFreePort(3000)
  await requireFreePort(4444)
  await requireFreePort(4445)

  const driverPath = path.join(homedir(), '.cargo/bin/tauri-driver.exe')

  if (!existsSync(driverPath)) {
    throw new Error('tauri-driver.exe が見つかりません')
  }

  const whisperPath = path.join(serverRoot, 'vendor/whisper.cpp/build/bin/Release/whisper-cli.exe')
  const modelPath = path.join(serverRoot, 'vendor/whisper.cpp/models/ggml-small.bin')

  if (!existsSync(whisperPath) || !existsSync(modelPath)) {
    throw new Error('Whisperの実行ファイルまたはモデルが見つかりません')
  }

  if (!process.env.OLLAMA_URL || !process.env.VOICEVOX_URL) {
    throw new Error('apps/server/.env の接続先を確認してください')
  }

  await request(`${process.env.OLLAMA_URL}/api/tags`)
  await request(`${process.env.VOICEVOX_URL}/version`)

  console.log('E2E用のアプリをビルドします')

  await run(bunPath, ['run', '--cwd', 'apps/desktop', 'tauri', 'build', '--debug', '--no-bundle'], {
    VITE_API_BASE_URL: 'http://localhost:3000',
  })

  mkdirSync(cacheRoot, { recursive: true })
  testRoot = mkdtempSync(path.join(cacheRoot, 'lulldiary-e2e-'))

  cpSync(path.join(serverRoot, 'src'), path.join(testRoot, 'src'), {
    recursive: true,
    filter: (source) => !source.endsWith('.test.ts'),
  })

  symlinkSync(path.join(serverRoot, 'vendor'), path.join(testRoot, 'vendor'), 'junction')
  vendorLinked = true

  writeFileSync(path.join(testRoot, '.e2e-token'), token)

  // コピーしたサーバーを識別するためのヘッダー
  writeFileSync(
    path.join(testRoot, 'src/e2e-server.ts'),
    [
      "import config from './index'",
      'export default {',
      '  ...config,',
      '  async fetch(request: Request) {',
      '    const response = await config.fetch(request)',
      `    response.headers.set('X-LullDiary-E2E', ${JSON.stringify(token)})`,
      '    return response',
      '  },',
      '}',
      '',
    ].join('\n')
  )

  await createSpeech('今日は雨が降っていました。', 'first.wav')
  await createSpeech('今日は公園を歩きました。', 'second.wav')

  const testEnv = {
    E2E_ROOT: testRoot,
    E2E_TOKEN: token,
    E2E_BUN: bunPath,
    WEBVIEW2_USER_DATA_FOLDER: path.join(testRoot, 'webview'),
  }

  const api = start(bunPath, [path.join(testRoot, 'src/e2e-server.ts')], testEnv)

  await waitUntilReady(
    api,
    'http://127.0.0.1:3000/health',
    (response) => response.headers.get('X-LullDiary-E2E') === token
  )

  const driver = start(driverPath, [], testEnv)

  await waitUntilReady(
    driver,
    'http://127.0.0.1:4444/status',
    async (response) => (await response.json()).value?.ready === true
  )

  console.log('6つのE2Eシナリオを実行します')

  await run(
    'node',
    [
      path.join(projectRoot, 'node_modules/@wdio/cli/bin/wdio.js'),
      'run',
      path.join(projectRoot, 'tests/e2e/wdio.conf.mjs'),
    ],
    testEnv
  )
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  cleanup()
}
