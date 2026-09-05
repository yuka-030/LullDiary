// apps/desktop/src/lib/shared/entryClient.ts
import type { InputType } from '../story/useStory'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL が設定されていません')
}

// タグ情報
export type Tags = {
  シーン: string
  感情: string[]
}

// 日記エントリの保存に必要な情報
export type CreateEntryInput = {
  inputType: InputType
  rawInputText: string
  storyText: string
  tags: Tags
  narration?: Blob
  photos?: File[]
}

// 日記エントリをサーバーに保存する
export async function createEntry(input: CreateEntryInput): Promise<void> {
  const form = new FormData()

  form.append('input_type', input.inputType)
  form.append('raw_input_text', input.rawInputText)
  form.append('story_text', input.storyText)
  form.append('tags', JSON.stringify(input.tags))

  if (input.narration) {
    form.append('narration', input.narration, 'narration.wav')
  }

  for (const photo of input.photos ?? []) {
    form.append('photos', photo, photo.name)
  }

  const response = await fetch(`${API_BASE_URL}/entries`, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body && typeof body.error === 'string' ? body.error : '日記の保存に失敗しました'
    throw new Error(message)
  }
}
