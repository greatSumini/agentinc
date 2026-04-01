# auto-startup Specification

## 개요

auto-startup은 CLI 도구로, 실행 시 로컬 웹 서버를 띄워 AI 에이전트 기반의 "회사"를 운영한다. 사용자가 CEO 페르소나를 선택하고 온보딩 대화를 통해 회사를 설립하면, 에이전트들이 티켓 기반으로 업무를 처리한다.

## 실행 흐름

1. `auto-startup` 실행 → `isOnboarded(rootDir)` 확인
2. **미완료**: 온보딩 서버 시작 → 브라우저 자동 오픈 → CEO 에이전트와 대화 → 회사 생성 → 서버 종료
3. **완료**: 대시보드 서버 + Orchestrator 시작 → 에이전트 워커 폴링

## 디렉토리 구조: .auto-startup/

```
.auto-startup/
├── config.json           # Config 객체 (company, persona, onboardingCompleted, port)
├── onboarding.json       # 온보딩 Q&A 기록
├── .pid                  # 서버 프로세스 ID
├── agents/
│   └── <name>/
│       ├── agent.json    # AgentConfig
│       ├── prompt.md     # 에이전트 시스템 프롬프트
│       ├── agents/       # sub-agents (*.md with frontmatter)
│       │   └── <subagent>.md
│       ├── skills/       # 스킬 디렉토리
│       │   └── <skill>/
│       │       └── SKILL.md
│       ├── hooks.json    # 에이전트별 hooks
│       └── mcp.json      # MCP 서버 설정 (선택)
├── tickets/
│   └── <id>.json         # Ticket 객체
└── .tmp/                 # 임시 파일 (실행 후 정리)
```

## 디렉토리 구조: 실행루트 생성물

온보딩 완료 시 실행 루트 디렉토리에 생성되는 파일:

```
<rootDir>/
├── CLAUDE.md             # 회사 소개 및 principles 참조
├── principles/
│   ├── goal.md           # 회사 목표
│   └── business.md       # 핵심 가치, 추구하지 않는 것
└── .claude/
    └── settings.json     # SessionEnd hook (daemon 통신)
```

## 에이전트 모델

### CEO 에이전트

온보딩 완료 시 자동 생성되는 기본 에이전트. `can_delegate: true`로 설정되어 다른 에이전트에게 업무를 위임할 수 있다.

### context-engineer 공통 서브에이전트

모든 에이전트의 공통 sub-agent로, 세션에서 학습한 내용을 skill, sub-agent, hooks로 기록한다.

- 경로 제한: `.auto-startup/agents/<현재에이전트명>/` 하위에만 파일 생성
- sub-agent: `agents/<이름>.md` (YAML frontmatter + markdown)
- skill: `skills/<이름>/SKILL.md`
- hooks: `hooks.json`

### Per-agent 리소스

각 에이전트는 자신의 디렉토리 내에 모든 리소스를 소유한다:

- `agent.json` — AgentConfig
- `prompt.md` — 시스템 프롬프트
- `agents/` — sub-agents
- `skills/` — 스킬
- `hooks.json` — hooks

### AgentConfig 타입

```typescript
interface AgentConfig {
  name: string           // 에이전트 이름
  description: string    // 에이전트 설명
  gh_user?: string       // GitHub 사용자 (env-builder용)
  can_delegate?: boolean // 다른 에이전트에게 업무 위임 가능 여부
}
```

## 온보딩 플로우

1. **페르소나 선택**: elon-musk, peter-thiel, steve-jobs, bill-gates 중 선택
2. **첫 질문**: CEO가 회사 목표를 질문 (하드코딩된 메시지)
3. **사용자 응답**: 자유 텍스트 입력
4. **추가 질문 3개**: AskOnboardingQuestions tool로 a/b/c/기타 형식 질문
5. **반복/종료 선택**: [바로 시작] → 회사명 확인, [질문 더 받기] → 추가 질문 3개
6. **회사명 확인**: ConfirmCompanyName tool로 제안 → 수락 또는 직접 입력
7. **완료**: CompleteOnboarding tool → config, principles, CEO 에이전트 생성

### MCP 통신 흐름

```
웹 UI ← SSE ← Hono API ← MCP Server (stdio) ← CEO Claude session

1. CEO Claude spawn → MCP tool 호출
2. MCP → POST /api/onboarding/push-questions
3. Hono → eventBus.emit() → SSE push to web
4. 사용자 응답 → POST /api/onboarding/answers
5. MCP → GET /api/onboarding/pending-answer (long-poll)
6. 응답 반환 → Claude 계속 실행
```

## 티켓 시스템

### Ticket 타입

```typescript
interface Ticket {
  id: string                    // UUID
  title: string                 // 제목
  prompt: string                // 작업 내용
  type: 'task' | 'cc_review'    // 일반 태스크 또는 CC 리뷰
  parentTicketId?: string       // cc_review의 경우 부모 티켓 ID
  ccReviewTicketIds?: string[]  // CC 리뷰 티켓 ID 목록
  assignee: string              // 담당 에이전트
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: TicketStatus
  createdBy: string             // 생성자
  createdAt: string             // ISO 날짜
  startedAt?: string            // in_progress 시작 시간
  completedAt?: string          // 완료/실패 시간
  cancelledAt?: string          // 취소 시간
  result?: { exitCode: number; logPath: string }
  comments: Comment[]
  metadata?: Record<string, unknown>
  version: number               // optimistic locking
}
```

### 상태 머신

```
blocked → ready, cancelled
ready → in_progress, cancelled
in_progress → completed, failed
completed → (terminal)
failed → (terminal)
cancelled → (terminal)
```

### CC 시스템

1. 티켓 생성 시 `cc` 배열 지정 → 각 CC 에이전트에 cc_review 티켓 생성
2. 원본 티켓은 `blocked` 상태로 시작
3. 모든 cc_review 티켓이 `completed` → 원본 티켓이 `ready`로 전환

### 우선순위 정렬

urgent(0) > high(1) > normal(2) > low(3) 순으로 정렬, 같은 우선순위는 createdAt 오름차순.

## MCP 도구

### 온보딩용 (onboarding-mcp)

**AskOnboardingQuestions**
```typescript
input: {
  questions: Array<{
    id: string
    text: string
    options: [string, string, string]  // a, b, c 선택지
  }>
}
output: {
  answers: Array<{ questionId: string; answer: string }>
  wantMoreQuestions: boolean
}
```

**ConfirmCompanyName**
```typescript
input: { suggestedName: string }
output: { confirmedName: string }
```

**CompleteOnboarding**
```typescript
input: {
  company: string
  goal: string
  businessValues: string
  businessAntiValues: string
}
output: { success: boolean }
```

### 에이전트용 (agent-mcp)

**CreateTicket**
```typescript
input: {
  title: string
  prompt: string
  assignee: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  cc?: string[]
}
output: { ticketId: string; status: string }
```

**ListTickets**
```typescript
input: {
  status?: string
  assignee?: string
}
output: { tickets: Ticket[] }
```

**UpdateTicket**
```typescript
input: {
  ticketId: string
  status?: string
  priority?: string
  expectedVersion: number
}
output: { ticket: Ticket }
```
