# Phase 10: Web UI — Dashboard & Talk to CEO

## 사전 준비

먼저 아래 파일들을 읽고 현재 프로젝트 상태를 파악하라:

- `src/web/App.tsx` — 라우팅 구조
- `src/web/pages/OnboardingPage.tsx` — 온보딩 UI (컴포넌트 패턴 참조)
- `src/web/hooks/useSSE.ts` — SSE 훅
- `src/web/lib/api-client.ts` — API 클라이언트
- `src/web/index.css` — 스타일
- `src/server/normal.ts` — 노멀 모드 API (agents, tickets, chat, events)
- `src/core/types.ts` — AgentConfig, Ticket 타입

기존 대시보드 참조:
- `git show HEAD~9:packages/web/src/components/layout/Sidebar.tsx`
- `git show HEAD~9:packages/web/src/components/layout/Layout.tsx`
- `git show HEAD~9:packages/web/src/hooks/useAgents.ts`
- `git show HEAD~9:packages/web/src/stores/connection-store.ts`

## 작업 내용

### 1. 레이아웃 + 사이드바

**`src/web/components/layout/Layout.tsx`**:
```
┌──────────┬──────────────────────────────┐
│ Sidebar  │                              │
│          │        Main Content          │
│          │                              │
│          │                              │
│          │                              │
│          │                              │
└──────────┴──────────────────────────────┘
```

- 좌측 사이드바 고정 (w-56), 우측 메인 콘텐츠 영역
- 사이드바 배경: `bg-gray-50 border-r border-gray-200`

**`src/web/components/layout/Sidebar.tsx`**:
```
┌──────────────┐
│ {회사명}      │  ← 상단에 회사명 (config에서 가져옴)
│              │
│ [Talk to CEO]│  ← 최상단 메뉴 버튼
│              │
│ ── Menu ──   │
│ Dashboard    │  ← 현재는 이것만
│              │
│              │
│              │
└──────────────┘
```

- 회사명: `text-sm font-semibold text-gray-900 px-4 py-3`
- Talk to CEO 버튼: `mx-3 px-3 py-2 bg-gray-900 text-white rounded-md text-sm`
- 메뉴 아이템: `px-4 py-2 text-sm text-gray-600 hover:bg-gray-100`, 활성: `bg-gray-100 text-gray-900`

### 2. `src/web/hooks/useConfig.ts` — 설정 훅

```ts
function useConfig(): { company: string | null; loading: boolean }
// - GET /api/onboarding/status 또는 별도 config API에서 회사명 가져오기
// - 노멀 모드에서는 config가 항상 존재
```

**참고**: 노멀 모드 서버에 `GET /api/config` 엔드포인트를 추가해야 할 수 있다. `src/server/normal.ts`에 다음을 추가하라:

```ts
// GET /api/config — 현재 설정 반환
// Response: { company: string, persona: string }
```

### 3. `src/web/hooks/useAgents.ts` — 에이전트 훅

```ts
interface AgentWithStatus extends AgentConfig {
  status: 'idle' | 'working' | 'offline'
}

function useAgents(): { agents: AgentWithStatus[]; loading: boolean }
// - GET /api/agents 호출
// - SSE agent:status 이벤트로 실시간 업데이트
```

### 4. `src/web/pages/DashboardPage.tsx` — 대시보드

placeholder를 실제 구현으로 교체:

```
┌──────────────────────────────────────────┐
│                                          │
│  Agents                                  │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ Name     │ Status  │ Description     ││
│  │──────────│─────────│─────────────────││
│  │ ceo      │ ● idle  │ 회사의 CEO...   ││
│  │ ...      │ ...     │ ...             ││
│  └──────────────────────────────────────┘│
│                                          │
└──────────────────────────────────────────┘
```

- 에이전트 테이블: 이름, 상태, 설명
- 상태 배지:
  - idle: `bg-green-100 text-green-700`
  - working: `bg-blue-100 text-blue-700`
  - offline: `bg-gray-100 text-gray-500`
- 테이블 스타일: `border border-gray-200 rounded-lg`, 헤더 `bg-gray-50 text-gray-600 text-xs uppercase`

### 5. `src/web/hooks/useChat.ts` — CEO 채팅 훅

```ts
interface ChatState {
  messages: Array<{ role: 'user' | 'ceo'; content: string }>
  loading: boolean
  error: string | null
}

function useChat(): {
  state: ChatState
  sendMessage: (message: string) => Promise<void>
}
// - POST /api/chat 호출
// - 응답을 messages에 추가
// - loading 상태 관리 (CEO 응답 대기 중)
```

### 6. `src/web/pages/ChatPage.tsx` — Talk to CEO

```
┌──────────────────────────────────────────┐
│  Talk to CEO                             │
│──────────────────────────────────────────│
│                                          │
│  [CEO 메시지 1]                          │
│                          [사용자 메시지]  │
│  [CEO 메시지 2]                          │
│                                          │
│  ... (loading indicator when waiting)    │
│                                          │
│──────────────────────────────────────────│
│  ┌──────────────────────────┐ [전송]     │
│  │ 메시지 입력...            │           │
│  └──────────────────────────┘           │
└──────────────────────────────────────────┘
```

- CEO 메시지: 좌측 정렬, `bg-gray-100 rounded-lg p-3`
- 사용자 메시지: 우측 정렬, `bg-gray-900 text-white rounded-lg p-3`
- 입력창: 하단 고정, `border-t border-gray-200`
- 전송 버튼 또는 Enter 키로 전송
- 응답 대기 중: "CEO is thinking..." 텍스트 + 점 애니메이션 (CSS only)
- 응답이 길어질 수 있으므로 (claude 실행 시간), loading 상태를 명확히 표시

### 7. `src/web/App.tsx` 업데이트

Layout 컴포넌트를 DashboardPage, ChatPage에 적용:

```tsx
<Routes>
  <Route path="/onboarding" element={<OnboardingPage />} />
  <Route path="/dashboard" element={<Layout><DashboardPage /></Layout>} />
  <Route path="/chat" element={<Layout><ChatPage /></Layout>} />
  <Route path="/" element={<RootRedirect />} />
</Routes>
```

### 8. 컴포넌트 파일 구조 추가

```
src/web/
├── components/
│   ├── layout/
│   │   ├── Layout.tsx
│   │   └── Sidebar.tsx
│   ├── dashboard/
│   │   ├── AgentTable.tsx
│   │   └── AgentStatusBadge.tsx
│   └── chat/
│       ├── ChatInput.tsx
│       └── ChatMessage.tsx
├── hooks/
│   ├── useConfig.ts
│   ├── useAgents.ts
│   └── useChat.ts
├── pages/
│   ├── DashboardPage.tsx
│   └── ChatPage.tsx
```

## Acceptance Criteria

```bash
npm run build  # Vite + tsc 빌드 에러 없음
npm test       # 기존 테스트 모두 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/14-auto-startup/index.json`의 phase 10 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `zustand`가 필요하면 `npm install zustand`로 추가하라. SSE 연결 상태 등을 글로벌로 관리해야 한다면 사용.
- Talk to CEO의 POST /api/chat 응답은 매우 느릴 수 있다 (Claude CLI 실행 시간). fetch timeout을 넉넉히 잡거나 (5분+), AbortController로 취소 가능하게 하라.
- 사이드바의 Talk to CEO 버튼은 `/chat`으로 navigate한다.
- 대시보드와 채팅 페이지 모두 Layout 내부에 렌더링되어야 한다.
- 온보딩 페이지는 Layout **없이** 렌더링된다 (사이드바 불필요).
- 이모지를 사용하지 마라.
- 이전 phase의 코드(OnboardingPage 등)를 수정하지 마라.
- 이전 phase의 테스트를 깨뜨리지 마라.
