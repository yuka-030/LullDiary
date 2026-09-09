// apps/server/src/media/validation.test.ts
import { describe, expect, test } from 'bun:test'
import { MAX_AUDIO_BYTES, MAX_PHOTO_BYTES, MediaValidationError } from './limits'
import { prepareMedia, validateWav } from './validation'

// 無音の16bit PCM WAVデータ
function createWav(totalBytes = 48): ArrayBuffer {
  const buffer = new ArrayBuffer(totalBytes)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  bytes.set(new TextEncoder().encode('RIFF'), 0)
  view.setUint32(4, totalBytes - 8, true)
  bytes.set(new TextEncoder().encode('WAVE'), 8)
  bytes.set(new TextEncoder().encode('fmt '), 12)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 16000, true)
  view.setUint32(28, 32000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  bytes.set(new TextEncoder().encode('data'), 36)
  view.setUint32(40, totalBytes - 44, true)

  return buffer
}

describe('WAV音声の検証', () => {
  test('有効なWAVを内容を変えずに受け付ける', () => {
    const input = createWav()

    expect(validateWav(input)).toEqual(Buffer.from(input))
  })

  test('20MBちょうどのWAVを受け付ける', () => {
    expect(validateWav(createWav(MAX_AUDIO_BYTES)).byteLength).toBe(MAX_AUDIO_BYTES)
  })

  test('20MBを超える音声を拒否する', () => {
    expect(() => validateWav(new ArrayBuffer(MAX_AUDIO_BYTES + 1))).toThrow(
      '音声は20MB以内にしてください'
    )
  })

  test('空データとWAVではないデータを拒否する', () => {
    expect(() => validateWav(new ArrayBuffer(0))).toThrow('音声データが空です')

    const input = new TextEncoder().encode('<script>alert(1)</script>')

    expect(() => validateWav(input.buffer)).toThrow(MediaValidationError)
  })

  test('ファイル全体のサイズ情報が不正なWAVを拒否する', () => {
    const input = createWav()

    new DataView(input).setUint32(4, 9999, true)

    expect(() => validateWav(input)).toThrow(MediaValidationError)
  })

  test('ファイル末尾を超えるチャンクを拒否する', () => {
    const input = createWav()

    new DataView(input).setUint32(40, 9999, true)

    expect(() => validateWav(input)).toThrow(MediaValidationError)
  })

  test('PCM以外の音声形式を拒否する', () => {
    const input = createWav()

    new DataView(input).setUint16(20, 3, true)

    expect(() => validateWav(input)).toThrow(MediaValidationError)
  })

  test('16bit以外の音声を拒否する', () => {
    const input = createWav()

    new DataView(input).setUint16(34, 8, true)

    expect(() => validateWav(input)).toThrow(MediaValidationError)
  })

  test('音声データを持たないWAVを拒否する', () => {
    expect(() => validateWav(createWav(44))).toThrow(MediaValidationError)
  })

  test('音声のバイトレートが不整合なWAVを拒否する', () => {
    const input = createWav()

    new DataView(input).setUint32(28, 1, true)

    expect(() => validateWav(input)).toThrow(MediaValidationError)
  })
})

describe('日記に添付するメディアの検証', () => {
  test('写真・音声なしを受け付ける', async () => {
    expect(await prepareMedia({})).toEqual({
      narration: undefined,
      photos: [],
    })
  })

  test('有効な音声を保存用データに変換する', async () => {
    const input = createWav()
    const result = await prepareMedia({
      narration: new File([input], 'narration.wav', { type: 'audio/wav' }),
    })

    expect(result.narration).toEqual(Buffer.from(input))
    expect(result.photos).toEqual([])
  })

  test('写真2枚を拒否する', async () => {
    const photo = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' })

    await expect(prepareMedia({ photos: [photo, photo] })).rejects.toThrow(
      '写真は1枚までにしてください'
    )
  })

  test('音声2ファイルを拒否する', async () => {
    const audio = new File([createWav()], 'audio.wav', { type: 'audio/wav' })

    await expect(prepareMedia({ narration: [audio, audio] })).rejects.toThrow(
      '音声は1ファイルまでにしてください'
    )
  })

  test('20MBを超える写真を拒否する', async () => {
    const photo = new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], 'large.jpg', {
      type: 'image/jpeg',
    })

    await expect(prepareMedia({ photos: photo })).rejects.toThrow('写真は20MB以内にしてください')
  })

  test('20MBを超える音声ファイルを拒否する', async () => {
    const audio = new File([new Uint8Array(MAX_AUDIO_BYTES + 1)], 'large.wav', {
      type: 'audio/wav',
    })

    await expect(prepareMedia({ narration: audio })).rejects.toThrow('音声は20MB以内にしてください')
  })

  test('ファイルの代わりに渡された文字列を拒否する', async () => {
    await expect(prepareMedia({ photos: '../../private.jpg' })).rejects.toThrow(
      '写真の送信形式が不正です'
    )

    await expect(prepareMedia({ narration: '../../private.wav' })).rejects.toThrow(
      '音声の送信形式が不正です'
    )
  })

  test('名前とMIMEタイプだけWAVにした不正データを拒否する', async () => {
    const audio = new File(['not a wav'], 'narration.wav', { type: 'audio/wav' })

    await expect(prepareMedia({ narration: audio })).rejects.toThrow(MediaValidationError)
  })

  test('名前とMIMEタイプだけJPEGにした不正データを拒否する', async () => {
    const photo = new File(['<script>alert(1)</script>'], 'photo.jpg', {
      type: 'image/jpeg',
    })

    await expect(prepareMedia({ photos: photo })).rejects.toThrow(MediaValidationError)
  })
})
