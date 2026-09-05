// apps/desktop/src/lib/bookshelf/bookshelfClient.ts
import type { Tags } from '../shared/entryClient'
import type { Entry, EntryFilter } from './entryTypes'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL が設定されていません')
}

// 日記の更新で送る内容
export type UpdateEntryInput = {
  storyText?: string
  tags?: Tags
  narration?: Blob
  photos?: File[]
  clearPhotos?: boolean
}

// 絞り込み条件を付けて日記の一覧を取得する
export async function fetchEntries(filter: EntryFilter): Promise<Entry[]> {
  const params = new URLSearchParams()

  if (filter.scene) {
    params.append('scene', filter.scene)
  }

  for (const emotion of filter.emotions) {
    params.append('emotion', emotion)
  }

  const query = params.toString()
  const response = await fetch(`${API_BASE_URL}/entries${query ? `?${query}` : ''}`)

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body && typeof body.error === 'string' ? body.error : '日記の取得に失敗しました'
    throw new Error(message)
  }

  const body = await response.json()
  return body.entries as Entry[]
}

// 日記を更新する
export async function updateEntry(id: string, input: UpdateEntryInput): Promise<Entry> {
  const form = new FormData()

  if (input.storyText !== undefined) {
    form.append('story_text', input.storyText)
  }

  if (input.tags) {
    form.append('tags', JSON.stringify(input.tags))
  }

  if (input.narration) {
    form.append('narration', input.narration, 'narration.wav')
  }

  for (const photo of input.photos ?? []) {
    form.append('photos', photo, photo.name)
  }

  if (input.clearPhotos) {
    form.append('clear_photos', 'true')
  }

  const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
    method: 'PATCH',
    body: form,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body && typeof body.error === 'string' ? body.error : '日記の更新に失敗しました'
    throw new Error(message)
  }

  const body = await response.json()
  return body.entry as Entry
}

// 日記を削除する
export async function deleteEntry(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/entries/${id}`, { method: 'DELETE' })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body && typeof body.error === 'string' ? body.error : '日記の削除に失敗しました'
    throw new Error(message)
  }
}

// 読み上げ音声のURL
export function narrationUrl(id: string): string {
  return `${API_BASE_URL}/entries/${id}/narration`
}

// 写真のURL
export function photoUrl(id: string, storedPath: string): string {
  const filename = storedPath.split(/[\\/]/).pop() ?? ''

  return `${API_BASE_URL}/entries/${id}/photos/${filename}`
}
