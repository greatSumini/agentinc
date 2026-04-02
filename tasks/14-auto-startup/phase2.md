# Phase 2: Core Types & Store

## 사전 준비

먼저 아래 파일들을 읽고 현재 프로젝트 상태를 파악하라:

- `src/server/index.ts` — Hono 서버 구조
- `src/cli/index.ts` — CLI 진입점
- `package.json` — 의존성 확인
- `vitest.config.ts` — 테스트 설정

기존 구현을 참조하려면 다음 git 명령어를 사용하라:
- `git show HEAD~1:packages/core/src/types/index.ts` — 기존 타입 정의
- `git show HEAD~1:packages/core/src/store/fs-store.ts` — 기존 파일 스토어
- `git show HEAD~1:packages/core/src/utils/frontmatter.ts` — 기존 frontmatter 파싱
- `git show HEAD~1:packages/core/tests/store/fs-store.test.ts` — 기존 스토어 테스트
- `git show HEAD~1:packages/core/tests/utils/frontmatter.test.ts` — 기존 frontmatter 테스트

**중요**: 기존 코드를 그대로 복사하지 마라. 새로운 per-agent 디렉토리 구조에 맞게 재설계해야 한다.

## 작업 내용

### 1. `src/core/types.ts` — 타입 정의

다음 타입들을 정의하라:

```ts
// --- Config ---
interface Config {
  company: string           // 회사명
  persona: Persona          // CEO 페르소나
  onboardingCompleted: boolean
  port: number              // 서버 포트 (default: 3847)
}

type Persona = 'elon-musk' | 'peter-thiel' | 'steve-jobs' | 'bill-gates'

// --- Agent ---
interface AgentConfig {
  name: string
  description: string
  gh_user?: string          // GitHub CLI 계정
  can_delegate?: boolean    // 다른 에이전트에게 티켓 생성 가능 여부
}

// --- Ticket ---
type TicketStatus = 'blocked' | 'ready' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
type TicketType = 'task' | 'cc_review'

interface Ticket {
  id: string
  title: string
  prompt: string
  type: TicketType
  parentTicketId?: string
  ccReviewTicketIds?: string[]
  assignee: string
  priority: TicketPriority
  status: TicketStatus
  createdBy: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  cancelledAt?: string
  result?: { exitCode: number; logPath: string }
  comments: Comment[]
  metadata?: Record<string, unknown>
  version: number
}

interface Comment {
  id: string
  author: string
  content: string
  createdAt: string
}

// --- Subagent (frontmatter MD) ---
interface SubagentConfig {
  name: string
  description: string
  prompt: string            // markdown body
  model?: string
  tools?: string
  maxTurns?: number
  disallowedTools?: string
  permissionMode?: string
}
```

모든 타입을 export하라.

### 2. `src/core/utils/frontmatter.ts` — Frontmatter 파싱 유틸

`gray-matter`를 사용해 sub-agent `.md` 파일을 `SubagentConfig`로 파싱하는 함수:

```ts
parseSubagentMd(content: string): SubagentConfig
// - gray-matter로 frontmatter(YAML) + body 분리
// - frontmatter에서 name, description, model, tools, maxTurns, disallowedTools, permissionMode 추출
// - body를 prompt로 사용
// - name 또는 description이 없으면 에러
```

### 3. `src/core/store/config-store.ts` — Config 스토어

`.auto-startup/config.json` 기반 설정 관리:

```ts
getConfig(rootDir: string): Config | null
// - .auto-startup/config.json 읽기
// - 파일이 없으면 null 반환

saveConfig(rootDir: string, config: Config): void
// - .auto-startup/ 디렉토리 없으면 생성
// - config.json 쓰기

isOnboarded(rootDir: string): boolean
// - config 읽어서 onboardingCompleted === true 여부 반환
```

### 4. `src/core/store/agent-store.ts` — Agent 스토어

`.auto-startup/agents/<name>/` 기반 에이전트 관리:

```ts
getAgent(rootDir: string, name: string): AgentConfig | null
// - .auto-startup/agents/<name>/agent.json 읽기

saveAgent(rootDir: string, name: string, config: AgentConfig): void
// - 디렉토리 + agent.json 쓰기

listAgents(rootDir: string): AgentConfig[]
// - .auto-startup/agents/ 하위 디렉토리 순회

getAgentPrompt(rootDir: string, name: string): string | null
// - .auto-startup/agents/<name>/prompt.md 읽기

saveAgentPrompt(rootDir: string, name: string, content: string): void
// - prompt.md 쓰기

getAgentSubagents(rootDir: string, name: string): SubagentConfig[]
// - .auto-startup/agents/<name>/agents/*.md 파일 순회
// - 각 파일을 parseSubagentMd()로 파싱

saveAgentSubagent(rootDir: string, name: string, subagent: SubagentConfig): void
// - .auto-startup/agents/<name>/agents/<subagent.name>.md 로 저장
// - frontmatter + body 형식

getAgentHooks(rootDir: string, name: string): Record<string, unknown> | null
// - .auto-startup/agents/<name>/hooks.json 읽기 (claude code settings.json hooks 형식)

saveAgentHooks(rootDir: string, name: string, hooks: Record<string, unknown>): void
// - hooks.json 쓰기

listAgentSkillDirs(rootDir: string, name: string): string[]
// - .auto-startup/agents/<name>/skills/ 하위 디렉토리명 목록 반환
```

**핵심 규칙**:
- 모든 함수에서 디렉토리가 없으면 자동 생성 (`fs.mkdirSync(path, { recursive: true })`)
- 파일이 없으면 null 반환 (에러 throw 하지 않음)
- 동기 API 사용 (`fs.readFileSync`, `fs.writeFileSync` 등) — 단순성 우선

### 5. 테스트 작성

**`tests/core/frontmatter.test.ts`**:
- 기존 `git show HEAD~1:packages/core/tests/utils/frontmatter.test.ts`를 참조하여 포팅
- 정상 파싱, name 누락 시 에러, description 누락 시 에러, optional 필드 처리 등

**`tests/core/config-store.test.ts`**:
- 임시 디렉토리에서 CRUD 테스트
- `getConfig()` — 파일 없을 때 null, 있을 때 정상 반환
- `saveConfig()` — 디렉토리 자동 생성, 파일 쓰기
- `isOnboarded()` — true/false 케이스

**`tests/core/agent-store.test.ts`**:
- 임시 디렉토리에서 CRUD 테스트
- `getAgent()` / `saveAgent()` — 기본 CRUD
- `listAgents()` — 여러 에이전트 목록
- `getAgentSubagents()` — frontmatter MD 파일 파싱
- `saveAgentSubagent()` — frontmatter + body 형식으로 저장
- `getAgentHooks()` / `saveAgentHooks()` — hooks.json CRUD

## Acceptance Criteria

```bash
npm run build  # 빌드 에러 없음
npm test       # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/14-auto-startup/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `fs` 모듈 사용 시 `node:fs`로 import하라 (Node.js 내장 모듈 프리픽스).
- 테스트에서 임시 디렉토리는 `os.tmpdir()` + 랜덤 이름으로 생성하고, `afterEach`에서 정리하라.
- `gray-matter`는 이미 `package.json` dependencies에 포함되어 있다.
- `SubagentConfig`의 `prompt`는 frontmatter 이후의 markdown body 전체이다. trim하되 빈 문자열이어도 에러가 아니다.
- hooks.json은 claude code의 `settings.json` hooks 형식을 따른다. 이 phase에서는 구조를 강제하지 않고 `Record<string, unknown>`으로 읽고 쓴다.
