import { Hono } from 'hono'

const app = new Hono()

app.get('/health', (c) => {
  return c.json({ status: 'ok' }, 200)
})

export default {
  port: 3000,
  fetch: app.fetch,
}
