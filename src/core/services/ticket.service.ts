import * as crypto from 'node:crypto'
import type { Ticket, TicketStatus, TicketPriority } from '../types.js'
import {
  createTicket,
  getTicket,
  updateTicket,
} from '../store/ticket-store.js'

export class InvalidTransitionError extends Error {
  constructor(
    public from: TicketStatus,
    public to: TicketStatus
  ) {
    super(`Invalid status transition from '${from}' to '${to}'`)
    this.name = 'InvalidTransitionError'
  }
}

export class TicketService {
  private static VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
    blocked: ['ready', 'cancelled'],
    ready: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'failed'],
    completed: [],
    failed: [],
    cancelled: [],
  }

  constructor(private rootDir: string) {}

  validateTransition(from: TicketStatus, to: TicketStatus): boolean {
    const validTargets = TicketService.VALID_TRANSITIONS[from]
    return validTargets.includes(to)
  }

  createWithCC(params: {
    title: string
    prompt: string
    assignee: string
    priority?: TicketPriority
    createdBy: string
    cc?: string[]
  }): Ticket {
    const { title, prompt, assignee, priority = 'normal', createdBy, cc } = params

    const hasCc = cc && cc.length > 0

    // Create the main task ticket
    const taskTicket = createTicket(this.rootDir, {
      id: crypto.randomUUID(),
      title,
      prompt,
      type: 'task',
      assignee,
      priority,
      status: hasCc ? 'blocked' : 'ready',
      createdBy,
      createdAt: '',
      comments: [],
      version: 0,
      ccReviewTicketIds: hasCc ? [] : undefined,
    })

    if (!hasCc) {
      return taskTicket
    }

    // Create cc_review tickets for each CC agent
    const ccReviewTicketIds: string[] = []

    for (const ccAgent of cc) {
      const ccReviewTicket = createTicket(this.rootDir, {
        id: crypto.randomUUID(),
        title: `[CC Review] ${title}`,
        prompt,
        type: 'cc_review',
        parentTicketId: taskTicket.id,
        assignee: ccAgent,
        priority,
        status: 'ready',
        createdBy,
        createdAt: '',
        comments: [],
        version: 0,
      })
      ccReviewTicketIds.push(ccReviewTicket.id)
    }

    // Update task ticket with cc_review ticket IDs
    const updatedTaskTicket = updateTicket(
      this.rootDir,
      taskTicket.id,
      { ccReviewTicketIds },
      taskTicket.version
    )

    return updatedTaskTicket
  }

  checkAndUnblockParent(ccReviewTicketId: string): void {
    const ccReviewTicket = getTicket(this.rootDir, ccReviewTicketId)
    if (!ccReviewTicket || ccReviewTicket.type !== 'cc_review') {
      return
    }

    const parentTicketId = ccReviewTicket.parentTicketId
    if (!parentTicketId) {
      return
    }

    const parentTicket = getTicket(this.rootDir, parentTicketId)
    if (!parentTicket || parentTicket.status !== 'blocked') {
      return
    }

    const ccReviewTicketIds = parentTicket.ccReviewTicketIds
    if (!ccReviewTicketIds || ccReviewTicketIds.length === 0) {
      return
    }

    // Check if all cc_review tickets are completed
    const allCompleted = ccReviewTicketIds.every((id) => {
      const ticket = getTicket(this.rootDir, id)
      return ticket?.status === 'completed'
    })

    if (allCompleted) {
      updateTicket(
        this.rootDir,
        parentTicketId,
        { status: 'ready' },
        parentTicket.version
      )
    }
  }

  updateStatus(ticketId: string, newStatus: TicketStatus, expectedVersion: number): Ticket {
    const ticket = getTicket(this.rootDir, ticketId)
    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`)
    }

    if (!this.validateTransition(ticket.status, newStatus)) {
      throw new InvalidTransitionError(ticket.status, newStatus)
    }

    const updates: Partial<Ticket> = { status: newStatus }

    // Record timestamps for terminal states
    const now = new Date().toISOString()
    if (newStatus === 'completed') {
      updates.completedAt = now
    } else if (newStatus === 'failed') {
      updates.completedAt = now
    } else if (newStatus === 'cancelled') {
      updates.cancelledAt = now
    } else if (newStatus === 'in_progress') {
      updates.startedAt = now
    }

    const updatedTicket = updateTicket(this.rootDir, ticketId, updates, expectedVersion)

    // If cc_review completed, check and unblock parent
    if (ticket.type === 'cc_review' && newStatus === 'completed') {
      this.checkAndUnblockParent(ticketId)
    }

    return updatedTicket
  }

  addComment(ticketId: string, author: string, content: string, expectedVersion: number): Ticket {
    const ticket = getTicket(this.rootDir, ticketId)
    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`)
    }

    const newComment = {
      id: crypto.randomUUID(),
      author,
      content,
      createdAt: new Date().toISOString(),
    }

    const updatedComments = [...ticket.comments, newComment]

    return updateTicket(this.rootDir, ticketId, { comments: updatedComments }, expectedVersion)
  }
}
