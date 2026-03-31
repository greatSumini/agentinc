/**
 * Normal Server
 *
 * Hono app for normal mode. Active after onboarding is completed.
 * Provides dashboard API endpoints.
 */

import { Hono } from 'hono'
import type { EventBus } from './shared/event-bus.js'
import { createSSEHandler } from './shared/sse-handler.js'
import type { Orchestrator } from '../daemon/orchestrator.js'
import { TicketService, InvalidTransitionError } from '../core/services/ticket.service.js'
import { listTickets, getTicket, VersionConflictError } from '../core/store/ticket-store.js'
import { listAgents } from '../core/store/agent-store.js'
import type { TicketStatus, TicketPriority, TicketType } from '../core/types.js'

export function createNormalServer(
  rootDir: string,
  eventBus: EventBus,
  orchestrator: Orchestrator
): Hono {
  const app = new Hono()
  const ticketService = new TicketService(rootDir)

  // Health check
  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  // === Tickets ===

  // GET /api/tickets — List tickets with optional filters
  app.get('/api/tickets', (c) => {
    const status = c.req.query('status') as TicketStatus | undefined
    const assignee = c.req.query('assignee')
    const type = c.req.query('type') as TicketType | undefined

    const tickets = listTickets(rootDir, { status, assignee, type })
    return c.json(tickets)
  })

  // POST /api/tickets — Create a ticket
  app.post('/api/tickets', async (c) => {
    const body = await c.req.json<{
      title: string
      prompt: string
      assignee: string
      priority?: TicketPriority
      cc?: string[]
    }>()

    if (!body.title || !body.prompt || !body.assignee) {
      return c.json({ error: 'Missing required fields: title, prompt, assignee' }, 400)
    }

    const ticket = ticketService.createWithCC({
      title: body.title,
      prompt: body.prompt,
      assignee: body.assignee,
      priority: body.priority,
      createdBy: 'user',
      cc: body.cc,
    })

    eventBus.emit('ticket:created', ticket)

    return c.json(ticket, 201)
  })

  // GET /api/tickets/:id — Get ticket details
  app.get('/api/tickets/:id', (c) => {
    const id = c.req.param('id')
    const ticket = getTicket(rootDir, id)

    if (!ticket) {
      return c.json({ error: 'Ticket not found' }, 404)
    }

    return c.json(ticket)
  })

  // PATCH /api/tickets/:id — Update ticket
  app.patch('/api/tickets/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json<{
      status?: TicketStatus
      priority?: TicketPriority
      expectedVersion: number
    }>()

    if (body.expectedVersion === undefined) {
      return c.json({ error: 'Missing required field: expectedVersion' }, 400)
    }

    const ticket = getTicket(rootDir, id)
    if (!ticket) {
      return c.json({ error: 'Ticket not found' }, 404)
    }

    try {
      let updatedTicket = ticket

      // Handle status update via service (validates transitions)
      if (body.status !== undefined) {
        updatedTicket = ticketService.updateStatus(id, body.status, body.expectedVersion)
      }

      // Handle priority update directly if no status change
      if (body.priority !== undefined && body.status === undefined) {
        const { updateTicket } = await import('../core/store/ticket-store.js')
        updatedTicket = updateTicket(rootDir, id, { priority: body.priority }, body.expectedVersion)
      }

      eventBus.emit('ticket:updated', updatedTicket)

      return c.json(updatedTicket)
    } catch (error) {
      if (error instanceof VersionConflictError) {
        return c.json(
          {
            error: 'Version conflict',
            expectedVersion: error.expectedVersion,
            currentVersion: error.currentVersion,
          },
          409
        )
      }
      if (error instanceof InvalidTransitionError) {
        return c.json(
          {
            error: 'Invalid status transition',
            from: error.from,
            to: error.to,
          },
          400
        )
      }
      throw error
    }
  })

  // === Agents ===

  // GET /api/agents — List agents with real-time status
  app.get('/api/agents', (c) => {
    const agents = listAgents(rootDir)
    const statuses = orchestrator.getAgentStatuses()

    const agentsWithStatus = agents.map((agent) => ({
      ...agent,
      status: statuses.get(agent.name) || 'offline',
    }))

    return c.json(agentsWithStatus)
  })

  // === Chat (Talk to CEO) ===

  // POST /api/chat — CEO conversation session
  app.post('/api/chat', async (c) => {
    const body = await c.req.json<{ message: string }>()

    if (!body.message || typeof body.message !== 'string') {
      return c.json({ error: 'Missing required field: message' }, 400)
    }

    // TODO: Phase 8에서 구현 — CEO claude session을 --print 모드로 spawn, 응답 반환
    console.log('[chat] Received message:', body.message)

    return c.json({ response: 'Chat not yet implemented' })
  })

  // === Hooks ===

  // POST /api/hooks/session-end — SessionEnd hook receiver
  app.post('/api/hooks/session-end', async (c) => {
    const body = await c.req.json<{ transcript?: string }>()

    // TODO: Phase 8에서 구현 — 학습 내용 기록 로직
    console.log('[hooks] Session ended, transcript length:', body.transcript?.length ?? 0)

    return c.json({ ok: true })
  })

  // === Events ===

  // GET /api/events — SSE stream (ticket, agent events)
  app.get('/api/events', createSSEHandler(eventBus))

  return app
}
