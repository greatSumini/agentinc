# Phase 7: MCP Servers

## 사전 준비

먼저 아래 파일들을 읽고 현재 프로젝트 상태를 파악하라:

- `src/server/onboarding.ts` — 온보딩 API 라우트 (답변 수신, 회사명 확인 엔드포인트)
- `src/server/normal.ts` — 노멀 API 라우트 (티켓 엔드포인트)
- `src/server/shared/event-bus.ts` — SSE EventBus
- `src/core/types.ts` — 타입 정의

## 작업 내용

MCP 서버를 온보딩용과 에이전트용 두 파일로 분리한다. 둘 다 stdio 기반 JSON-RPC 프로토콜을 구현하며, 내부적으로 Hono API를 HTTP로 호출한다.

### 1. `src/mcp/protocol.ts` — MCP 프로토콜 공통 처리

JSON-RPC over stdin/stdout 핸들링:

```ts
interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>  // JSON Schema
}

interface MCPToolHandler {
  (params: Record<string, unknown>): Promise<unknown>
}

class MCPServer {
  private tools: Map<string, { definition: MCPTool; handler: MCPToolHandler }> = new Map()

  registerTool(tool: MCPTool, handler: MCPToolHandler): void

  async start(): Promise<void>
  // - stdin에서 줄 단위로 JSON-RPC 메시지 읽기
  // - method에 따라 처리:
  //   - "initialize" → capabilities 반환 (tools 지원)
  //   - "tools/list" → 등록된 tool 목록 반환
  //   - "tools/call" → tool name으로 handler 찾아 실행, 결과 반환
  //   - "notifications/initialized" → 무시 (ACK 불필요)
  // - 응답을 stdout으로 JSON-RPC 형식 출력
  // - 에러 시 JSON-RPC error 응답
}
```

**핵심**: MCP 프로토콜의 정확한 JSON-RPC 메시지 형식을 따라야 한다:
- 요청: `{ "jsonrpc": "2.0", "id": <number>, "method": "<method>", "params": {...} }`
- 응답: `{ "jsonrpc": "2.0", "id": <number>, "result": {...} }`
- 에러: `{ "jsonrpc": "2.0", "id": <number>, "error": { "code": <number>, "message": "<msg>" } }`

### 2. `src/mcp/onboarding-mcp.ts` — 온보딩 전용 MCP 서버

```ts
// 이 파일은 독립 프로세스로 실행된다.
// CLI args: --root <rootDir> --port <serverPort>

// --- Tool: AskOnboardingQuestions ---
// description: 사용자에게 온보딩 질문을 제시하고 답변을 받는다.
// input: {
//   questions: Array<{
//     id: string,
//     text: string,
//     options: [string, string, string]  // a, b, c 선택지
//   }>
// }
// 동작:
//   1. POST http://localhost:{port}/api/onboarding/push-questions 로 질문 전달
//      (이 엔드포인트는 eventBus로 SSE push)
//   2. 답변이 올 때까지 대기: polling GET http://localhost:{port}/api/onboarding/pending-answer
//      (또는 long-polling / callback 패턴)
//   3. 답변 수신 후 반환
// output: {
//   answers: Array<{ questionId: string, answer: string }>,
//   wantMoreQuestions: boolean
// }

// --- Tool: ConfirmCompanyName ---
// description: 사용자에게 회사명을 확인받는다.
// input: { suggestedName: string }
// 동작:
//   1. POST http://localhost:{port}/api/onboarding/push-company-name 으로 제안 전달
//   2. 확인 응답 대기
// output: { confirmedName: string }

// --- Tool: CompleteOnboarding ---
// description: 온보딩을 완료하고 회사를 생성한다.
// input: {
//   company: string,
//   goal: string,           // 회사 목표 (goal.md에 기록)
//   businessValues: string, // 비즈니스 가치 (business.md에 기록)
//   businessAntiValues: string  // 추구하지 않는 것
// }
// 동작:
//   1. POST http://localhost:{port}/api/onboarding/complete 로 전달
//   2. 서버가 파일 생성 처리 (Phase 8에서 구현)
// output: { success: boolean }
```

### 3. `src/mcp/agent-mcp.ts` — 에이전트 전용 MCP 서버

```ts
// 이 파일은 독립 프로세스로 실행된다.
// CLI args: --root <rootDir> --port <serverPort>

// --- Tool: CreateTicket ---
// description: 새 티켓을 생성하여 에이전트에게 작업을 할당한다.
// input: {
//   title: string,
//   prompt: string,
//   assignee: string,
//   priority?: 'low' | 'normal' | 'high' | 'urgent',
//   cc?: string[]
// }
// 동작: POST http://localhost:{port}/api/tickets
// output: { ticketId: string, status: string }

// --- Tool: ListTickets ---
// description: 티켓 목록을 조회한다.
// input: {
//   status?: string,
//   assignee?: string
// }
// 동작: GET http://localhost:{port}/api/tickets?status=...&assignee=...
// output: { tickets: Ticket[] }

// --- Tool: UpdateTicket ---
// description: 티켓의 상태나 우선순위를 변경한다.
// input: {
//   ticketId: string,
//   status?: string,
//   priority?: string,
//   expectedVersion: number
// }
// 동작: PATCH http://localhost:{port}/api/tickets/{ticketId}
// output: { ticket: Ticket }
```

### 4. 온보딩 API 보강 (`src/server/onboarding.ts` 수정)

Phase 6에서 stub으로 남긴 엔드포인트들에 MCP 브릿지 로직을 추가:

```ts
// 새로운 메모리 상태 관리
interface OnboardingBridge {
  pendingQuestionResolve: ((answers: any) => void) | null
  pendingCompanyNameResolve: ((name: string) => void) | null
}

// 추가 라우트:
// POST /api/onboarding/push-questions — MCP가 질문을 push
//   Body: { questions: [...] }
//   동작: eventBus.emit('onboarding:question', questions), pendingQuestionResolve 설정
//   Response: { ok: true }

// GET  /api/onboarding/pending-answer — MCP가 답변을 polling
//   동작: pendingQuestionResolve가 resolve될 때까지 long-poll (최대 60초 timeout)
//   Response: { answers: [...], wantMoreQuestions: boolean } 또는 { timeout: true }

// POST /api/onboarding/push-company-name — MCP가 회사명 확인 요청
// GET  /api/onboarding/pending-company-name — MCP가 확인 응답 polling

// POST /api/onboarding/answers — 웹 UI가 답변 전송 (기존)
//   동작: pendingQuestionResolve를 resolve

// POST /api/onboarding/company-name — 웹 UI가 회사명 전송 (기존)
//   동작: pendingCompanyNameResolve를 resolve

// POST /api/onboarding/complete — MCP가 온보딩 완료 요청
//   Body: { company, goal, businessValues, businessAntiValues }
//   동작: Phase 8에서 파일 생성 로직 구현. 이 phase에서는 config에 onboardingCompleted=true만 저장.
```

**핵심 패턴**: MCP 서버가 push → API가 SSE로 웹에 전달 → 웹이 답변 → API가 대기 중인 MCP의 Promise를 resolve.

이 패턴을 Promise + in-memory callback으로 구현한다. 별도 큐나 DB 불필요.

### 5. MCP 서버 실행 파일

`src/mcp/onboarding-mcp.ts`와 `src/mcp/agent-mcp.ts` 각각 파일 하단에 즉시 실행 로직을 넣어라:

```ts
// 파일 하단
const args = process.argv.slice(2)
const rootDir = args[args.indexOf('--root') + 1]
const port = parseInt(args[args.indexOf('--port') + 1])

const server = new MCPServer()
// ... tool 등록 ...
server.start()
```

## Acceptance Criteria

```bash
npm run build  # 빌드 에러 없음
npm test       # 기존 테스트 모두 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/14-auto-startup/index.json`의 phase 7 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- MCP 프로토콜은 **줄 단위 JSON**이다. 각 메시지는 `\n`으로 구분된다. `readline` 모듈을 사용하라.
- stdin/stdout을 MCP 통신에 사용하므로, 디버그 로그는 반드시 **stderr**에 출력하라 (`console.error()`).
- long-polling의 timeout은 60초로 설정하되, timeout 시 MCP 서버가 재요청하면 다시 대기한다.
- `OnboardingBridge`는 서버 인스턴스 내 in-memory 상태다. 서버 재시작 시 초기화된다 — 온보딩은 하나의 서버 수명 내에서 완료되므로 문제없다.
- MCP 서버 파일들은 빌드 시 `dist/mcp/`에 출력되어야 한다. `tsconfig.server.json`의 include에 `src/mcp/**/*`가 포함되어 있는지 확인하라.
- 이전 phase의 테스트를 깨뜨리지 마라.
