/**
 * Agent Worker Process
 *
 * This file is the entry point for child_process.fork().
 * It polls for ready tickets assigned to this agent and executes them.
 *
 * Environment variables:
 * - AGENT_NAME: Name of the agent this worker handles
 * - ROOT_DIR: Project root directory
 * - SERVER_PORT: HTTP server port for ticket API
 */

import { runClaude } from '../claude-runner/index.js'
import type { Ticket } from '../core/types.js'

const POLL_INTERVAL = 5000 // 5 seconds
const IDLE_TIMEOUT = 180000 // 3 minutes

export interface WorkerMessage {
  type: 'heartbeat' | 'status'
  agentName: string
  status: 'idle' | 'working' | 'offline'
  ticketId?: string
}

function sendMessage(message: WorkerMessage): void {
  if (process.send) {
    process.send(message)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface TicketResponse {
  data: Ticket[]
}

interface TicketPatchResponse {
  data: Ticket
}

async function fetchReadyTickets(
  serverPort: number,
  agentName: string
): Promise<Ticket[]> {
  const url = `http://localhost:${serverPort}/api/tickets?assignee=${encodeURIComponent(agentName)}&status=ready`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch tickets: ${response.status}`)
  }
  const json = (await response.json()) as TicketResponse
  return json.data
}

async function updateTicketStatus(
  serverPort: number,
  ticketId: string,
  status: string,
  version: number,
  result?: { exitCode: number; logPath: string }
): Promise<Ticket> {
  const url = `http://localhost:${serverPort}/api/tickets/${ticketId}`
  const body: Record<string, unknown> = { status, version }
  if (result) {
    body.result = result
  }
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`Failed to update ticket: ${response.status}`)
  }
  const json = (await response.json()) as TicketPatchResponse
  return json.data
}

async function runWorker(): Promise<void> {
  const agentName = process.env.AGENT_NAME
  const rootDir = process.env.ROOT_DIR
  const serverPortStr = process.env.SERVER_PORT

  if (!agentName || !rootDir || !serverPortStr) {
    console.error('Missing required environment variables: AGENT_NAME, ROOT_DIR, SERVER_PORT')
    process.exit(1)
  }

  const serverPort = parseInt(serverPortStr, 10)
  if (isNaN(serverPort)) {
    console.error('Invalid SERVER_PORT')
    process.exit(1)
  }

  let isShuttingDown = false
  let isWorking = false
  let idleTime = 0

  // Graceful shutdown handler
  process.on('SIGTERM', () => {
    isShuttingDown = true
    if (!isWorking) {
      sendMessage({ type: 'status', agentName, status: 'offline' })
      process.exit(0)
    }
    // If working, continue until current task completes
  })

  // Main polling loop
  while (!isShuttingDown || isWorking) {
    // Send heartbeat
    sendMessage({
      type: 'heartbeat',
      agentName,
      status: isWorking ? 'working' : 'idle',
    })

    if (isShuttingDown && !isWorking) {
      break
    }

    try {
      const tickets = await fetchReadyTickets(serverPort, agentName)

      if (tickets.length > 0) {
        const ticket = tickets[0]
        isWorking = true
        idleTime = 0

        // Send working status
        sendMessage({
          type: 'status',
          agentName,
          status: 'working',
          ticketId: ticket.id,
        })

        try {
          // Update ticket to in_progress
          const inProgressTicket = await updateTicketStatus(
            serverPort,
            ticket.id,
            'in_progress',
            ticket.version
          )

          // Run Claude
          const result = await runClaude({
            rootDir,
            agentName,
            prompt: ticket.prompt,
            printMode: true,
          })

          // Update ticket based on result
          const finalStatus = result.exitCode === 0 ? 'completed' : 'failed'
          await updateTicketStatus(
            serverPort,
            ticket.id,
            finalStatus,
            inProgressTicket.version,
            { exitCode: result.exitCode, logPath: '' }
          )
        } catch (err) {
          console.error(`Error processing ticket ${ticket.id}:`, err)
          // Try to mark as failed
          try {
            await updateTicketStatus(
              serverPort,
              ticket.id,
              'failed',
              ticket.version + 1,
              { exitCode: 1, logPath: '' }
            )
          } catch {
            // Ignore update errors
          }
        }

        isWorking = false

        // Send idle status
        sendMessage({
          type: 'status',
          agentName,
          status: 'idle',
        })

        // Check if we should shutdown after completing work
        if (isShuttingDown) {
          break
        }
      } else {
        // No tickets available
        idleTime += POLL_INTERVAL

        if (idleTime > IDLE_TIMEOUT) {
          console.log(`Worker ${agentName} idle timeout reached, exiting`)
          break
        }
      }
    } catch (err) {
      console.error(`Error in worker loop:`, err)
    }

    await sleep(POLL_INTERVAL)
  }

  // Send offline status before exit
  sendMessage({ type: 'status', agentName, status: 'offline' })
  process.exit(0)
}

// Entry point - run immediately when forked
runWorker().catch((err) => {
  console.error('Worker fatal error:', err)
  process.exit(1)
})
