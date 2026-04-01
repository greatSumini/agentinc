# auto-startup Web UI

## 기술 스택

- **React 18** + TypeScript
- **Vite** (빌드)
- **Tailwind CSS** (스타일링)
- **React Router v6** (라우팅)

## 라우팅

```
/ → RootRedirect (온보딩 여부로 분기)
    ├─ onboardingCompleted: true  → /dashboard
    └─ onboardingCompleted: false → /onboarding

/onboarding → OnboardingPage (Layout 없음)
/dashboard  → Layout > DashboardPage
/chat       → Layout > ChatPage
```

**RootRedirect 로직** (`src/web/App.tsx`):
```typescript
GET /api/onboarding/status
  → step === 'completed' ? /dashboard : /onboarding
```

## 온보딩 UI

### Step 1: 페르소나 선택

- 4개 카드 그리드 (2x2)
  - Elon Musk
  - Peter Thiel
  - Steve Jobs
  - Bill Gates
- 클릭으로 선택 → POST /api/onboarding/persona → Step 2로 전환

### Step 2: CEO 대화

- **CEO 첫 메시지**: "Tell me about your company goals." (하드코딩)
- **사용자 응답**: 자유 텍스트 입력 → SSE로 추가 질문 대기
- **추가 질문 3개**: a/b/c 선택지 + 기타(직접 입력)
- **버튼**:
  - [바로 시작] → `wantMoreQuestions: false` → Step 3
  - [질문 더 받기] → `wantMoreQuestions: true` → 추가 질문 3개

**SSE 이벤트**:
- `onboarding:question` — 질문 배열 수신
- `onboarding:status` — 단계 변경 알림

### Step 3: 회사명 확인

- "OOO으로 생성할까요?"
- **예** → POST /api/onboarding/company-name → 완료
- **아니오** → 직접 입력 모드

## 대시보드

### Layout

```
┌──────────────────────────────────────────────────┐
│  Sidebar (w-56)    │       Main Content          │
│  ┌──────────────┐  │                             │
│  │ Company Name │  │                             │
│  ├──────────────┤  │                             │
│  │ Talk to CEO  │  │                             │
│  ├──────────────┤  │                             │
│  │ Menu         │  │                             │
│  │  Dashboard   │  │                             │
│  └──────────────┘  │                             │
└──────────────────────────────────────────────────┘
```

### Sidebar

- **상단**: 회사명 (GET /api/config → company)
- **최상단 메뉴**: Talk to CEO 버튼 (→ /chat)
- **네비게이션**: Dashboard (현재 유일한 메뉴)

### AgentTable

| Name | Status | Description |
|------|--------|-------------|
| ceo  | idle   | 회사의 CEO... |

- **컬럼**: Name, Status, Description
- **상태 배지**:
  - `idle` — green (bg-green-100, text-green-700)
  - `working` — blue (bg-blue-100, text-blue-700)
  - `offline` — gray (bg-gray-100, text-gray-500)
- **데이터**: GET /api/agents → SSE로 실시간 업데이트

## Talk to CEO

- **채팅 인터페이스**
  - CEO 메시지: 좌측 정렬
  - 사용자 메시지: 우측 정렬
- **POST /api/chat** → Claude spawn → 응답
- **응답 대기 중**: "CEO is thinking..." + thinking dots animation
- **에러 표시**: 빨간 배경 박스

## 스타일 가이드

### 팔레트

- **배경**: gray-50 (전체), white (카드/테이블)
- **텍스트**: gray-900 (제목), gray-600 (본문), gray-500 (부제)
- **테두리**: gray-200
- **액센트**: gray-900 (버튼), gray-800 (hover)

### 타이포그래피

- **시스템 폰트** (Tailwind 기본)
- **제목**: text-lg ~ text-2xl, font-semibold
- **본문**: text-sm

### 컴포넌트

- **최소 그림자**: 모달/드롭다운만 shadow-sm 사용
- **둥근 모서리**: rounded-md (버튼), rounded-lg (카드)
- **패딩**: px-4 py-2 (버튼), p-6 ~ p-8 (컨테이너)

### 규칙

- **이모지 사용 금지**
- **Lucide React 아이콘** (필요 시)
- **모노크롬 팔레트 유지**

## 컴포넌트 구조

```
src/web/
├── App.tsx              # 라우팅 정의
├── main.tsx             # React 엔트리
├── pages/
│   ├── OnboardingPage.tsx
│   ├── DashboardPage.tsx
│   └── ChatPage.tsx
├── components/
│   ├── layout/
│   │   ├── Layout.tsx
│   │   └── Sidebar.tsx
│   ├── onboarding/
│   │   ├── PersonaCard.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── QuestionForm.tsx
│   │   └── CompanyNameConfirm.tsx
│   ├── dashboard/
│   │   ├── AgentTable.tsx
│   │   └── AgentStatusBadge.tsx
│   ├── chat/
│   │   ├── ChatMessage.tsx
│   │   └── ChatInput.tsx
│   └── ui/
│       └── Button.tsx
├── hooks/
│   ├── useOnboarding.ts  # 온보딩 상태 관리
│   ├── useAgents.ts      # 에이전트 목록 + SSE
│   ├── useChat.ts        # 채팅 상태 관리
│   └── useConfig.ts      # 설정 조회
└── lib/
    └── api-client.ts     # fetch 래퍼
```

## API 통신

### api-client.ts

```typescript
export async function get<T>(path: string): Promise<T>
export async function post<T>(path: string, body: unknown): Promise<T>
```

### SSE 이벤트 (GET /api/events)

```typescript
type EventType =
  | 'onboarding:question'   // 온보딩 질문
  | 'onboarding:status'     // 온보딩 상태 변경
  | 'ticket:created'        // 티켓 생성
  | 'ticket:updated'        // 티켓 업데이트
  | 'agent:status'          // 에이전트 상태 변경
```
