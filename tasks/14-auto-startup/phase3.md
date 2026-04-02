# Phase 3: Ticket Store & Service

## 사전 준비

먼저 아래 파일들을 읽고 현재 프로젝트 상태를 파악하라:

- `src/core/types.ts` — 타입 정의 (Ticket, TicketStatus 등)
- `src/core/store/config-store.ts` — 스토어 패턴 참조
- `src/core/store/agent-store.ts` — 스토어 패턴 참조

기존 구현을 참조하려면 다음 git 명령어를 사용하라:
- `git show HEAD~2:packages/core/src/store/fs-ticket-store.ts` — 기존 티켓 스토어
- `git show HEAD~2:packages/core/src/services/ticket.service.ts` — 기존 티켓 서비스
- `git show HEAD~2:packages/core/tests/store/fs-ticket-store.test.ts` — 기존 테스트

## 작업 내용

### 1. `src/core/store/ticket-store.ts`

`.auto-startup/tickets/{id}.json` 기반 티켓 저장소:

```ts
createTicket(rootDir: string, ticket: Ticket): Ticket
// - .auto-startup/tickets/ 디렉토리 없으면 생성
// - ticket.id가 없으면 UUID 생성
// - ticket.version = 1
// - ticket.createdAt = ISO 8601 현재시각
// - JSON 파일 쓰기
// - 생성된 ticket 반환

getTicket(rootDir: string, id: string): Ticket | null
// - 파일 없으면 null

listTickets(rootDir: string, filter?: { status?: TicketStatus; assignee?: string; type?: TicketType }): Ticket[]
// - tickets/ 디렉토리 순회
// - filter 조건에 맞는 티켓만 반환
// - priority 순 (urgent > high > normal > low), 같으면 createdAt 오름차순

updateTicket(rootDir: string, id: string, updates: Partial<Ticket>, expectedVersion: number): Ticket
// - 파일 읽기 → version 확인 → 불일치 시 에러 throw
// - updates 적용 (status, priority, comments 등)
// - version++
// - 파일 쓰기
// - 업데이트된 ticket 반환

deleteTicket(rootDir: string, id: string): boolean
// - 파일 삭제, 성공 여부 반환
```

### 2. `src/core/services/ticket.service.ts`

티켓 비즈니스 로직:

```ts
class TicketService {
  constructor(private rootDir: string) {}

  // --- State machine ---
  private static VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
    blocked: ['ready', 'cancelled'],
    ready: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'failed'],
    completed: [],
    failed: [],
    cancelled: [],
  }

  validateTransition(from: TicketStatus, to: TicketStatus): boolean
  // - VALID_TRANSITIONS에서 확인

  // --- Create with CC ---
  createWithCC(params: {
    title: string
    prompt: string
    assignee: string
    priority?: TicketPriority
    createdBy: string
    cc?: string[]
  }): Ticket
  // - cc가 비어있으면: status='ready'인 task 티켓 생성
  // - cc가 있으면:
  //   1. status='blocked'인 task 티켓 생성
  //   2. 각 cc agent마다 type='cc_review' 티켓 생성 (status='ready')
  //   3. task의 ccReviewTicketIds에 cc_review 티켓 ID들 기록
  //   4. cc_review의 parentTicketId에 task ID 기록

  // --- CC completion ---
  checkAndUnblockParent(ccReviewTicketId: string): void
  // - cc_review 티켓의 parentTicketId로 parent 조회
  // - parent의 모든 ccReviewTicketIds가 completed인지 확인
  // - 모두 completed면 parent를 blocked → ready로 전이

  // --- Status update ---
  updateStatus(ticketId: string, newStatus: TicketStatus, expectedVersion: number): Ticket
  // - validateTransition 검증
  // - 상태 업데이트
  // - completed/failed/cancelled 시 해당 timestamp 기록
  // - cc_review가 completed되면 checkAndUnblockParent 호출

  // --- Comment ---
  addComment(ticketId: string, author: string, content: string, expectedVersion: number): Ticket
}
```

### 3. 테스트 작성

**`tests/core/ticket-store.test.ts`**:
- 기존 테스트 참조하여 포팅
- CRUD 기본 동작
- `listTickets` — filter 동작 (status, assignee, type)
- `listTickets` — priority + createdAt 정렬
- `updateTicket` — optimistic locking (version 불일치 시 에러)
- `updateTicket` — 부분 업데이트 (status만, priority만 등)

**`tests/core/ticket-service.test.ts`** (신규):
- `validateTransition` — 유효한 전이 / 무효한 전이
- `createWithCC` — CC 없이 생성 (status=ready)
- `createWithCC` — CC 있으면 parent blocked + cc_review 생성
- `checkAndUnblockParent` — 모든 cc_review 완료 시 parent unblock
- `checkAndUnblockParent` — 일부만 완료 시 parent 여전히 blocked
- `updateStatus` — 유효 전이 성공
- `updateStatus` — 무효 전이 에러
- `updateStatus` — cc_review completed 시 parent unblock 트리거
- `addComment` — 댓글 추가 + version 증가

## Acceptance Criteria

```bash
npm run build  # 빌드 에러 없음
npm test       # 모든 테스트 통과 (Phase 2 테스트 포함)
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/14-auto-startup/index.json`의 phase 3 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `updateTicket`에서 version 불일치 시 throw하는 에러 메시지에 현재 version과 expected version을 포함하라.
- UUID 생성은 `crypto.randomUUID()` 사용 (Node.js 내장).
- 터미널 상태(completed, failed, cancelled)에서는 어떤 전이도 불가하다.
- `in_progress` 상태의 cc_review가 있는 parent task는 cancel할 수 없다 — 이 검증은 이 phase에서는 구현하지 않아도 된다 (향후 필요 시 추가).
- Phase 2에서 작성한 테스트가 깨지지 않도록 주의하라.
