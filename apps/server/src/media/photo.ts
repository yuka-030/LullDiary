// apps/server/src/media/photo.ts
import sharp from 'sharp'
import { MAX_PHOTO_BYTES, MediaValidationError } from './limits'

// 保存画像の長辺の上限
const MAX_DIMENSION = 1000

// 入力画像の画素数の上限
const MAX_INPUT_PIXELS = 64_000_000

// JPEGの保存品質
const JPEG_QUALITY = 80

// 受付可能な画像形式
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp'])

// 写真の検証と縮小
export async function processPhoto(input: ArrayBuffer): Promise<Buffer> {
  if (input.byteLength === 0) {
    throw new MediaValidationError('写真データが空です')
  }

  if (input.byteLength > MAX_PHOTO_BYTES) {
    throw new MediaValidationError('写真は20MB以内にしてください')
  }

  try {
    const image = sharp(Buffer.from(input), {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: 'warning',
    })

    const metadata = await image.metadata()

    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
      throw new MediaValidationError('写真はJPEG・PNG・WebP形式にしてください')
    }

    if ((metadata.pages ?? 1) > 1) {
      throw new MediaValidationError('アニメーション画像は使用できません')
    }

    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > MAX_INPUT_PIXELS
    ) {
      throw new MediaValidationError('写真は6400万画素以内にしてください')
    }

    return await image
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer()
  } catch (error) {
    if (error instanceof MediaValidationError) {
      throw error
    }

    throw new MediaValidationError(
      '写真を読み込めません。6400万画素以内のJPEG・PNG・WebP画像を選んでください'
    )
  }
}
