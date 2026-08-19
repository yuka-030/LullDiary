// apps/server/scripts/setup-voicevox.ts
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const VOICEVOX_URL = process.env.VOICEVOX_URL ?? 'http://localhost:50021'

// 起動を待つ間隔と上限
const POLL_INTERVAL_MS = 1000
const POLL_TIMEOUT_MS = 60000

// エンジンの実行ファイルの候補
function getEnginePaths(): string[] {
  const configured = process.env.VOICEVOX_ENGINE_PATH

  if (configured) {
    return [configured]
  }

  const localAppData = process.env.LOCALAPPDATA
  const programFiles = process.env.ProgramFiles
  const candidates: string[] = []

  if (localAppData) {
    candidates.push(path.join(localAppData, 'Programs', 'VOICEVOX', 'vv-engine', 'run.exe'))
  }

  if (programFiles) {
    candidates.push(path.join(programFiles, 'VOICEVOX', 'vv-engine', 'run.exe'))
  }

  return candidates
}

// エンジンへの疎通確認
async function isRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${VOICEVOX_URL}/version`)
    return response.ok
  } catch {
    return false
  }
}

// エンジンの起動
function launch(enginePath: string): void {
  const child = spawn(enginePath, [], {
    detached: true,
    stdio: 'ignore',
    cwd: path.dirname(enginePath),
  })

  child.unref()
}

// 起動完了までの待機
async function waitForStart(): Promise<boolean> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    if (await isRunning()) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  return false
}

async function main() {
  if (await isRunning()) {
    console.log('VOICEVOXは起動済みです')
    return
  }

  const enginePath = getEnginePaths().find((candidate) => existsSync(candidate))

  if (!enginePath) {
    console.error('VOICEVOXが見つかりません。VOICEVOX_ENGINE_PATH を .env に設定してください')
    process.exit(1)
  }

  console.log('VOICEVOXを起動しています…')
  launch(enginePath)

  if (!(await waitForStart())) {
    console.error('VOICEVOXの起動に失敗しました')
    process.exit(1)
  }

  console.log('VOICEVOXを起動しました')
}

main()
