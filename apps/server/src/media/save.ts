// apps/server/src/media/save.ts
import { writeFile } from 'node:fs/promises'
import { ensureMediaDirs, narrationPath, photoPath } from './paths'

// 検証済みの読み上げ音声の保存
export async function saveNarration(id: string, audio: Buffer): Promise<string> {
  ensureMediaDirs(id)

  const filePath = narrationPath(id)

  await writeFile(filePath, audio)

  return filePath
}

// 変換済みの写真の保存
export async function savePhotos(id: string, photos: Buffer[]): Promise<string[]> {
  if (photos.length > 1) {
    throw new Error('写真は1枚までにしてください')
  }

  if (photos.length === 0) {
    return []
  }

  ensureMediaDirs(id)

  const filePath = photoPath(id, 'photo1.jpg')

  await writeFile(filePath, photos[0])

  return [filePath]
}
