// apps/server/src/db/entrySchema.test.ts
import { describe, expect, test } from 'bun:test'
import { CreateEntryFieldsSchema, UpdateEntryFieldsSchema } from './entrySchema'

// 保存用の入力
const entry = {
  input_type: 'text',
  raw_input_text: 'あ'.repeat(120),
  story_text: '物語'.repeat(100),
  tags: { シーン: '自然', 感情: ['穏やか'] },
}

describe('保存時の入力検証', () => {
  test('120字のテキスト入力を許可する', () => {
    expect(CreateEntryFieldsSchema.safeParse(entry).success).toBe(true)
  })

  test('121字のテキスト入力を拒否する', () => {
    expect(
      CreateEntryFieldsSchema.safeParse({ ...entry, raw_input_text: 'あ'.repeat(121) }).success
    ).toBe(false)
  })

  test('空文字と空白だけの入力を拒否する', () => {
    for (const raw_input_text of ['', '　 \n']) {
      expect(CreateEntryFieldsSchema.safeParse({ ...entry, raw_input_text }).success).toBe(false)
    }
  })

  test('音声入力と生成済みの物語文に120字制限を適用しない', () => {
    expect(
      CreateEntryFieldsSchema.safeParse({
        ...entry,
        input_type: 'voice',
        raw_input_text: 'あ'.repeat(121),
      }).success
    ).toBe(true)

    expect(UpdateEntryFieldsSchema.safeParse({ story_text: '物語'.repeat(100) }).success).toBe(true)
  })
})
