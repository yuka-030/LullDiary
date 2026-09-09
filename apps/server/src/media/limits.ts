// apps/server/src/media/limits.ts

// 写真ファイルの容量上限
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024

// 音声ファイルの容量上限
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024

// 写真と音声とフォーム項目を含むリクエストの容量上限
export const MAX_UPLOAD_BYTES = MAX_PHOTO_BYTES + MAX_AUDIO_BYTES + 1024 * 1024

// メディア入力の検証エラー
export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaValidationError'
  }
}
