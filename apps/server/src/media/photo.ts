// apps/server/src/media/photo.ts
import sharp from 'sharp'

// 長辺の上限
const MAX_DIMENSION = 1200

// リサイズとメタデータの削除
export async function processPhoto(input: ArrayBuffer): Promise<Buffer> {
  return sharp(Buffer.from(input))
    .rotate()
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .withMetadata({ exif: {}, icc: undefined })
    .jpeg({ quality: 85 })
    .toBuffer()
}
