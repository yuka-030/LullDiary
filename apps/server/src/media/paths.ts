// apps/server/src/media/paths.ts
import { mkdirSync } from 'node:fs'
import path from 'node:path'

// app_dataのルート
const APP_DATA_DIR = path.join(import.meta.dir, '..', '..', 'app_data')

// 読み上げ音声の保存先
export function narrationPath(id: string): string {
  return path.join(APP_DATA_DIR, 'narration', `${id}.wav`)
}

// 写真の保存先ディレクトリ
export function photosDir(id: string): string {
  return path.join(APP_DATA_DIR, 'photos', id)
}

// 写真の保存先
export function photoPath(id: string, filename: string): string {
  return path.join(photosDir(id), filename)
}

// 保存先ディレクトリの作成
export function ensureMediaDirs(id: string): void {
  mkdirSync(path.join(APP_DATA_DIR, 'narration'), { recursive: true })
  mkdirSync(photosDir(id), { recursive: true })
}
