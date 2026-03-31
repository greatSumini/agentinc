/**
 * SSE Handler
 *
 * Creates an SSE route handler using Hono's streaming API.
 */

import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import * as crypto from 'node:crypto'
import type { EventBus } from './event-bus.js'

export function createSSEHandler(eventBus: EventBus) {
  return (c: Context) => {
    return streamSSE(c, async (stream) => {
      const clientId = crypto.randomUUID()

      // Subscribe to events
      eventBus.subscribe(clientId, (data: string) => {
        stream.writeSSE({ data }).catch(() => {
          // Client disconnected, ignore write error
        })
      })

      // Keep connection alive with heartbeat
      const heartbeatInterval = setInterval(() => {
        stream.writeSSE({ event: 'heartbeat', data: '' }).catch(() => {
          // Client disconnected
          clearInterval(heartbeatInterval)
        })
      }, 30000)

      // Wait for client disconnect (stream abort)
      stream.onAbort(() => {
        clearInterval(heartbeatInterval)
        eventBus.unsubscribe(clientId)
      })

      // Keep the stream open
      await new Promise(() => {
        // Never resolves - stream stays open until abort
      })
    })
  }
}
