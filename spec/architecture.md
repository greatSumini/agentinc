# auto-startup Architecture

## 패키지 구조

단일 패키지 구조. 모노레포 없음.

```
src/
├── core/           # 비즈니스 로직 (타입, 스토어, 서비스)
│   ├── types.ts
│   ├── store/
│   │   ├── config-store.ts
│   │   ├── agent-store.ts
│   │   └── ticket-store.ts
│   ├── services/
│   │   └── ticket.service.ts
│   └── utils/
│       └── frontmatter.ts
├── server/         # Hono API 서버
│   ├── index.ts        # 서버 시작 함수 (startOnboardingServer, startNormalServer)
│   ├── onboarding.ts   # 온보딩 모드 라우트
│   ├── normal.ts       # 노멀 모드 라우트
│   └── shared/
│       ├── event-bus.ts
│       └── sse-handler.ts
├── claude-runner/  # Claude CLI spawn
│   ├── index.ts        # runClaude 함수
│   ├── flag-builder.ts # CLI 플래그 빌드
│   ├── env-builder.ts  # 환경변수 빌드 (GitHub 프로필)
│   └── spawner.ts      # child_process spawn
├── daemon/         # 에이전트 워커
│   ├── orchestrator.ts # 워커 프로세스 관리
│   └── agent-worker.ts # 개별 에이전트 워커 (fork entry)
├── mcp/            # MCP stdio 서버
│   ├── protocol.ts     # MCP 서버 베이스 클래스
│   ├── onboarding-mcp.ts
│   └── agent-mcp.ts
├── templates/      # 프롬프트 템플릿
│   ├── context-engineer.md
│   ├── onboarding-system.md
│   └── personas/
│       ├── elon-musk.md
│       ├── peter-thiel.md
│       ├── steve-jobs.md
│       └── bill-gates.md
├── cli/            # CLI 진입점
│   └── index.ts
└── web/            # React 프론트엔드
    ├── App.tsx
    ├── main.tsx
    ├── pages/
    ├── components/
    ├── hooks/
    └── lib/
```

## 계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI (cli/)                          │
│  - 진입점, 온보딩/노멀 모드 분기, PID 관리, graceful shutdown │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌──────────────────┐                   ┌──────────────────┐
│  Server (Hono)   │                   │     Daemon       │
│  - onboarding.ts │                   │  - orchestrator  │
│  - normal.ts     │                   │  - agent-worker  │
│  - SSE events    │                   │  - HTTP polling  │
└──────────────────┘                   └──────────────────┘
          │                                       │
          ▼                                       ▼
┌──────────────────┐                   ┌──────────────────┐
│    Services      │                   │  Claude Runner   │
│  - TicketService │                   │  - flag-builder  │
└──────────────────┘                   │  - env-builder   │
          │                            │  - spawner       │
          ▼                            └──────────────────┘
┌──────────────────┐                              │
│      Store       │                              ▼
│  - config-store  │                   ┌──────────────────┐
│  - agent-store   │                   │   Claude CLI     │
│  - ticket-store  │                   │  (child_process) │
└──────────────────┘                   └──────────────────┘
          │
          ▼
┌──────────────────┐
│   Filesystem     │
│  .auto-startup/  │
└──────────────────┘
```

## 모듈 의존성

실제 import 기반:

| 모듈 | 의존 대상 |
|------|-----------|
| cli/index.ts | core/store/config-store, server/index, daemon/orchestrator |
| server/index.ts | server/onboarding, server/normal, server/shared/event-bus |
| server/onboarding.ts | core/store/config-store, core/store/agent-store, core/utils/frontmatter |
| server/normal.ts | core/store/*, core/services/ticket.service, daemon/orchestrator, claude-runner/spawner |
| daemon/orchestrator.ts | core/store/agent-store, daemon/agent-worker (fork) |
| daemon/agent-worker.ts | claude-runner/index, core/types |
| claude-runner/flag-builder.ts | core/store/agent-store, core/utils/frontmatter |
| claude-runner/spawner.ts | (child_process only) |
| mcp/onboarding-mcp.ts | mcp/protocol |
| mcp/agent-mcp.ts | mcp/protocol |

## 데이터 흐름

### 온보딩 모드

```
1. CLI 시작
   └─> isOnboarded() === false
       └─> startOnboardingServer(rootDir, port)
           └─> Hono 서버 시작 + 브라우저 오픈

2. 사용자: 페르소나 선택
   └─> POST /api/onboarding/persona
       └─> spawnCEOSession() (비동기)
           └─> claude --print --mcp-config onboarding-mcp.json

3. CEO Claude: AskOnboardingQuestions 호출
   └─> MCP: POST /api/onboarding/push-questions
       └─> eventBus.emit('onboarding:question')
           └─> SSE push to Web UI

4. 사용자: 답변 제출
   └─> POST /api/onboarding/answers
       └─> bridge.pendingQuestionResolve()
           └─> MCP tool response → Claude 계속

5. 반복 → CompleteOnboarding 호출
   └─> POST /api/onboarding/complete
       └─> principles/ 생성, CLAUDE.md 생성, CEO 에이전트 생성
       └─> config.onboardingCompleted = true

6. CLI: waitForOnboardingComplete() 완료
   └─> 서버 종료 → 노멀 모드 시작
```

### 노멀 모드

```
1. CLI: startNormalServer() + orchestrator.start()
   └─> Hono 서버 시작 (normal.ts)
   └─> Orchestrator: 각 에이전트에 워커 fork

2. AgentWorker: 티켓 폴링 (5초 간격)
   └─> GET /api/tickets?assignee=<name>&status=ready
       └─> 티켓 있으면:
           └─> PATCH /api/tickets/:id (status: in_progress)
           └─> runClaude(agentName, ticket.prompt)
           └─> PATCH /api/tickets/:id (status: completed|failed)

3. 웹 UI: SSE로 에이전트 상태 실시간 표시
   └─> GET /api/events
       └─> agent-worker IPC → orchestrator → eventBus → SSE
```

### Talk to CEO

```
1. 사용자: 메시지 입력
   └─> POST /api/chat { message: "..." }

2. normal.ts:
   └─> CEO prompt.md 로드
   └─> agent-mcp.json 생성
   └─> spawnClaude(['--print', '-p', message, ...], {}, { stdio: 'pipe' })

3. Claude 실행 완료
   └─> { response: stdout }

4. 웹 UI: 응답 표시
```

## 서버 분리

- **onboarding.ts**: 온보딩 전용 라우트
  - `/api/onboarding/*` — 페르소나, 질문, 회사명, 완료
  - MCP bridge 엔드포인트

- **normal.ts**: 대시보드 전용 라우트
  - `/api/config` — 설정 조회
  - `/api/tickets/*` — 티켓 CRUD
  - `/api/agents` — 에이전트 목록 + 상태
  - `/api/chat` — Talk to CEO
  - `/api/hooks/*` — SessionEnd hook

- **동시 실행 불가**: CLI가 온보딩 완료 후 순차적으로 전환. MCP 서버의 tool 목록이 시작 시점에 결정되므로 런타임 모드 스위칭 불가.

## 빌드 파이프라인

```bash
npm run build
```

1. **Vite**: `src/web/` → `dist/web/` (정적 파일)
   - React 번들, CSS, index.html

2. **tsc**: `src/` (web 제외) → `dist/` (서버/CLI/코어)
   - `tsconfig.server.json` 사용
   - ESM 출력

3. **런타임**: Hono가 `dist/web/` 정적 서빙

```json
// package.json
"scripts": {
  "build": "vite build && tsc -p tsconfig.server.json"
}
```
