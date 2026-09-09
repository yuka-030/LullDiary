// apps/server/src/media/photo.test.ts
import { describe, expect, test } from 'bun:test'
import sharp from 'sharp'
import { MAX_PHOTO_BYTES, MediaValidationError } from './limits'
import { processPhoto } from './photo'

// Bufferの内容だけを持つArrayBuffer
function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer.length)

  bytes.set(buffer)

  return bytes.buffer
}

// テスト用の静止画像
function createImage(width = 1600, height = 800) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 240, g: 210, b: 180 },
    },
  })
}

// PNGチャンクのCRC
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff

  for (const byte of bytes) {
    crc ^= byte

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0)
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

describe('写真の検証と保存用変換', () => {
  for (const format of ['jpeg', 'png', 'webp'] as const) {
    test(`${format}を長辺1000pxのJPEGに変換する`, async () => {
      const input = await createImage().toFormat(format).toBuffer()
      const output = await processPhoto(toArrayBuffer(input))
      const metadata = await sharp(output).metadata()

      expect(metadata.format).toBe('jpeg')
      expect(metadata.width).toBe(1000)
      expect(metadata.height).toBe(500)
    })
  }

  test('小さな写真を拡大しない', async () => {
    const input = await createImage(320, 200).png().toBuffer()
    const output = await processPhoto(toArrayBuffer(input))
    const metadata = await sharp(output).metadata()

    expect(metadata.width).toBe(320)
    expect(metadata.height).toBe(200)
  })

  test('EXIF情報を保存画像に残さない', async () => {
    const input = await createImage(32, 16)
      .withExif({
        IFD0: {
          Artist: 'private-test-author',
          Copyright: 'private-test-data',
        },
      })
      .jpeg()
      .toBuffer()

    expect((await sharp(input).metadata()).exif).toBeDefined()

    const output = await processPhoto(toArrayBuffer(input))
    const metadata = await sharp(output).metadata()

    expect(metadata.exif).toBeUndefined()
    expect(metadata.xmp).toBeUndefined()
    expect(metadata.iptc).toBeUndefined()
  })

  test('空データと容量超過を拒否する', async () => {
    await expect(processPhoto(new ArrayBuffer(0))).rejects.toThrow('写真データが空です')

    await expect(processPhoto(new ArrayBuffer(MAX_PHOTO_BYTES + 1))).rejects.toThrow(
      '写真は20MB以内にしてください'
    )
  })

  test('SVG画像を拒否する', async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
        '<rect width="10" height="10" fill="red"/></svg>'
    )

    await expect(processPhoto(svg.buffer)).rejects.toThrow(
      '写真はJPEG・PNG・WebP形式にしてください'
    )
  })

  test('破損した画像を拒否する', async () => {
    const input = await createImage(32, 16).jpeg().toBuffer()
    const broken = input.subarray(0, Math.floor(input.length / 2))

    await expect(processPhoto(toArrayBuffer(broken))).rejects.toThrow(MediaValidationError)
  })

  test('6400万画素を超える寸法を持つPNGを拒否する', async () => {
    const input = await createImage(2, 2).png().toBuffer()

    // 巨大な画像を展開せずに入力ヘッダーの寸法だけを変更
    input.writeUInt32BE(8001, 16)
    input.writeUInt32BE(8000, 20)
    input.writeUInt32BE(crc32(input.subarray(12, 29)), 29)

    await expect(processPhoto(toArrayBuffer(input))).rejects.toThrow('6400万画素以内')
  })
})
