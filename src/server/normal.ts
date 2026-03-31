/**
 * Normal Server
 *
 * Hono app for normal mode. Active after onboarding is completed.
 * Provides dashboard API endpoints.
 */

import { Hono } from 'hono'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import type { EventBus } from './shared/event-bus.js'
import { createSSEHandler } from './shared/sse-handler.js'
import type { Orchestrator } from '../daemon/orchestrator.js'
import { TicketService, InvalidTransitionError } from '../core/services/ticket.service.js'
import { listTickets, getTicket, VersionConflictError } from '../core/store/ticket-store.js'
import { listAgents, getAgentSubagents } from '../core/store/agent-store.js'
import { getConfig } from '../core/store/config-store.js'
import { spawnClaude } from '../claude-runner/spawner.js'
import type { TicketStatus, TicketPriority, TicketType } from '../core/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getAgentMcpServerPath(): string {
  // Try dist path (production)
  const distPath = path.resolve(__dirname, '../../mcp/agent-mcp.js')
  if (fs.existsSync(distPath)) {
    return distPath
  }
  return distPath // Return dist path anyway, it should exist after build
}

function subagentConfigToClaudeFormat(
  config: { name: string; description: string; prompt: string; model?: string; tools?: string }
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: config.name,
    description: config.description,
    prompt: config.prompt,
  }
  if (config.model) result.model = config.model
  if (config.tools) result.tools = config.tools
  return result
}

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

    const config = getConfig(rootDir)
    if (!config || !config.onboardingCompleted) {
      return c.json({ error: 'Onboarding not completed' }, 400)
    }

    // Check if CEO agent exists
    const ceoPromptPath = path.join(rootDir, '.auto-startup', 'agents', 'ceo', 'prompt.md')
    if (!fs.existsSync(ceoPromptPath)) {
      return c.json({ error: 'CEO agent not found' }, 400)
    }

    try {
      // Create tmp directory for this session
      const tmpDir = path.join(rootDir, '.auto-startup', '.tmp', `chat-${randomUUID()}`)
      fs.mkdirSync(tmpDir, { recursive: true })

      // 1. Create temp mcp.json (agent-mcp server)
      const mcpConfig = {
        mcpServers: {
          'auto-startup': {
            command: 'node',
            args: [getAgentMcpServerPath(), '--root', rootDir, '--port', String(config.port)],
          },
        },
      }
      const mcpConfigPath = path.join(tmpDir, 'mcp.json')
      fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2))

      // 2. Build subagents JSON (include context-engineer)
      const ceoSubagents = getAgentSubagents(rootDir, 'ceo')
      const agentsMap: Record<string, Record<string, unknown>> = {}
      for (const subagent of ceoSubagents) {
        agentsMap[subagent.name] = subagentConfigToClaudeFormat(subagent)
      }

      // 3. Build flags
      const flags: string[] = [
        '--print',
        '-p',
        body.message,
        '--append-system-prompt-file',
        ceoPromptPath,
        '--mcp-config',
        mcpConfigPath,
      ]

      if (Object.keys(agentsMap).length > 0) {
        flags.push('--agents', JSON.stringify(agentsMap))
      }

      // 4. Spawn claude and wait for response
      const result = await spawnClaude(flags, {}, { cwd: rootDir, stdio: 'pipe' })

      // 5. Cleanup tmp directory
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }

      // 6. Return response
      if (result.exitCode !== 0) {
        console.error('[chat] Claude exited with code:', result.exitCode, result.stderr)
        return c.json({ error: 'Failed to get response from CEO', details: result.stderr }, 500)
      }

      return c.json({ response: result.stdout.trim() })
    } catch (error) {
      console.error('[chat] Error:', error)
      return c.json(
        { error: 'Internal error', details: error instanceof Error ? error.message : String(error) },
        500
      )
    }
  })

  // === Hooks ===

  // POST /api/hooks/session-end — SessionEnd hook receiver
  app.post('/api/hooks/session-end', async (c) => {
    const body = await c.req.json<{ agentName?: string; transcript?: string }>()

    // Log session end event
    console.log('[hooks] Session ended for agent:', body.agentName ?? 'unknown')

    // TODO: Future enhancement — process transcript for learning

    return c.json({ ok: true })
  })

  // === Events ===

  // GET /api/events — SSE stream (ticket, agent events)
  app.get('/api/events', createSSEHandler(eventBus))

  return app
}
