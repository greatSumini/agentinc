# auto-startup ADR (Architecture Decision Records)

## 기존 유효 ADR (agentinc에서 승계)

### ADR-001: Claude CLI spawn (child_process)

**결정**: Node SDK가 아닌 CLI spawn 사용

**이유**:
- 사용자의 기존 Claude Code 구독 활용
- 별도 API 키 설정 불필요
- Claude Code의 기존 인프라(MCP, hooks 등) 그대로 활용

**구현**:
- `src/claude-runner/spawner.ts` — `spawn('claude', flags, ...)`
- `--print` 모드로 비대화형 실행

### ADR-002: 파일시스템 저장소

**결정**: SQLite 등 DB가 아닌 JSON 파일 사용

**이유**:
- Git 친화적 — 변경 이력 추적 가능
- 사용자 편집 가능 — 직접 JSON 수정 가능
- 의존성 최소화 — 외부 DB 드라이버 불필요

**구현**:
- `src/core/store/config-store.ts` — `.auto-startup/config.json`
- `src/core/store/agent-store.ts` — `.auto-startup/agents/<name>/agent.json`
- `src/core/store/ticket-store.ts` — `.auto-startup/tickets/<id>.json`
- Optimistic locking via `version` 필드

## 신규 ADR

### ADR-101: Hono (Express 대체)

**결정**: Express → Hono 전환

**이유**:
- npm 패키지 사이즈 최소화 (Hono ~14KB vs Express ~200KB)
- Next.js standalone (~50MB)은 CLI 도구에 과도
- Web Standard API 기반 — 모던한 인터페이스

**트레이드오프**:
- Express 미들웨어 생태계 사용 불가
- 일부 Node.js 전용 기능에 어댑터 필요 (@hono/node-server)

**구현**:
- `src/server/index.ts` — `@hono/node-server`로 serve
- `src/server/*.ts` — Hono app 인스턴스

### ADR-102: 단일 패키지 (모노레포 해체)

**결정**: pnpm workspace 4패키지 → 단일 패키지

**이유**:
- CLI 명령어가 `auto-startup` 하나로 줄어 패키지 분리 가치 없음
- 빌드/배포 복잡도 감소
- 버전 관리 단순화

**이전 구조** (agentinc):
```
packages/
├── core/
├── server/
├── cli/
└── web/
```

**현재 구조**:
```
src/
├── core/
├── server/
├── cli/
└── web/
```

### ADR-103: Per-agent 리소스 (공유 풀 폐지)

**결정**: 공유 subagent/skill/hook 풀 + agent 매핑 → agent 디렉토리 내 직접 저장

**이유**:
- 공유 풀의 CRUD + 매핑 관리 복잡도
- 에이전트별 독립성이 더 중요
- 에이전트 삭제 시 리소스 정리 간단

**이전 구조**:
```
.auto-startup/
├── subagents/      # 공유 풀
│   └── context-engineer.md
├── skills/         # 공유 풀
└── agents/
    └── ceo/
        └── subagents.json  # ID 참조
```

**현재 구조**:
```
.auto-startup/agents/<name>/
├── agent.json
├── prompt.md
├── agents/         # 에이전트 소유
│   └── context-engineer.md
├── skills/         # 에이전트 소유
└── hooks.json      # 에이전트 소유
```

### ADR-104: 온보딩/노멀 서버 분리

**결정**: 하나의 서버에서 모드 전환이 아닌, 서버 재시작으로 모드 전환

**이유**:
- MCP 서버 tool 목록이 서버 시작 시점에 결정됨
- 온보딩 MCP (AskOnboardingQuestions, ConfirmCompanyName, CompleteOnboarding) vs 에이전트 MCP (CreateTicket, ListTickets, UpdateTicket)
- 런타임 모드 스위칭 복잡도 회피

**구현**:
- `src/server/onboarding.ts` — 온보딩 전용 라우트
- `src/server/normal.ts` — 노멀 전용 라우트
- `src/cli/index.ts` — 온보딩 완료 후 서버 종료 → 노멀 서버 시작

```typescript
// cli/index.ts
if (!isOnboarded(rootDir)) {
  const { server } = startOnboardingServer(rootDir, port)
  await waitForOnboardingComplete(rootDir)
  server.close()
}
const { server } = startNormalServer(rootDir, port, orchestrator)
```

### ADR-105: context-engineer 공통 서브에이전트

**결정**: 별도 에이전트가 아닌 모든 에이전트의 공통 sub-agent

**이유**:
- 에이전트별 리소스(skill, sub-agent, hooks)를 `.auto-startup/agents/<name>/` 하위에만 생성하도록 경로를 system prompt로 강제
- context-engineer가 잘못된 경로에 파일을 생성하면 다른 에이전트가 영향 받음

**구현**:
- `src/templates/context-engineer.md` — 경로 제한 규칙 명시
- `src/claude-runner/flag-builder.ts` — 모든 에이전트에 context-engineer 자동 포함

```typescript
// flag-builder.ts
const contextEngineer = getContextEngineerConfig()
agentsMap[contextEngineer.name] = subagentConfigToClaudeFormat(contextEngineer)
// 사용자 정의 subagent가 덮어쓸 수 있음
for (const subagent of userSubagents) {
  agentsMap[subagent.name] = subagentConfigToClaudeFormat(subagent)
}
```

### ADR-106: MCP stdio 서버를 통한 온보딩 양방향 통신

**결정**: 웹소켓이나 직접 통신이 아닌, MCP tool의 request/response 패턴 활용

**이유**:
- Claude session이 MCP tool을 호출하면 서버가 SSE로 웹에 push
- 사용자 응답 → tool response
- Claude의 기존 MCP 인프라를 그대로 활용
- 양방향 통신을 위한 별도 인프라 구축 불필요

**흐름**:
```
Claude → MCP tool call → Hono API → SSE → Web UI
                                            ↓
Claude ← MCP tool response ← Hono API ← POST
```

**구현**:
- `src/mcp/onboarding-mcp.ts` — tool 정의
- `src/server/onboarding.ts` — bridge 패턴으로 장기 폴링

```typescript
// onboarding.ts
const bridge = {
  pendingQuestionResolve: null,  // MCP가 대기하는 Promise resolver
  currentQuestions: null,        // 현재 표시 중인 질문
}

// MCP: GET /api/onboarding/pending-answer (long-poll)
// Web: POST /api/onboarding/answers → resolve pending promise
```
