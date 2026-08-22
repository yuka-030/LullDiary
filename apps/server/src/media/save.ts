// apps/server/src/media/save.ts
import { writeFile } from 'node:fs/promises'
import { ensureMediaDirs, narrationPath, photoPath } from './paths'
import { processPhoto } from './photo'

// 読み上げ音声の保存
export async function saveNarration(id: string, file: File): Promise<string> {
  ensureMediaDirs(id)

  const buffer = Buffer.from(await file.arrayBuffer())
  const filePath = narrationPath(id)

  await writeFile(filePath, buffer)

  return filePath
}

// 写真の保存
export async function savePhotos(id: string, files: File[]): Promise<string[]> {
  ensureMediaDirs(id)

  const paths: string[] = []

  for (let index = 0; index < files.length; index += 1) {
    const processed = await processPhoto(await files[index].arrayBuffer())
    const filePath = photoPath(id, `photo${index + 1}.jpg`)

    await writeFile(filePath, processed)
    paths.push(filePath)
  }

  return paths
}
