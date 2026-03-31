import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { TicketService, InvalidTransitionError } from '../../src/core/services/ticket.service'
import { getTicket, createTicket } from '../../src/core/store/ticket-store'
import type { Ticket, TicketStatus } from '../../src/core/types'

describe('ticket.service', () => {
  let tmpDir: string
  let service: TicketService

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-startup-test-'))
    service = new TicketService(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function createTestTicket(overrides: Partial<Ticket> = {}): Ticket {
    return {
      id: '',
      title: 'Test Ticket',
      prompt: 'Test prompt',
      type: 'task',
      assignee: 'agent1',
      priority: 'normal',
      status: 'ready',
      createdBy: 'user',
      createdAt: '',
      comments: [],
      version: 0,
      ...overrides,
    }
  }

  describe('validateTransition', () => {
    it('blocked → ready: 유효', () => {
      expect(service.validateTransition('blocked', 'ready')).toBe(true)
    })

    it('blocked → cancelled: 유효', () => {
      expect(service.validateTransition('blocked', 'cancelled')).toBe(true)
    })

    it('blocked → in_progress: 무효', () => {
      expect(service.validateTransition('blocked', 'in_progress')).toBe(false)
    })

    it('ready → in_progress: 유효', () => {
      expect(service.validateTransition('ready', 'in_progress')).toBe(true)
    })

    it('ready → cancelled: 유효', () => {
      expect(service.validateTransition('ready', 'cancelled')).toBe(true)
    })

    it('ready → completed: 무효', () => {
      expect(service.validateTransition('ready', 'completed')).toBe(false)
    })

    it('in_progress → completed: 유효', () => {
      expect(service.validateTransition('in_progress', 'completed')).toBe(true)
    })

    it('in_progress → failed: 유효', () => {
      expect(service.validateTransition('in_progress', 'failed')).toBe(true)
    })

    it('in_progress → cancelled: 무효', () => {
      expect(service.validateTransition('in_progress', 'cancelled')).toBe(false)
    })

    it('completed → 어떤 상태로도 전이 불가', () => {
      const allStatuses: TicketStatus[] = ['blocked', 'ready', 'in_progress', 'completed', 'failed', 'cancelled']
      allStatuses.forEach((status) => {
        expect(service.validateTransition('completed', status)).toBe(false)
      })
    })

    it('failed → 어떤 상태로도 전이 불가', () => {
      const allStatuses: TicketStatus[] = ['blocked', 'ready', 'in_progress', 'completed', 'failed', 'cancelled']
      allStatuses.forEach((status) => {
        expect(service.validateTransition('failed', status)).toBe(false)
      })
    })

    it('cancelled → 어떤 상태로도 전이 불가', () => {
      const allStatuses: TicketStatus[] = ['blocked', 'ready', 'in_progress', 'completed', 'failed', 'cancelled']
      allStatuses.forEach((status) => {
        expect(service.validateTransition('cancelled', status)).toBe(false)
      })
    })
  })

  describe('createWithCC', () => {
    it('CC 없이 생성 - status=ready', () => {
      const ticket = service.createWithCC({
        title: 'Test Task',
        prompt: 'Do something',
        assignee: 'agent1',
        createdBy: 'user',
      })

      expect(ticket.status).toBe('ready')
      expect(ticket.type).toBe('task')
      expect(ticket.ccReviewTicketIds).toBeUndefined()
    })

    it('CC 빈 배열 - status=ready', () => {
      const ticket = service.createWithCC({
        title: 'Test Task',
        prompt: 'Do something',
        assignee: 'agent1',
        createdBy: 'user',
        cc: [],
      })

      expect(ticket.status).toBe('ready')
      expect(ticket.ccReviewTicketIds).toBeUndefined()
    })

    it('CC 있으면 parent blocked + cc_review 생성', () => {
      const ticket = service.createWithCC({
        title: 'Test Task',
        prompt: 'Do something',
        assignee: 'agent1',
        createdBy: 'user',
        cc: ['reviewer1', 'reviewer2'],
      })

      // Parent ticket
      expect(ticket.status).toBe('blocked')
      expect(ticket.type).toBe('task')
      expect(ticket.ccReviewTicketIds).toHaveLength(2)

      // CC review tickets
      const ccReview1 = getTicket(tmpDir, ticket.ccReviewTicketIds![0])
      const ccReview2 = getTicket(tmpDir, ticket.ccReviewTicketIds![1])

      expect(ccReview1).not.toBeNull()
      expect(ccReview1!.type).toBe('cc_review')
      expect(ccReview1!.status).toBe('ready')
      expect(ccReview1!.parentTicketId).toBe(ticket.id)
      expect(ccReview1!.assignee).toBe('reviewer1')
      expect(ccReview1!.title).toBe('[CC Review] Test Task')

      expect(ccReview2).not.toBeNull()
      expect(ccReview2!.type).toBe('cc_review')
      expect(ccReview2!.status).toBe('ready')
      expect(ccReview2!.parentTicketId).toBe(ticket.id)
      expect(ccReview2!.assignee).toBe('reviewer2')
    })

    it('CC 생성 시 priority 전파', () => {
      const ticket = service.createWithCC({
        title: 'Urgent Task',
        prompt: 'Do something urgently',
        assignee: 'agent1',
        priority: 'urgent',
        createdBy: 'user',
        cc: ['reviewer1'],
      })

      expect(ticket.priority).toBe('urgent')

      const ccReview = getTicket(tmpDir, ticket.ccReviewTicketIds![0])
      expect(ccReview!.priority).toBe('urgent')
    })
  })

  describe('checkAndUnblockParent', () => {
    it('모든 cc_review 완료 시 parent unblock', () => {
      const taskTicket = service.createWithCC({
        title: 'Test Task',
        prompt: 'Do something',
        assignee: 'agent1',
        createdBy: 'user',
        cc: ['reviewer1', 'reviewer2'],
      })

      expect(taskTicket.status).toBe('blocked')

      // Complete both cc_review tickets
      const ccReview1Id = taskTicket.ccReviewTicketIds![0]
      const ccReview2Id = taskTicket.ccReviewTicketIds![1]

      // First reviewer completes
      const ccReview1 = getTicket(tmpDir, ccReview1Id)!
      service.updateStatus(ccReview1Id, 'in_progress', ccReview1.version)
      const ccReview1Updated = getTicket(tmpDir, ccReview1Id)!
      service.updateStatus(ccReview1Id, 'completed', ccReview1Updated.version)

      // Parent still blocked (one cc_review not completed)
      let parent = getTicket(tmpDir, taskTicket.id)
      expect(parent!.status).toBe('blocked')

      // Second reviewer completes
      const ccReview2 = getTicket(tmpDir, ccReview2Id)!
      service.updateStatus(ccReview2Id, 'in_progress', ccReview2.version)
      const ccReview2Updated = getTicket(tmpDir, ccReview2Id)!
      service.updateStatus(ccReview2Id, 'completed', ccReview2Updated.version)

      // Parent now ready
      parent = getTicket(tmpDir, taskTicket.id)
      expect(parent!.status).toBe('ready')
    })

    it('일부만 완료 시 parent 여전히 blocked', () => {
      const taskTicket = service.createWithCC({
        title: 'Test Task',
        prompt: 'Do something',
        assignee: 'agent1',
        createdBy: 'user',
        cc: ['reviewer1', 'reviewer2'],
      })

      const ccReview1Id = taskTicket.ccReviewTicketIds![0]

      // Only first reviewer completes
      const ccReview1 = getTicket(tmpDir, ccReview1Id)!
      service.updateStatus(ccReview1Id, 'in_progress', ccReview1.version)
      const ccReview1Updated = getTicket(tmpDir, ccReview1Id)!
      service.updateStatus(ccReview1Id, 'completed', ccReview1Updated.version)

      // Parent still blocked
      const parent = getTicket(tmpDir, taskTicket.id)
      expect(parent!.status).toBe('blocked')
    })

    it('cc_review가 아닌 티켓에 대해 호출해도 안전', () => {
      const ticket = createTicket(tmpDir, createTestTicket({ status: 'ready' }))

      // Should not throw
      expect(() => {
        service.checkAndUnblockParent(ticket.id)
      }).not.toThrow()
    })
  })

  describe('updateStatus', () => {
    it('유효 전이 성공', () => {
      const ticket = createTicket(tmpDir, createTestTicket({ status: 'ready' }))
      const updated = service.updateStatus(ticket.id, 'in_progress', ticket.version)

      expect(updated.status).toBe('in_progress')
    })

    it('무효 전이 에러', () => {
      const ticket = createTicket(tmpDir, createTestTicket({ status: 'ready' }))

      expect(() => {
        service.updateStatus(ticket.id, 'completed', ticket.version)
      }).toThrow(InvalidTransitionError)
    })

    it('InvalidTransitionError에 from/to 포함', () => {
      const ticket = createTicket(tmpDir, createTestTicket({ status: 'ready' }))

      try {
        service.updateStatus(ticket.id, 'completed', ticket.version)
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidTransitionError)
        const error = e as InvalidTransitionError
        expect(error.from).toBe('ready')
        expect(error.to).toBe('completed')
      }
    })

    it('in_progress 전이 시 startedAt 기록', () => {
      const ticket = createTicket(tmpDir, createTestTicket({ status: 'ready' }))
      const before = new Date().toISOString()
      const updated = service.updateStatus(ticket.id, 'in_progress', ticket.version)
      const after = new Date().toISOString()

      expect(updated.startedAt).toBeDefined()
      expect(updated.startedAt! >= before).toBe(true)
      expect(updated.startedAt! <= after).toBe(true)
    })

    it('completed 전이 시 completedAt 기록', () => {
      const ticket = createTicket(tmpDir, createTestTicket({ status: 'in_progress' }))
      const before = new Date().toISOString()
      const updated = service.updateStatus(ticket.id, 'completed', ticket.version)
      const after = new Date().toISOString()

      expect(updated.completedAt).toBeDefined()
      expect(updated.completedAt! >= before).toBe(true)
      expect(updated.completedAt! <= after).toBe(true)
    })

    it('failed 전이 시 completedAt 기록', () => {
      const ticket = createTicket(tmpDir, createTestTicket({ status: 'in_progress' }))
      const updated = service.updateStatus(ticket.id, 'failed', ticket.version)

      expect(updated.completedAt).toBeDefined()
    })

    it('cancelled 전이 시 cancelledAt 기록', () => {
      const ticket = createTicket(tmpDir, createTestTicket({ status: 'ready' }))
      const before = new Date().toISOString()
      const updated = service.updateStatus(ticket.id, 'cancelled', ticket.version)
      const after = new Date().toISOString()

      expect(updated.cancelledAt).toBeDefined()
      expect(updated.cancelledAt! >= before).toBe(true)
      expect(updated.cancelledAt! <= after).toBe(true)
    })

    it('cc_review completed 시 parent unblock 트리거', () => {
      const taskTicket = service.createWithCC({
        title: 'Test Task',
        prompt: 'Do something',
        assignee: 'agent1',
        createdBy: 'user',
        cc: ['reviewer1'],
      })

      expect(taskTicket.status).toBe('blocked')

      const ccReviewId = taskTicket.ccReviewTicketIds![0]
      const ccReview = getTicket(tmpDir, ccReviewId)!

      service.updateStatus(ccReviewId, 'in_progress', ccReview.version)
      const ccReviewUpdated = getTicket(tmpDir, ccReviewId)!
      service.updateStatus(ccReviewId, 'completed', ccReviewUpdated.version)

      // Parent should now be ready
      const parent = getTicket(tmpDir, taskTicket.id)
      expect(parent!.status).toBe('ready')
    })

    it('존재하지 않는 티켓 에러', () => {
      expect(() => {
        service.updateStatus('nonexistent-id', 'in_progress', 1)
      }).toThrow('Ticket not found')
    })
  })

  describe('addComment', () => {
    it('댓글 추가 성공', () => {
      const ticket = createTicket(tmpDir, createTestTicket())
      const updated = service.addComment(ticket.id, 'user1', 'This is a comment', ticket.version)

      expect(updated.comments).toHaveLength(1)
      expect(updated.comments[0].author).toBe('user1')
      expect(updated.comments[0].content).toBe('This is a comment')
      expect(updated.comments[0].id).toBeTruthy()
      expect(updated.comments[0].createdAt).toBeTruthy()
    })

    it('version 증가', () => {
      const ticket = createTicket(tmpDir, createTestTicket())
      const updated = service.addComment(ticket.id, 'user1', 'Comment 1', ticket.version)

      expect(updated.version).toBe(2)
    })

    it('여러 댓글 추가', () => {
      const ticket = createTicket(tmpDir, createTestTicket())

      const updated1 = service.addComment(ticket.id, 'user1', 'Comment 1', ticket.version)
      const updated2 = service.addComment(ticket.id, 'user2', 'Comment 2', updated1.version)

      expect(updated2.comments).toHaveLength(2)
      expect(updated2.comments[0].content).toBe('Comment 1')
      expect(updated2.comments[1].content).toBe('Comment 2')
      expect(updated2.version).toBe(3)
    })

    it('존재하지 않는 티켓 에러', () => {
      expect(() => {
        service.addComment('nonexistent-id', 'user1', 'Comment', 1)
      }).toThrow('Ticket not found')
    })
  })
})
