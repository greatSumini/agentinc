# Phase 5: Daemon (Orchestrator + Agent Worker)

## 사전 준비

먼저 아래 파일들을 읽고 현재 프로젝트 상태를 파악하라:

- `src/core/types.ts` — Ticket, AgentConfig 타입
- `src/core/store/ticket-store.ts` — 티켓 스토어 API
- `src/core/store/agent-store.ts` — 에이전트 스토어 API
- `src/core/services/ticket.service.ts` — 티켓 서비스 (상태 전이)
- `src/claude-runner/index.ts` — runClaude() 함수

기존 구현을 참조하려면 다음 git 명령어를 사용하라:
- `git show HEAD~4:packages/cli/src/services/orchestrator.service.ts` — 기존 오케스트레이터
- `git show HEAD~4:packages/cli/src/services/agent-runner.service.ts` — 기존 에이전트 러너
- `git show HEAD~4:packages/cli/src/agent-worker.ts` — 기존 워커 프로세스

## 작업 내용

### 1. `src/daemon/agent-worker.ts` — 워커 프로세스

`child_process.fork()`로 실행되는 독립 프로세스. 메인 프로세스(오케스트레이터)와 IPC로 통신:

```ts
// 이 파일은 fork()의 진입점이다.
// process.env.AGENT_NAME, process.env.ROOT_DIR, process.env.SERVER_PORT로 설정을 받는다.

const POLL_INTERVAL = 5000      // 5초
const IDLE_TIMEOUT = 180000     // 3분

interface WorkerMessage {
  type: 'heartbeat' | 'status'
  agentName: string
  status: 'idle' | 'working' | 'offline'
  ticketId?: string
}
```

**폴링 루프 로직**:

1. `agentName`, `rootDir`, `serverPort`를 환경변수에서 읽기
2. 무한 루프 시작:
   a. heartbeat 메시지를 parent에 전송 (`process.send()`)
   b. `GET http://localhost:{serverPort}/api/tickets?assignee={agentName}&status=ready` 호출
   c. 티켓이 있으면:
      - status 메시지 전송 (working)
      - `PATCH /api/tickets/{id}` — status를 `in_progress`로 변경
      - `runClaude({ rootDir, agentName, prompt: ticket.prompt, printMode: true })`
      - 결과에 따라 `PATCH /api/tickets/{id}` — `completed` 또는 `failed`
      - idle 타이머 리셋
      - status 메시지 전송 (idle)
   d. 티켓이 없으면:
      - idle 시간 누적
      - idle 시간 > IDLE_TIMEOUT이면 종료
   e. `POLL_INTERVAL`만큼 대기

3. 종료 시 status 메시지 전송 (offline)

**graceful shutdown**: `SIGTERM` 수신 시 현재 작업 완료 후 종료 (작업 중이면 완료까지 대기, idle이면 즉시 종료).

### 2. `src/daemon/orchestrator.ts` — 오케스트레이터

에이전트 워커들을 관리하는 메인 프로세스 로직:

```ts
interface OrchestratorOptions {
  rootDir: string
  serverPort: number
}

class Orchestrator {
  private workers: Map<string, ChildProcess> = new Map()
  private agentStatuses: Map<string, 'idle' | 'working' | 'offline'> = new Map()

  constructor(private options: OrchestratorOptions) {}

  async start(): Promise<void>
  // - agent-store에서 모든 에이전트 목록 조회
  // - 각 에이전트별 worker fork
  // - IPC 메시지 핸들링 (heartbeat, status)
  // - SIGINT/SIGTERM 핸들러 등록

  private forkWorker(agentName: string): ChildProcess
  // - child_process.fork('dist/daemon/agent-worker.js', [], {
  //     env: { ...process.env, AGENT_NAME: agentName, ROOT_DIR, SERVER_PORT }
  //   })
  // - message 핸들러: agentStatuses 업데이트
  // - exit 핸들러: agentStatuses를 offline으로

  async stop(): Promise<void>
  // - 모든 worker에 SIGTERM 전송
  // - 30초 timeout 후 SIGKILL
  // - 모든 worker 종료 대기

  getAgentStatuses(): Map<string, string>
  // - 현재 에이전트 상태 맵 반환 (API에서 사용)
}
```

### 3. 오케스트레이터 export

`src/daemon/index.ts`에서 Orchestrator를 export하라. CLI 진입점과 서버에서 사용한다.

## Acceptance Criteria

```bash
npm run build  # 빌드 에러 없음
npm test       # 기존 테스트 모두 통과 (이 phase에서는 새 테스트 없음)
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/14-auto-startup/index.json`의 phase 5 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `agent-worker.ts`는 `fork()`의 진입점이므로 자체 실행 가능해야 한다. 파일 하단에 즉시 실행 로직을 넣어라.
- HTTP 요청은 Node.js 내장 `fetch`를 사용하라 (Node 18+). 별도 HTTP 클라이언트 라이브러리를 추가하지 마라.
- worker가 SIGTERM 수신 후 작업 중이면, 현재 claude 프로세스가 끝날 때까지 대기한다. 이는 `spawnClaude()`의 Promise가 resolve될 때까지 기다린다는 의미다.
- `fork()`의 경로는 빌드된 JS 파일 경로(`dist/daemon/agent-worker.js`)여야 한다. 개발 모드에서는 `tsx`로 직접 실행할 수 있도록 `src/daemon/agent-worker.ts` 경로도 지원하면 좋지만, 필수는 아니다.
- 이 phase에서는 daemon을 직접 테스트하지 않는다. 빌드 성공과 기존 테스트 유지가 AC다.
- 오케스트레이터의 `getAgentStatuses()`는 Phase 6에서 API 라우트가 사용한다.
