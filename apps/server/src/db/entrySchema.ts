// apps/server/src/db/entrySchema.ts
import { z } from 'zod'
import { TAG_OPTIONS } from '../tag/ollama'

// タグの検証スキーマ
const TagsSchema = z.object({
  シーン: z.enum(TAG_OPTIONS.シーン),
  感情: z.array(z.enum(TAG_OPTIONS.感情)).min(1),
})

// POST /entries のテキストフィールド
export const CreateEntryFieldsSchema = z.object({
  input_type: z.enum(['voice', 'text']),
  raw_input_text: z.string().min(1),
  story_text: z.string().min(1),
  tags: TagsSchema,
})

// PATCH /entries/:id のテキストフィールド
export const UpdateEntryFieldsSchema = z.object({
  story_text: z.string().min(1).optional(),
  tags: TagsSchema.optional(),
})

// GET /entries のクエリパラメータ
export const ListEntriesQuerySchema = z.object({
  scene: z.enum(TAG_OPTIONS.シーン).optional(),
  emotions: z.array(z.enum(TAG_OPTIONS.感情)).optional(),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
})
