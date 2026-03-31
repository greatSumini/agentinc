# Phase 6: Hono API Routes

## 사전 준비

먼저 아래 파일들을 읽고 현재 프로젝트 상태를 파악하라:

- `src/server/index.ts` — 현재 Hono 서버 (health 라우트만 있음)
- `src/core/types.ts` — 모든 타입
- `src/core/store/ticket-store.ts` — 티켓 스토어
- `src/core/store/agent-store.ts` — 에이전트 스토어
- `src/core/store/config-store.ts` — 설정 스토어
- `src/core/services/ticket.service.ts` — 티켓 서비스
- `src/daemon/orchestrator.ts` — 오케스트레이터 (getAgentStatuses)

기존 구현을 참조하려면:
- `git show HEAD~5:packages/server/src/routes/tickets.ts`
- `git show HEAD~5:packages/server/src/routes/agents.ts`
- `git show HEAD~5:packages/server/src/routes/events.ts`

## 작업 내용

서버를 **온보딩 모드**와 **노멀 모드** 두 개로 분리한다.

### 1. `src/server/shared/event-bus.ts` — 공통 SSE EventBus

```ts
type EventType = 'ticket:created' | 'ticket:updated' | 'agent:status' | 'onboarding:question' | 'onboarding:status'

class EventBus {
  private listeners: Map<string, Set<(data: string) => void>> = new Map()

  subscribe(clientId: string, callback: (data: string) => void): void
  unsubscribe(clientId: string): void
  emit(event: EventType, data: unknown): void
  // - 모든 listener에게 SSE 형식으로 전송: `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}
```

싱글톤으로 export.

### 2. `src/server/shared/sse-handler.ts` — SSE 라우트 핸들러

Hono의 streaming API를 사용한 SSE 핸들러:

```ts
function createSSEHandler(eventBus: EventBus): (c: Context) => Response
// - ReadableStream 생성
// - eventBus에 listener 등록
// - 클라이언트 disconnect 시 unsubscribe
// - Content-Type: text/event-stream
```

### 3. `src/server/onboarding.ts` — 온보딩 모드 서버

온보딩 진행 중에만 사용되는 서버:

```ts
function createOnboardingServer(rootDir: string, eventBus: EventBus): Hono

// 라우트:
// GET  /api/onboarding/status  — 현재 온보딩 상태 반환
//   Response: { persona: string | null, step: 'persona' | 'chat' | 'company-name' | 'completed' }

// POST /api/onboarding/persona — 페르소나 선택
//   Body: { persona: 'elon-musk' | 'peter-thiel' | 'steve-jobs' | 'bill-gates' }
//   Response: { ok: true }
//   동작: 페르소나를 메모리에 저장, CEO claude session spawn 트리거 (Phase 8에서 구현)

// POST /api/onboarding/answers — 사용자 답변 수신 (MCP 브릿지)
//   Body: { answers: Array<{ questionId: string, answer: string }>, wantMoreQuestions: boolean }
//   Response: { ok: true }
//   동작: 대기 중인 MCP tool의 Promise를 resolve (Phase 7에서 연결)

// POST /api/onboarding/company-name — 회사명 확인
//   Body: { name: string }
//   Response: { ok: true }
//   동작: 대기 중인 MCP tool의 Promise를 resolve (Phase 7에서 연결)

// GET  /api/events — SSE stream (온보딩 이벤트)
```

이 phase에서는 라우트의 **구조와 시그니처**만 구현한다. MCP 브릿지 연결 등 실제 동작은 Phase 7, 8에서 완성한다. 현재는 요청을 받아 `{ ok: true }`를 반환하는 수준으로 구현하라.

### 4. `src/server/normal.ts` — 노멀 모드 서버

온보딩 완료 후 대시보드에서 사용하는 서버:

```ts
function createNormalServer(rootDir: string, eventBus: EventBus, orchestrator: Orchestrator): Hono

// 라우트:

// === Tickets ===
// GET    /api/tickets          — 티켓 목록 (query: status, assignee, type)
// POST   /api/tickets          — 티켓 생성
//   Body: { title, prompt, assignee, priority?, cc?: string[] }
// GET    /api/tickets/:id      — 티켓 상세
// PATCH  /api/tickets/:id      — 티켓 업데이트
//   Body: { status?, priority?, expectedVersion }

// === Agents ===
// GET    /api/agents           — 에이전트 목록 + 실시간 상태
//   Response: Array<{ ...AgentConfig, status: 'idle' | 'working' | 'offline' }>
//   동작: agent-store에서 목록 + orchestrator.getAgentStatuses()에서 상태 머지

// === Chat (Talk to CEO) ===
// POST   /api/chat             — CEO 대화 세션
//   Body: { message: string }
//   Response: { response: string }
//   동작: CEO claude session을 --print 모드로 spawn, 응답 반환 (Phase 8에서 완성)
//   이 phase에서는 stub: { response: "Chat not yet implemented" }

// === Hooks ===
// POST   /api/hooks/session-end — SessionEnd hook 수신
//   Body: { transcript?: string }
//   Response: { ok: true }
//   동작: 학습 내용 기록 로직 (Phase 8에서 완성)
//   이 phase에서는 stub: 로그만 출력

// === Events ===
// GET    /api/events           — SSE stream (ticket, agent 이벤트)
```

ticket 라우트에서 TicketService를 사용하여 CRUD 및 상태 전이를 처리하라. 티켓 생성/업데이트 시 eventBus로 이벤트를 emit하라.

### 5. `src/server/index.ts` 리팩터

기존 단일 서버를 모드별로 분리:

```ts
import { createOnboardingServer } from './onboarding.js'
import { createNormalServer } from './normal.js'

function startOnboardingServer(rootDir: string, port: number): { server: Server, eventBus: EventBus }
// - EventBus 생성
// - createOnboardingServer() + 정적 파일 서빙
// - serve()로 시작

function startNormalServer(rootDir: string, port: number, orchestrator: Orchestrator): { server: Server, eventBus: EventBus }
// - EventBus 생성
// - createNormalServer() + 정적 파일 서빙
// - serve()로 시작

export { startOnboardingServer, startNormalServer }
```

## Acceptance Criteria

```bash
npm run build  # 빌드 에러 없음
npm test       # 기존 테스트 모두 통과

# 노멀 서버 기동 테스트 (stub orchestrator 사용)
# (수동 검증 — 빌드 성공이 주요 AC)
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/14-auto-startup/index.json`의 phase 6 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- Hono의 SSE 지원은 `c.header('Content-Type', 'text/event-stream')` + `ReadableStream`으로 구현한다. Hono에 내장 SSE 헬퍼가 있다면 그것을 사용해도 된다.
- 정적 파일 서빙은 `dist/web/` 경로에서 한다. SPA이므로 매칭되지 않는 GET 요청은 `index.html`로 fallback해야 한다.
- 온보딩 서버와 노멀 서버는 **동시에 실행되지 않는다**. CLI가 모드에 따라 하나만 시작한다.
- stub으로 남긴 라우트(chat, hooks, onboarding MCP 브릿지)에는 `// TODO: Phase 7/8에서 구현` 주석을 남겨라.
- ticket 생성 시 `createdBy`는 요청 body에서 받지 않고 `'user'`로 고정한다 (에이전트가 생성하는 경우는 MCP tool을 통해).
- 이전 phase의 테스트를 깨뜨리지 마라.
