// apps/server/src/stt/whisper.ts
import { unlink } from 'node:fs/promises'
import { platform, tmpdir } from 'node:os'
import path from 'node:path'

/**
 * whisper.cpp は vendor 配下に配置している。
 * git管理外のため、READMEの手順で各自セットアップが必要。
 */
const WHISPER_DIR = path.join(import.meta.dir, '..', '..', 'vendor', 'whisper.cpp')

/**
 * ビルド成果物の配置がOSによって異なるため切り替える。
 * Windows は Release サブディレクトリに .exe として出力される。
 * whisper.cpp は非ASCII文字を含むパスを正しく扱えないため、
 * 作業ディレクトリを whisper.cpp に固定し、引数には相対パスを渡す。
 */
const WHISPER_CLI =
  platform() === 'win32' ? 'build\\bin\\Release\\whisper-cli.exe' : './build/bin/whisper-cli'

const MODEL_FILE = 'ggml-small.bin'

export class WhisperError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WhisperError'
  }
}

/**
 * WAV形式の音声データをテキスト化する。
 * whisper.cpp はファイルパスを受け取る仕様のため、一時ファイルに書き出してから渡す。
 */
export async function transcribe(audio: ArrayBuffer): Promise<string> {
  const tempPath = path.join(tmpdir(), `lulldiary-${Date.now()}.wav`)

  try {
    await Bun.write(tempPath, audio)

    const proc = Bun.spawn(
      [
        WHISPER_CLI,
        '-m',
        MODEL_FILE,
        '-f',
        tempPath,
        '-l',
        'ja',
        // 認識結果のみを取得したいため、タイムスタンプを出力しない
        '--no-timestamps',
        // 進捗表示を抑制し、標準出力を認識結果だけにする
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
    // 一時ファイルは成否にかかわらず削除する
    await unlink(tempPath).catch(() => {})
  }
}
