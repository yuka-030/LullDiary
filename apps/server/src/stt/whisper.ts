// apps/server/src/stt/whisper.ts
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { platform, tmpdir } from 'node:os'
import path from 'node:path'

// whisper.cpp の配置場所
const WHISPER_DIR = path.join(import.meta.dir, '..', '..', 'vendor', 'whisper.cpp')

// OSごとのビルド成果物のパス
const WHISPER_CLI =
  platform() === 'win32' ? 'build\\bin\\Release\\whisper-cli.exe' : './build/bin/whisper-cli'

// モデルファイルのパス
const MODEL_FILE = path.join('models', 'ggml-small.bin')

// 句読点付きの認識用例文
const INITIAL_PROMPT = '今日は、天気が良くて、公園に行きました。楽しかったです。'

// 探索する候補の数
const BEAM_SIZE = '5'

// 生成する候補の数
const BEST_OF = '5'

export class WhisperError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WhisperError'
  }
}

// WAV音声の文字起こし
export async function transcribe(audio: ArrayBuffer): Promise<string> {
  const tempDirectory = await mkdtemp(path.join(tmpdir(), 'lulldiary-'))
  const tempPath = path.join(tempDirectory, 'recording.wav')

  try {
    // 音声データの一時保存
    await writeFile(tempPath, new Uint8Array(audio), {
      flag: 'wx',
      mode: 0o600,
    })

    const proc = Bun.spawn(
      [
        WHISPER_CLI,
        '-m',
        MODEL_FILE,
        '-f',
        tempPath,
        '-l',
        'ja',
        '--prompt',
        INITIAL_PROMPT,
        '--beam-size',
        BEAM_SIZE,
        '--best-of',
        BEST_OF,
        '--no-timestamps',
        '--no-prints',
      ],
      {
        stdout: 'pipe',
        stderr: 'pipe',
        cwd: WHISPER_DIR,
      }
    )

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])

    if (exitCode !== 0) {
      throw new WhisperError(`whisper.cpp の実行に失敗しました: ${stderr}`)
    }

    return stdout.trim()
  } finally {
    // 一時ディレクトリの削除
    await rm(tempDirectory, { recursive: true, force: true }).catch(() => {})
  }
}
