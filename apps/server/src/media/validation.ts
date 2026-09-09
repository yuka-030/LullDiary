// apps/server/src/media/validation.ts
import { MAX_AUDIO_BYTES, MediaValidationError } from './limits'
import { processPhoto } from './photo'

// フォームの入力値
type MediaForm = Record<string, string | File | (string | File)[]>

// 保存前の検証と変換が完了したメディア
export type PreparedMedia = {
  narration: Buffer | undefined
  photos: Buffer[]
}

// WAV音声の検証
export function validateWav(input: ArrayBuffer): Buffer {
  if (input.byteLength === 0) {
    throw new MediaValidationError('音声データが空です')
  }

  if (input.byteLength > MAX_AUDIO_BYTES) {
    throw new MediaValidationError('音声は20MB以内にしてください')
  }

  const buffer = Buffer.from(input)
  const invalid = () => new MediaValidationError('有効な16bit PCM形式のWAV音声を使用してください')

  if (
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE' ||
    buffer.readUInt32LE(4) + 8 !== buffer.length
  ) {
    throw invalid()
  }

  let offset = 12
  let blockAlign = 0
  let hasFormat = false
  let hasData = false

  // WAVチャンクの構造と音声形式の検証
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) {
      throw invalid()
    }

    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const start = offset + 8
    const end = start + chunkSize
    const next = end + (chunkSize % 2)

    if (end > buffer.length || next > buffer.length) {
      throw invalid()
    }

    if (chunkId === 'fmt ') {
      if (hasFormat || chunkSize < 16) {
        throw invalid()
      }

      const format = buffer.readUInt16LE(start)
      const channels = buffer.readUInt16LE(start + 2)
      const sampleRate = buffer.readUInt32LE(start + 4)
      const byteRate = buffer.readUInt32LE(start + 8)
      const alignment = buffer.readUInt16LE(start + 12)
      const bitsPerSample = buffer.readUInt16LE(start + 14)

      if (
        format !== 1 ||
        (channels !== 1 && channels !== 2) ||
        sampleRate < 8000 ||
        sampleRate > 96000 ||
        bitsPerSample !== 16 ||
        alignment !== channels * 2 ||
        byteRate !== sampleRate * alignment
      ) {
        throw invalid()
      }

      blockAlign = alignment
      hasFormat = true
    } else if (chunkId === 'data') {
      if (!hasFormat || hasData || chunkSize === 0 || chunkSize % blockAlign !== 0) {
        throw invalid()
      }

      hasData = true
    }

    offset = next
  }

  if (!hasFormat || !hasData) {
    throw invalid()
  }

  return buffer
}

// アップロードされたファイルの取得
function getFiles(value: string | File | (string | File)[] | undefined, label: string): File[] {
  if (value === undefined) {
    return []
  }

  const values = Array.isArray(value) ? value : [value]

  if (values.some((item) => !(item instanceof File))) {
    throw new MediaValidationError(`${label}の送信形式が不正です`)
  }

  return values as File[]
}

// 日記の変更前のメディア検証と写真の変換
export async function prepareMedia(form: MediaForm): Promise<PreparedMedia> {
  const narrationFiles = getFiles(form.narration, '音声')
  const photoFiles = getFiles(form.photos, '写真')

  if (narrationFiles.length > 1) {
    throw new MediaValidationError('音声は1ファイルまでにしてください')
  }

  if (photoFiles.length > 1) {
    throw new MediaValidationError('写真は1枚までにしてください')
  }

  let narration: Buffer | undefined

  if (narrationFiles[0]) {
    if (narrationFiles[0].size > MAX_AUDIO_BYTES) {
      throw new MediaValidationError('音声は20MB以内にしてください')
    }

    narration = validateWav(await narrationFiles[0].arrayBuffer())
  }

  const photos: Buffer[] = []

  if (photoFiles[0]) {
    const { MAX_PHOTO_BYTES } = await import('./limits')

    if (photoFiles[0].size > MAX_PHOTO_BYTES) {
      throw new MediaValidationError('写真は20MB以内にしてください')
    }

    photos.push(await processPhoto(await photoFiles[0].arrayBuffer()))
  }

  return { narration, photos }
}
