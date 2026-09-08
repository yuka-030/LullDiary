// apps/server/src/story/storyRequest.ts
import { z } from 'zod'
import { validateTextInput } from '../validation/textInput'

// 物語生成リクエストの検証
export const StoryRequestSchema = z
  .object({
    text: z.string(),
    input_type: z.enum(['voice', 'text']),
  })
  .superRefine((value, context) => {
    const error =
      value.input_type === 'text'
        ? validateTextInput(value.text)
        : value.text.trim().length === 0
          ? '入力テキストが空です'
          : null

    if (error) {
      context.addIssue({ code: 'custom', path: ['text'], message: error })
    }
  })
