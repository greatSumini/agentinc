import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import type { Ticket, TicketStatus, TicketType, TicketPriority } from '../types.js'

const CONFIG_DIR = '.auto-startup'
const TICKETS_DIR = 'tickets'

const PRIORITY_ORDER: Record<TicketPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}

function getTicketsDir(rootDir: string): string {
  return path.join(rootDir, CONFIG_DIR, TICKETS_DIR)
}

function getTicketPath(rootDir: string, id: string): string {
  return path.join(getTicketsDir(rootDir), `${id}.json`)
}

export function createTicket(rootDir: string, ticket: Ticket): Ticket {
  const ticketsDir = getTicketsDir(rootDir)
  if (!fs.existsSync(ticketsDir)) {
    fs.mkdirSync(ticketsDir, { recursive: true })
  }

  const newTicket: Ticket = {
    ...ticket,
    id: ticket.id || crypto.randomUUID(),
    version: 1,
    createdAt: new Date().toISOString(),
  }

  const ticketPath = getTicketPath(rootDir, newTicket.id)
  fs.writeFileSync(ticketPath, JSON.stringify(newTicket, null, 2))

  return newTicket
}

export function getTicket(rootDir: string, id: string): Ticket | null {
  const ticketPath = getTicketPath(rootDir, id)
  if (!fs.existsSync(ticketPath)) {
    return null
  }
  const content = fs.readFileSync(ticketPath, 'utf-8')
  return JSON.parse(content) as Ticket
}

export interface TicketFilter {
  status?: TicketStatus
  assignee?: string
  type?: TicketType
}

export function listTickets(rootDir: string, filter?: TicketFilter): Ticket[] {
  const ticketsDir = getTicketsDir(rootDir)
  if (!fs.existsSync(ticketsDir)) {
    return []
  }

  const files = fs.readdirSync(ticketsDir).filter((f) => f.endsWith('.json'))
  const tickets: Ticket[] = []

  for (const file of files) {
    const content = fs.readFileSync(path.join(ticketsDir, file), 'utf-8')
    const ticket = JSON.parse(content) as Ticket

    if (filter) {
      if (filter.status !== undefined && ticket.status !== filter.status) {
        continue
      }
      if (filter.assignee !== undefined && ticket.assignee !== filter.assignee) {
        continue
      }
      if (filter.type !== undefined && ticket.type !== filter.type) {
        continue
      }
    }

    tickets.push(ticket)
  }

  // Sort by priority (urgent > high > normal > low), then by createdAt (ascending)
  tickets.sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (priorityDiff !== 0) {
      return priorityDiff
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  return tickets
}

export class VersionConflictError extends Error {
  constructor(
    public ticketId: string,
    public expectedVersion: number,
    public currentVersion: number
  ) {
    super(
      `Version conflict for ticket ${ticketId}: expected version ${expectedVersion}, but current version is ${currentVersion}`
    )
    this.name = 'VersionConflictError'
  }
}

export function updateTicket(
  rootDir: string,
  id: string,
  updates: Partial<Ticket>,
  expectedVersion: number
): Ticket {
  const ticket = getTicket(rootDir, id)
  if (!ticket) {
    throw new Error(`Ticket not found: ${id}`)
  }

  if (ticket.version !== expectedVersion) {
    throw new VersionConflictError(id, expectedVersion, ticket.version)
  }

  const updatedTicket: Ticket = {
    ...ticket,
    ...updates,
    id: ticket.id, // Prevent id from being overwritten
    version: ticket.version + 1,
    createdAt: ticket.createdAt, // Prevent createdAt from being overwritten
  }

  const ticketPath = getTicketPath(rootDir, id)
  fs.writeFileSync(ticketPath, JSON.stringify(updatedTicket, null, 2))

  return updatedTicket
}

export function deleteTicket(rootDir: string, id: string): boolean {
  const ticketPath = getTicketPath(rootDir, id)
  if (!fs.existsSync(ticketPath)) {
    return false
  }
  fs.unlinkSync(ticketPath)
  return true
}
