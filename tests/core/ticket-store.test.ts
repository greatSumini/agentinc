import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  createTicket,
  getTicket,
  listTickets,
  updateTicket,
  deleteTicket,
  VersionConflictError,
} from '../../src/core/store/ticket-store'
import type { Ticket } from '../../src/core/types'

describe('ticket-store', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-startup-test-'))
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

  describe('createTicket', () => {
    it('디렉토리 없으면 자동 생성', () => {
      const ticket = createTicket(tmpDir, createTestTicket())

      const ticketsDir = path.join(tmpDir, '.auto-startup', 'tickets')
      expect(fs.existsSync(ticketsDir)).toBe(true)
      expect(ticket.id).toBeTruthy()
    })

    it('id 없으면 UUID 생성', () => {
      const ticket = createTicket(tmpDir, createTestTicket({ id: '' }))

      expect(ticket.id).toBeTruthy()
      expect(ticket.id.length).toBe(36) // UUID format
    })

    it('version = 1로 설정', () => {
      const ticket = createTicket(tmpDir, createTestTicket())

      expect(ticket.version).toBe(1)
    })

    it('createdAt ISO 8601 현재시각 설정', () => {
      const before = new Date().toISOString()
      const ticket = createTicket(tmpDir, createTestTicket())
      const after = new Date().toISOString()

      expect(ticket.createdAt >= before).toBe(true)
      expect(ticket.createdAt <= after).toBe(true)
    })

    it('JSON 파일 생성 확인', () => {
      const ticket = createTicket(tmpDir, createTestTicket())

      const ticketPath = path.join(tmpDir, '.auto-startup', 'tickets', `${ticket.id}.json`)
      expect(fs.existsSync(ticketPath)).toBe(true)

      const content = JSON.parse(fs.readFileSync(ticketPath, 'utf-8'))
      expect(content.title).toBe('Test Ticket')
    })
  })

  describe('getTicket', () => {
    it('티켓이 없으면 null 반환', () => {
      const ticket = getTicket(tmpDir, 'nonexistent-id')
      expect(ticket).toBeNull()
    })

    it('티켓 정상 조회', () => {
      const created = createTicket(tmpDir, createTestTicket({ title: 'My Ticket' }))
      const loaded = getTicket(tmpDir, created.id)

      expect(loaded).not.toBeNull()
      expect(loaded!.title).toBe('My Ticket')
      expect(loaded!.version).toBe(1)
    })
  })

  describe('listTickets', () => {
    it('티켓이 없으면 빈 배열', () => {
      const tickets = listTickets(tmpDir)
      expect(tickets).toEqual([])
    })

    it('여러 티켓 목록 반환', () => {
      createTicket(tmpDir, createTestTicket({ title: 'Ticket 1' }))
      createTicket(tmpDir, createTestTicket({ title: 'Ticket 2' }))
      createTicket(tmpDir, createTestTicket({ title: 'Ticket 3' }))

      const tickets = listTickets(tmpDir)
      expect(tickets).toHaveLength(3)
    })

    describe('filter', () => {
      it('status로 필터링', () => {
        createTicket(tmpDir, createTestTicket({ status: 'ready' }))
        createTicket(tmpDir, createTestTicket({ status: 'in_progress' }))
        createTicket(tmpDir, createTestTicket({ status: 'ready' }))

        const readyTickets = listTickets(tmpDir, { status: 'ready' })
        expect(readyTickets).toHaveLength(2)
        readyTickets.forEach((t) => expect(t.status).toBe('ready'))

        const inProgressTickets = listTickets(tmpDir, { status: 'in_progress' })
        expect(inProgressTickets).toHaveLength(1)
      })

      it('assignee로 필터링', () => {
        createTicket(tmpDir, createTestTicket({ assignee: 'agent1' }))
        createTicket(tmpDir, createTestTicket({ assignee: 'agent2' }))
        createTicket(tmpDir, createTestTicket({ assignee: 'agent1' }))

        const agent1Tickets = listTickets(tmpDir, { assignee: 'agent1' })
        expect(agent1Tickets).toHaveLength(2)
        agent1Tickets.forEach((t) => expect(t.assignee).toBe('agent1'))
      })

      it('type으로 필터링', () => {
        createTicket(tmpDir, createTestTicket({ type: 'task' }))
        createTicket(tmpDir, createTestTicket({ type: 'cc_review' }))
        createTicket(tmpDir, createTestTicket({ type: 'task' }))

        const taskTickets = listTickets(tmpDir, { type: 'task' })
        expect(taskTickets).toHaveLength(2)
        taskTickets.forEach((t) => expect(t.type).toBe('task'))

        const ccReviewTickets = listTickets(tmpDir, { type: 'cc_review' })
        expect(ccReviewTickets).toHaveLength(1)
      })

      it('복합 필터', () => {
        createTicket(tmpDir, createTestTicket({ status: 'ready', assignee: 'agent1' }))
        createTicket(tmpDir, createTestTicket({ status: 'ready', assignee: 'agent2' }))
        createTicket(tmpDir, createTestTicket({ status: 'in_progress', assignee: 'agent1' }))

        const filtered = listTickets(tmpDir, { status: 'ready', assignee: 'agent1' })
        expect(filtered).toHaveLength(1)
        expect(filtered[0].status).toBe('ready')
        expect(filtered[0].assignee).toBe('agent1')
      })
    })

    describe('sorting', () => {
      it('priority 순 정렬 (urgent > high > normal > low)', async () => {
        createTicket(tmpDir, createTestTicket({ title: 'Low', priority: 'low' }))
        await new Promise((r) => setTimeout(r, 10))
        createTicket(tmpDir, createTestTicket({ title: 'Urgent', priority: 'urgent' }))
        await new Promise((r) => setTimeout(r, 10))
        createTicket(tmpDir, createTestTicket({ title: 'Normal', priority: 'normal' }))
        await new Promise((r) => setTimeout(r, 10))
        createTicket(tmpDir, createTestTicket({ title: 'High', priority: 'high' }))

        const tickets = listTickets(tmpDir)

        expect(tickets[0].priority).toBe('urgent')
        expect(tickets[1].priority).toBe('high')
        expect(tickets[2].priority).toBe('normal')
        expect(tickets[3].priority).toBe('low')
      })

      it('같은 priority면 createdAt 오름차순', async () => {
        createTicket(tmpDir, createTestTicket({ title: 'First', priority: 'normal' }))
        await new Promise((r) => setTimeout(r, 10))
        createTicket(tmpDir, createTestTicket({ title: 'Second', priority: 'normal' }))
        await new Promise((r) => setTimeout(r, 10))
        createTicket(tmpDir, createTestTicket({ title: 'Third', priority: 'normal' }))

        const tickets = listTickets(tmpDir)

        expect(tickets[0].title).toBe('First')
        expect(tickets[1].title).toBe('Second')
        expect(tickets[2].title).toBe('Third')
      })
    })
  })

  describe('updateTicket', () => {
    it('티켓 업데이트 성공', () => {
      const created = createTicket(tmpDir, createTestTicket())
      const updated = updateTicket(tmpDir, created.id, { status: 'in_progress' }, 1)

      expect(updated.status).toBe('in_progress')
      expect(updated.version).toBe(2)
    })

    it('부분 업데이트 - status만', () => {
      const created = createTicket(tmpDir, createTestTicket({ title: 'Original' }))
      const updated = updateTicket(tmpDir, created.id, { status: 'in_progress' }, 1)

      expect(updated.status).toBe('in_progress')
      expect(updated.title).toBe('Original')
    })

    it('부분 업데이트 - priority만', () => {
      const created = createTicket(tmpDir, createTestTicket({ priority: 'normal' }))
      const updated = updateTicket(tmpDir, created.id, { priority: 'urgent' }, 1)

      expect(updated.priority).toBe('urgent')
      expect(updated.status).toBe('ready')
    })

    it('version 증가', () => {
      const created = createTicket(tmpDir, createTestTicket())
      expect(created.version).toBe(1)

      const updated1 = updateTicket(tmpDir, created.id, { status: 'in_progress' }, 1)
      expect(updated1.version).toBe(2)

      const updated2 = updateTicket(tmpDir, updated1.id, { status: 'completed' }, 2)
      expect(updated2.version).toBe(3)
    })

    it('id와 createdAt은 덮어쓰기 방지', () => {
      const created = createTicket(tmpDir, createTestTicket())
      const originalId = created.id
      const originalCreatedAt = created.createdAt

      const updated = updateTicket(
        tmpDir,
        created.id,
        { id: 'hacked-id', createdAt: '1970-01-01T00:00:00Z' } as Partial<Ticket>,
        1
      )

      expect(updated.id).toBe(originalId)
      expect(updated.createdAt).toBe(originalCreatedAt)
    })

    describe('optimistic locking', () => {
      it('version 불일치 시 VersionConflictError', () => {
        const created = createTicket(tmpDir, createTestTicket())

        expect(() => {
          updateTicket(tmpDir, created.id, { status: 'in_progress' }, 999)
        }).toThrow(VersionConflictError)
      })

      it('에러 메시지에 expected/current version 포함', () => {
        const created = createTicket(tmpDir, createTestTicket())

        try {
          updateTicket(tmpDir, created.id, { status: 'in_progress' }, 999)
          expect.fail('Should have thrown')
        } catch (e) {
          expect(e).toBeInstanceOf(VersionConflictError)
          const error = e as VersionConflictError
          expect(error.expectedVersion).toBe(999)
          expect(error.currentVersion).toBe(1)
          expect(error.message).toContain('999')
          expect(error.message).toContain('1')
        }
      })

      it('동시 업데이트 시나리오', () => {
        const created = createTicket(tmpDir, createTestTicket())

        // First update succeeds
        const updated1 = updateTicket(tmpDir, created.id, { status: 'in_progress' }, 1)
        expect(updated1.version).toBe(2)

        // Second update with stale version fails
        expect(() => {
          updateTicket(tmpDir, created.id, { priority: 'high' }, 1)
        }).toThrow(VersionConflictError)
      })
    })

    it('존재하지 않는 티켓 업데이트 시 에러', () => {
      expect(() => {
        updateTicket(tmpDir, 'nonexistent-id', { status: 'in_progress' }, 1)
      }).toThrow('Ticket not found')
    })
  })

  describe('deleteTicket', () => {
    it('티켓 삭제 성공', () => {
      const created = createTicket(tmpDir, createTestTicket())
      const result = deleteTicket(tmpDir, created.id)

      expect(result).toBe(true)
      expect(getTicket(tmpDir, created.id)).toBeNull()
    })

    it('존재하지 않는 티켓 삭제 시 false', () => {
      const result = deleteTicket(tmpDir, 'nonexistent-id')
      expect(result).toBe(false)
    })
  })
})
