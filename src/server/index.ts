import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

const app = new Hono()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Static files (built web UI)
app.use('/*', serveStatic({ root: './dist/web' }))

export function startServer(port: number = 3847) {
  return serve({ fetch: app.fetch, port }, (info) => {
    console.log(`auto-startup server running on http://localhost:${info.port}`)
  })
}

export { app }
