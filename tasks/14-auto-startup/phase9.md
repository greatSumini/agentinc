# Phase 9: Web UI — Onboarding

## 사전 준비

먼저 아래 파일들을 읽고 현재 프로젝트 상태를 파악하라:

- `src/web/App.tsx` — 현재 App 컴포넌트 (Hello World)
- `src/web/main.tsx` — React 진입점
- `src/web/index.css` — Tailwind CSS 설정
- `src/server/onboarding.ts` — 온보딩 API 라우트 (엔드포인트 시그니처 확인)
- `src/server/shared/event-bus.ts` — SSE EventBus (이벤트 타입 확인)
- `vite.config.ts` — 프록시 설정 확인 (/api → localhost:3847)

기존 웹 UI 참조:
- `git show HEAD~8:packages/web/src/App.tsx` — 기존 라우팅 구조
- `git show HEAD~8:packages/web/src/hooks/useSSE.ts` — 기존 SSE 훅
- `git show HEAD~8:packages/web/src/index.css` — 기존 Tailwind 설정

## 작업 내용

### 1. `src/web/App.tsx` — 라우팅 설정

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// 온보딩 완료 여부는 GET /api/onboarding/status로 판단
// step === 'completed' → 대시보드로 리다이렉트
// 그 외 → 온보딩 페이지로 리다이렉트

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}

// RootRedirect: /api/onboarding/status 호출 → 분기
```

DashboardPage와 ChatPage는 이 phase에서는 placeholder로 구현 (Phase 10에서 완성).

### 2. `src/web/lib/api-client.ts` — API 클라이언트

```ts
const BASE_URL = '/api'

async function get<T>(path: string): Promise<T>
async function post<T>(path: string, body: unknown): Promise<T>
async function patch<T>(path: string, body: unknown): Promise<T>
```

### 3. `src/web/hooks/useSSE.ts` — SSE 훅

```ts
function useSSE(eventTypes: string[], onEvent: (type: string, data: unknown) => void): { connected: boolean }
// - /api/events에 EventSource 연결
// - eventTypes 각각에 대해 addEventListener
// - cleanup on unmount
```

### 4. `src/web/hooks/useOnboarding.ts` — 온보딩 상태 관리

```ts
interface OnboardingState {
  step: 'persona' | 'chat' | 'company-name' | 'completed'
  persona: Persona | null
  messages: ChatMessage[]
  currentQuestions: Question[] | null
  suggestedCompanyName: string | null
  loading: boolean
}

interface ChatMessage {
  role: 'ceo' | 'user'
  content: string
}

interface Question {
  id: string
  text: string
  options: [string, string, string]
}

function useOnboarding(): {
  state: OnboardingState
  selectPersona: (persona: Persona) => Promise<void>
  submitAnswers: (answers: Answer[], wantMore: boolean) => Promise<void>
  confirmCompanyName: (name: string) => Promise<void>
}
```

- SSE로 `onboarding:question`, `onboarding:status` 이벤트 수신
- 질문 수신 시 `currentQuestions` 업데이트
- 회사명 확인 요청 수신 시 `suggestedCompanyName` 업데이트

### 5. `src/web/pages/OnboardingPage.tsx` — 온보딩 페이지

3단계 UI를 하나의 페이지 내에서 step으로 전환:

**Step 1: 페르소나 선택**
```
┌─────────────────────────────────────────┐
│          Choose Your CEO Style          │
│                                         │
│  ┌─────────┐  ┌─────────┐             │
│  │  Elon   │  │  Peter  │             │
│  │  Musk   │  │  Thiel  │             │
│  └─────────┘  └─────────┘             │
│  ┌─────────┐  ┌─────────┐             │
│  │  Steve  │  │  Bill   │             │
│  │  Jobs   │  │  Gates  │             │
│  └─────────┘  └─────────┘             │
└─────────────────────────────────────────┘
```

- 4개의 카드, 각각 이름 + 한 줄 설명
- 클릭 시 `selectPersona()` 호출 → Step 2로 전환
- 카드 스타일: 흰색 배경, 회색 테두리, hover시 테두리 색상 변화

**Step 2: CEO와 대화**
```
┌─────────────────────────────────────────┐
│  CEO Avatar + Name                      │
│─────────────────────────────────────────│
│                                         │
│  CEO: 우리 회사의 목표를 알려달라        │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 사용자 입력...                   │   │
│  └─────────────────────────────────┘   │
│                        [전송]           │
│                                         │
│  ─── 추가 질문 ───                      │
│  Q1: ...                                │
│    ○ a) ...                             │
│    ○ b) ...                             │
│    ○ c) ...                             │
│    ○ 기타: [직접 입력]                  │
│  Q2: ...                                │
│  Q3: ...                                │
│                                         │
│  [제출하고 바로 시작]  [질문 3개 더 받기] │
└─────────────────────────────────────────┘
```

- 처음에는 자유 입력 텍스트 필드만 표시
- CEO의 첫 메시지("우리 회사의 목표를 알려달라")는 프론트엔드에서 하드코딩
- 사용자가 입력하면 메시지 목록에 추가 + API 전송
- SSE로 추가 질문 수신 → 질문 UI 표시
- 각 질문: 라디오 버튼 3개 + "기타" 텍스트 입력
- 하단 버튼 2개: 제출하고 바로 시작 / 질문 3개 더 받기
- "질문 3개 더 받기" → 새 질문 수신 대기 → 반복

**Step 3: 회사명 확인**
```
┌─────────────────────────────────────────┐
│                                         │
│  "OOO" 으로 회사를 생성할까요?           │
│                                         │
│  [예, 이 이름으로]   [아니오, 직접 입력]  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ (직접 입력 시 활성화)            │   │
│  └─────────────────────────────────┘   │
│                        [확인]           │
└─────────────────────────────────────────┘
```

- SSE로 `suggestedCompanyName` 수신 시 이 화면 표시
- "예" → `confirmCompanyName(suggestedName)` → 대시보드로 전환
- "아니오" → 텍스트 입력 활성화 → 확인 클릭 → `confirmCompanyName(customName)`
- 회사명 확인 후 loading 표시 → 온보딩 완료 → `/dashboard`로 navigate

### 6. 컴포넌트 파일 구조

```
src/web/
├── pages/
│   ├── OnboardingPage.tsx
│   ├── DashboardPage.tsx    # placeholder: "Dashboard (Phase 10)"
│   └── ChatPage.tsx         # placeholder: "Chat (Phase 10)"
├── components/
│   ├── onboarding/
│   │   ├── PersonaCard.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── QuestionForm.tsx
│   │   └── CompanyNameConfirm.tsx
│   └── ui/
│       └── Button.tsx       # 공통 버튼 컴포넌트
├── hooks/
│   ├── useSSE.ts
│   └── useOnboarding.ts
├── lib/
│   └── api-client.ts
├── App.tsx
├── main.tsx
└── index.css
```

### 7. 스타일링

- Tailwind CSS 사용, 별도 CSS 파일 최소화
- 컬러: 회색 베이스 (gray-50 ~ gray-900), 포인트 컬러 최소
- 폰트: Tailwind 기본 시스템 폰트
- 레이아웃: 온보딩은 중앙 정렬, 최대 너비 640px
- 카드: `border border-gray-200 rounded-lg p-6`
- 버튼: `bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800`
- 보조 버튼: `border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50`

## Acceptance Criteria

```bash
npm run build  # Vite 빌드 에러 없음
npm test       # 기존 테스트 모두 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/14-auto-startup/index.json`의 phase 9 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `react-router-dom`은 이미 dependencies에 있어야 한다. 없다면 `npm install react-router-dom`으로 추가하라.
- `@tanstack/react-query`나 `zustand`는 이 phase에서 필요하지 않다. `useOnboarding` 훅이 로컬 상태로 충분하다. Phase 10에서 필요 시 추가.
- SSE EventSource의 URL은 `/api/events`다. Vite dev 모드에서 프록시를 통해 Hono 서버로 전달된다.
- CEO의 첫 메시지는 **프론트엔드에서 하드코딩**한다. MCP를 통해 올 필요 없다 — 페르소나 선택 직후 바로 표시.
- 온보딩 완료 후 `/dashboard`로 navigate할 때 `window.location.href`를 사용하라 (서버 재시작으로 인해 React Router의 navigate가 동작하지 않을 수 있음).
- 이전 phase의 테스트를 깨뜨리지 마라.
- 이모지를 사용하지 마라.
