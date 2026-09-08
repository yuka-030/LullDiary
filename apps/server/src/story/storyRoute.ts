// apps/server/src/story/storyRoute.ts
import { Hono } from 'hono'
import { generateStory, OllamaError } from './ollama'
import { StoryRequestSchema } from './storyRequest'

// 差し替え可能な物語生成処理
type GenerateStory = (text: string, seed: number) => Promise<string>

// 物語生成API
export function createStoryRoute(generate: GenerateStory = generateStory) {
  const app = new Hono()

  app.post('/generate-story', async (c) => {
    const body: unknown = await c.req.json().catch(() => null)
    const parsed = StoryRequestSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? '入力内容が不正です' }, 400)
    }

    try {
      const storyText = await generate(parsed.data.text, Date.now())

      return c.json({ story_text: storyText }, 200)
    } catch (err) {
      if (err instanceof OllamaError) {
        return c.json({ error: err.message }, 500)
      }

      return c.json({ error: '物語の生成に失敗しました' }, 500)
    }
  })

  return app
}
