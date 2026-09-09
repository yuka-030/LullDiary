// apps/server/src/media/paths.ts
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

// app_dataのルート
const APP_DATA_DIR = path.join(import.meta.dir, '..', '..', 'app_data')

// 日記IDの形式
const ENTRY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// 写真ファイル名の形式
const PHOTO_FILENAME_PATTERN = /^photo[1-9]\d*\.jpg$/

// 日記IDの検証
function validateEntryId(id: string): void {
  if (!ENTRY_ID_PATTERN.test(id)) {
    throw new Error('日記IDの形式が不正です')
  }
}

// 読み上げ音声の保存先
export function narrationPath(id: string): string {
  validateEntryId(id)

  return path.join(APP_DATA_DIR, 'narration', `${id}.wav`)
}

// 写真の保存先ディレクトリ
export function photosDir(id: string): string {
  validateEntryId(id)

  return path.join(APP_DATA_DIR, 'photos', id)
}

// 写真の保存先
export function photoPath(id: string, filename: string): string {
  if (!PHOTO_FILENAME_PATTERN.test(filename)) {
    throw new Error('写真ファイル名の形式が不正です')
  }

  return path.join(photosDir(id), filename)
}

// 保存先ディレクトリの作成
export function ensureMediaDirs(id: string): void {
  const directory = photosDir(id)

  mkdirSync(path.join(APP_DATA_DIR, 'narration'), { recursive: true })
  mkdirSync(directory, { recursive: true })
}

// 保存済みメディアの削除
export function removeMedia(id: string): void {
  const audioPath = narrationPath(id)
  const directory = photosDir(id)

  rmSync(audioPath, { force: true })
  rmSync(directory, { recursive: true, force: true })
}

// 保存済み写真の削除
export function removePhotos(id: string): void {
  rmSync(photosDir(id), { recursive: true, force: true })
}
