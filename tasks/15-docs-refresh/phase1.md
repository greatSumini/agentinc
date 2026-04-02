# Phase 1: spec/ 핵심 문서 생성

## 사전 준비

이 프로젝트는 `auto-startup`이라는 CLI 도구다. 실행 시 로컬 웹 서버를 띄워 AI 에이전트 기반의 "회사"를 운영한다. 현재 소스코드를 직접 읽고 정확한 문서를 작성해야 한다.

먼저 다음 파일들을 **반드시 읽어라**:

**프로젝트 개요:**
- `CLAUDE.md`
- `package.json`

**코어:**
- `src/core/types.ts` — 모든 타입 정의
- `src/core/store/config-store.ts` — Config 스토어
- `src/core/store/agent-store.ts` — Agent 스토어
- `src/core/store/ticket-store.ts` — Ticket 스토어
- `src/core/services/ticket.service.ts` — Ticket 서비스

**Claude Runner:**
- `src/claude-runner/flag-builder.ts` — 플래그 빌더
- `src/claude-runner/spawner.ts` — 스포너
- `src/claude-runner/env-builder.ts` — 환경변수 빌더

**서버:**
- `src/server/index.ts` — 서버 시작
- `src/server/onboarding.ts` — 온보딩 서버
- `src/server/normal.ts` — 노멀 서버

**MCP:**
- `src/mcp/onboarding-mcp.ts` — 온보딩 MCP
- `src/mcp/agent-mcp.ts` — 에이전트 MCP

**Daemon:**
- `src/daemon/orchestrator.ts` — 오케스트레이터
- `src/daemon/agent-worker.ts` — 에이전트 워커

**CLI:**
- `src/cli/index.ts` — CLI 진입점

**Web:**
- `src/web/App.tsx` — 라우팅
- `src/web/pages/OnboardingPage.tsx` — 온보딩 UI
- `src/web/pages/DashboardPage.tsx` — 대시보드
- `src/web/pages/ChatPage.tsx` — Talk to CEO

**Templates:**
- `src/templates/context-engineer.md`
- `src/templates/onboarding-system.md`
- `src/templates/personas/` 내 파일들

**테스트:**
- `tests/` 내 모든 테스트 파일 목록 확인 (파일명과 테스트 수)

**기존 참조:**
- `spec/external/` — Phase 0에서 복원된 외부 참조 문서

이전 phase 작업물:
- Phase 0에서 `spec/external/` 3개 파일이 복원됨

## 작업 내용

아래 5개 문서를 `spec/` 디렉토리에 생성하라. **반드시 실제 소스코드를 읽고** 현행 구조에 정확히 맞는 내용을 작성하라. 추측하지 마라.

### 1. `spec/spec.md` — 핵심 스펙

다음 구조로 작성:

```markdown
# auto-startup Specification

## 개요
(한 문단: 무엇을 하는 도구인지, 핵심 가치)

## 실행 흐름
(온보딩 미완료 → 온보딩 모드 → 완료 → 노멀 모드 흐름)

## 디렉토리 구조: .auto-startup/
(.auto-startup/ 하위 구조 전체. 실제 코드의 config-store, agent-store, ticket-store에서 사용하는 경로 기반)

## 디렉토리 구조: 실행루트 생성물
(principles/, CLAUDE.md, .claude/settings.json — 온보딩 완료 시 생성되는 것들)

## 에이전트 모델
- CEO 에이전트 (기본)
- context-engineer 공통 서브에이전트
- per-agent 리소스 (agents/, skills/, hooks.json)
- AgentConfig 타입 필드 설명

## 온보딩 플로우
(페르소나 선택 → 첫 질문 → 추가 질문 3개(a/b/c/기타) → 회사 생성)
(MCP 통신 흐름: 웹 ← SSE ← API ← MCP ← CEO claude session)

## 티켓 시스템
- Ticket 타입 필드
- 상태 머신 (blocked/ready/in_progress/completed/failed/cancelled + 유효 전이)
- CC 시스템 (cc_review → parent unblock)
- 우선순위 정렬

## MCP 도구
온보딩용:
- AskOnboardingQuestions (input/output)
- ConfirmCompanyName
- CompleteOnboarding

에이전트용:
- CreateTicket
- ListTickets
- UpdateTicket
```

### 2. `spec/architecture.md` — 아키텍처

```markdown
# auto-startup Architecture

## 패키지 구조
(단일 패키지. src/ 하위 모듈 맵 — core, server, claude-runner, daemon, mcp, cli, web, templates)

## 계층 구조
CLI → Server (Hono) → Services → Store (filesystem)
     → Daemon → Claude Runner → Claude CLI
     → MCP Server (stdio) → Server API

## 모듈 의존성
(어떤 모듈이 어떤 모듈을 import하는지. 실제 import문 기반)

## 데이터 흐름

### 온보딩 모드
CLI → startOnboardingServer() → Hono (온보딩 API) + CEO Claude session spawn
→ MCP stdio server → Hono API (SSE push) → Web UI → 사용자 응답 → MCP tool response

### 노멀 모드
CLI → startNormalServer() + Orchestrator.start()
→ AgentWorker (fork) → HTTP polling → ticket 처리 → Claude spawn

### Talk to CEO
Web UI → POST /api/chat → Claude spawn (--print) → 응답 반환

## 서버 분리
- onboarding.ts: 온보딩 전용 라우트
- normal.ts: 대시보드 전용 라우트
- 동시에 실행되지 않음. CLI가 순차 전환.

## 빌드 파이프라인
- Vite: src/web/ → dist/web/ (정적 파일)
- tsc: src/ (web 제외) → dist/ (서버/CLI/코어)
- Hono가 dist/web/ 정적 서빙
```

### 3. `spec/testing.md` — 테스트 전략

```markdown
# auto-startup Testing Strategy

## 원칙
- 순수 로직에 집중: mock으로 접착제 코드를 테스트하지 않는다
- 커버리지 숫자 목표 없음
- 구현과 테스트를 함께 작성

## 도구
- vitest — TypeScript 네이티브

## 테스트 범위
(실제 tests/ 디렉토리의 파일 목록을 읽고, 각 모듈의 테스트 유형/수준/이유를 표로 작성)

| 모듈 | 테스트 유형 | 수준 | 이유 |
|---|---|---|---|
| frontmatter | 유닛 | 철저히 | 파싱 실패 시 prompt 손실 |
| config-store | 통합 (실제 fs) | 핵심 경로 | 파일 I/O는 실제로 돌려봐야 의미 |
| agent-store | 통합 (실제 fs) | 핵심 경로 | per-agent 경로 구조 검증 |
| ticket-store | 통합 (실제 fs) | 핵심 경로 | optimistic locking 검증 |
| ticket.service | 유닛 | 핵심 분기 | 상태 머신 전이, CC 로직 |
| flag-builder | 유닛 | 철저히 | 플래그 오류 시 Claude 오작동 |
| env-builder | 유닛 | 핵심 분기 | 환경변수 변환 로직 |

## 테스트하지 않는 것
| 모듈 | 이유 |
|---|---|
| Hono routes | 프레임워크 책임 |
| MCP server | stdio mock 무가치 |
| daemon | child_process mock 무가치 |
| web UI | 빌드 성공 = 최소 검증 |
| spawner | dry-run 수동 검증 |
```

### 4. `spec/adr.md` — 아키텍처 의사결정 기록

```markdown
# auto-startup ADR (Architecture Decision Records)

## 기존 유효 ADR (agentinc에서 승계)

### ADR-001: Claude CLI spawn (child_process)
- Node SDK가 아닌 CLI spawn
- 이유: 사용자의 Claude Code 구독 활용

### ADR-002: 파일시스템 저장소
- SQLite 등이 아닌 JSON 파일
- 이유: Git 친화적, 사용자 편집 가능

## 신규 ADR

### ADR-101: Hono (Express 대체)
- Express → Hono 전환
- 이유: npm 패키지 사이즈 최소화 (Hono ~14KB vs Express ~200KB). Next.js standalone (~50MB)은 CLI 도구에 과도.

### ADR-102: 단일 패키지 (모노레포 해체)
- pnpm workspace 4패키지 → 단일 패키지
- 이유: CLI 명령어가 하나로 줄어 패키지 분리의 가치가 없어짐. 빌드/배포 복잡도 감소.

### ADR-103: Per-agent 리소스 (공유 풀 폐지)
- 공유 subagent/skill/hook 풀 + agent 매핑 → agent 디렉토리 내 직접 저장
- 이유: 공유 풀의 CRUD + 매핑 관리 복잡도. 에이전트별 독립성이 더 중요.

### ADR-104: 온보딩/노멀 서버 분리
- 하나의 서버에서 모드 전환이 아닌, 서버 재시작으로 모드 전환
- 이유: MCP 서버 tool 목록이 서버 시작 시점에 결정됨. 런타임 모드 스위칭 복잡도 회피.

### ADR-105: context-engineer 공통 서브에이전트
- 별도 에이전트가 아닌 모든 에이전트의 공통 sub-agent
- 이유: 에이전트별 리소스(skill, sub-agent, hooks)를 `.auto-startup/agents/<name>/` 하위에만 생성하도록 경로를 system prompt로 강제.

### ADR-106: MCP stdio 서버를 통한 온보딩 양방향 통신
- 웹소켓이나 직접 통신이 아닌, MCP tool의 request/response 패턴 활용
- 이유: Claude session이 MCP tool을 호출하면 서버가 SSE로 웹에 push → 사용자 응답 → tool response. Claude의 기존 MCP 인프라를 그대로 활용.
```

### 5. `spec/web.md` — 웹 UI 스펙

```markdown
# auto-startup Web UI

## 기술 스택
- React 18 + TypeScript
- Vite (빌드)
- Tailwind CSS (스타일링)
- React Router v6 (라우팅)

## 라우팅
/ → RootRedirect (온보딩 여부로 분기)
/onboarding → OnboardingPage (Layout 없음)
/dashboard → Layout > DashboardPage
/chat → Layout > ChatPage

## 온보딩 UI

### Step 1: 페르소나 선택
(4개 카드: Elon Musk, Peter Thiel, Steve Jobs, Bill Gates)
(클릭으로 선택 → Step 2로 전환)

### Step 2: CEO 대화
(자유 입력 → 추가 질문 3개 (a/b/c/기타) → [바로 시작] / [질문 더 받기])

### Step 3: 회사명 확인
("OOO으로 생성할까요?" → 예 / 아니오-직접입력)

## 대시보드

### Sidebar
- 상단: 회사명
- 최상단 메뉴: Talk to CEO 버튼
- 네비게이션: Dashboard

### AgentTable
- 컬럼: Name, Status, Description
- 상태 배지: idle(green), working(blue), offline(gray)
- SSE로 실시간 업데이트

## Talk to CEO
- 채팅 인터페이스 (CEO 좌측, 사용자 우측)
- POST /api/chat → Claude spawn → 응답
- 응답 대기 중 loading indicator

## 스타일 가이드
- 모노크롬 팔레트 (gray 베이스)
- 시스템 폰트 (Tailwind 기본)
- 최소 그림자 (모달/드롭다운만)
- 이모지 사용 금지
- Lucide React 아이콘 (필요 시)
```

## Acceptance Criteria

```bash
# 문서 존재 확인
test -f spec/spec.md && echo "PASS" || echo "FAIL"
test -f spec/architecture.md && echo "PASS" || echo "FAIL"
test -f spec/testing.md && echo "PASS" || echo "FAIL"
test -f spec/adr.md && echo "PASS" || echo "FAIL"
test -f spec/web.md && echo "PASS" || echo "FAIL"

# 빌드/테스트 (문서 변경이므로 깨지지 않아야 함)
npm run build
npm test
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/15-docs-refresh/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- **소스코드를 반드시 읽고** 문서를 작성하라. 위 템플릿은 구조 가이드일 뿐이며, 실제 코드와 다른 내용을 적지 마라.
- 각 문서의 세부 내용(타입 필드, 함수 시그니처, 라우트 경로 등)은 실제 소스코드에서 추출하라.
- `spec/external/` 파일들은 이미 Phase 0에서 복원되었다. 수정하지 마라.
- ADR에서 "기존 유효 ADR"은 이 프로젝트의 이전 기록을 참조한 것이다. 실제 코드에서 해당 결정이 여전히 유효한지 확인하라.
- 문서 길이는 각각 100~300줄 수준. 장황하지 않게, 핵심만.
