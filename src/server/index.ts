/**
 * Server Entry Points
 *
 * Provides separate server starters for onboarding and normal modes.
 */

import { Hono } from 'hono'
import { serve, type ServerType } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { createOnboardingServer } from './onboarding.js'
import { createNormalServer } from './normal.js'
import { EventBus } from './shared/event-bus.js'
import type { Orchestrator } from '../daemon/orchestrator.js'

const STATIC_DIR = './dist/web'

function setupStaticServing(app: Hono): void {
  // Serve static files from dist/web
  app.use('/*', serveStatic({ root: STATIC_DIR }))

  // SPA fallback: serve index.html for non-API GET requests that don't match static files
  app.get('*', async (c) => {
    const requestPath = c.req.path

    // Skip API routes
    if (requestPath.startsWith('/api/')) {
      return c.notFound()
    }

    // Try to serve index.html for SPA routing
    const indexPath = path.join(STATIC_DIR, 'index.html')
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8')
      return c.html(content)
    }

    return c.notFound()
  })
}

export interface ServerInstance {
  server: ServerType
  eventBus: EventBus
}

export function startOnboardingServer(rootDir: string, port: number): ServerInstance {
  const eventBus = new EventBus()
  const app = createOnboardingServer(rootDir, eventBus)

  setupStaticServing(app)

  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[onboarding] Server running on http://localhost:${info.port}`)
  })

  return { server, eventBus }
}

export function startNormalServer(
  rootDir: string,
  port: number,
  orchestrator: Orchestrator
): ServerInstance {
  const eventBus = new EventBus()
  const app = createNormalServer(rootDir, eventBus, orchestrator)

  setupStaticServing(app)

  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[normal] Server running on http://localhost:${info.port}`)
  })

  return { server, eventBus }
}

// Re-export types and utilities
export { EventBus } from './shared/event-bus.js'
export { createSSEHandler } from './shared/sse-handler.js'
export { createOnboardingServer } from './onboarding.js'
export { createNormalServer } from './normal.js'
