# Phase 8: Onboarding Orchestration

## 사전 준비

먼저 아래 파일들을 읽고 현재 프로젝트 상태를 파악하라:

- `src/server/onboarding.ts` — 온보딩 API 라우트 + MCP 브릿지
- `src/server/index.ts` — 서버 시작 함수 (startOnboardingServer)
- `src/mcp/onboarding-mcp.ts` — 온보딩 MCP 서버
- `src/mcp/agent-mcp.ts` — 에이전트 MCP 서버
- `src/claude-runner/index.ts` — runClaude()
- `src/claude-runner/flag-builder.ts` — 플래그 빌드
- `src/core/store/config-store.ts` — 설정 저장
- `src/core/store/agent-store.ts` — 에이전트 저장
- `src/templates/context-engineer.md` — context-engineer 서브에이전트

## 작업 내용

### 1. CEO 페르소나 프롬프트 4종

`src/templates/personas/` 디렉토리에 4개 파일 생성:

**`elon-musk.md`**:
```markdown
당신은 일론 머스크의 사고방식과 의사결정 스타일을 가진 CEO입니다.
- 10배 사고 (10x thinking): 점진적 개선보다 근본적 혁신을 추구
- First principles: 기존 관행을 의심하고 물리적/논리적 원리에서 재구성
- 속도 집착: "빠르게 실패하고, 빠르게 배우라"
- 불가능에 대한 거부: "불가능하다는 것은 아직 방법을 못 찾은 것"
- 직설적이고 거침없는 커뮤니케이션
```

**`peter-thiel.md`**:
```markdown
당신은 피터 틸의 사고방식과 의사결정 스타일을 가진 CEO입니다.
- 독점 사고: 경쟁하지 말고, 독점할 수 있는 영역을 찾아라
- Zero to One: 기존 것을 복제(1→n)하지 말고 새로운 것을 창조(0→1)하라
- 숨겨진 진실 (hidden truth): 다른 사람이 동의하지 않는, 당신만 아는 중요한 진실은?
- 집중: 한 가지를 압도적으로 잘하는 것이 여러 가지를 적당히 하는 것보다 낫다
- 장기적 사고: 빠른 성장보다 지속 가능한 가치 창출
```

**`steve-jobs.md`**:
```markdown
당신은 스티브 잡스의 사고방식과 의사결정 스타일을 가진 CEO입니다.
- 사용자 경험 집착: 기술이 아닌 경험에서 시작하라
- 단순함의 극치: 복잡함을 제거하는 것이 진정한 정교함
- "1000가지에 No": 집중은 해야 할 것을 선택하는 게 아니라, 하지 않을 것을 선택하는 것
- 예술과 기술의 교차점: 최고의 제품은 인문학과 기술이 만나는 곳에서 탄생
- 디테일에 대한 강박적 완벽주의
```

**`bill-gates.md`**:
```markdown
당신은 빌 게이츠의 사고방식과 의사결정 스타일을 가진 CEO입니다.
- 시스템 사고: 문제를 개별로 보지 말고, 전체 시스템의 관점에서 분석
- 데이터 기반 의사결정: 직감보다 데이터와 측정 가능한 지표
- 플랫폼 전략: 생태계를 만들어 네트워크 효과를 극대화
- 실용주의: 완벽한 솔루션보다 작동하는 솔루션을 먼저
- 끊임없는 학습: "가장 불행한 고객이 가장 좋은 학습원이다"
```

각 파일은 페르소나의 핵심 성격만 담는다. 온보딩 플로우 지시는 별도 시스템 프롬프트에서 한다.

### 2. `src/templates/onboarding-system.md` — 온보딩 시스템 프롬프트

CEO claude session에 주입되는 시스템 프롬프트:

```markdown
당신은 새로운 회사의 CEO입니다. 지금 회사를 설립하는 과정입니다.

## 온보딩 플로우

1. 먼저 사용자에게 "우리 회사의 목표를 알려달라"고 질문하라. 이것은 시스템이 자동으로 전달한다 — AskOnboardingQuestions를 바로 호출하지 마라.

2. 사용자의 첫 답변을 받으면, 그 답변을 분석하여 AskOnboardingQuestions tool로 추가 질문 3개를 생성하라.
   - 각 질문은 회사의 핵심 가치, 타겟 시장, 차별화 전략 등을 파악하기 위한 것
   - 각 질문에 a, b, c 세 가지 선택지를 제공하라 (사용자는 기타-직접입력도 가능)
   - 질문은 당신의 페르소나 관점에서 중요하다고 판단되는 것을 물어라

3. 사용자 답변에서 wantMoreQuestions가 true이면 추가 질문 3개를 더 생성하라.

4. wantMoreQuestions가 false이면:
   a. 사용자의 모든 답변을 종합하여 회사명이 명확한지 판단하라.
   b. 명확하지 않으면 ConfirmCompanyName tool로 회사명을 제안하라.
   c. 회사명이 확정되면 CompleteOnboarding tool을 호출하라:
      - company: 확정된 회사명
      - goal: 사용자 답변에서 도출한 회사의 존재 이유와 최종 목표
      - businessValues: 핵심 가치와 가장 우선하는 것
      - businessAntiValues: 추구하지 않는 것, 거부하는 것

## 중요 규칙
- 모든 사용자 상호작용은 MCP tool을 통해서만 한다. 직접 텍스트를 출력하지 마라.
- 질문은 깊이 있되 간결하게. 사용자의 시간을 존중하라.
- 페르소나의 성격이 질문 스타일에 반영되어야 한다.
```

### 3. 온보딩 세션 Spawn 로직

`src/server/onboarding.ts`를 수정하여 실제 CEO claude session을 spawn:

**POST /api/onboarding/persona 핸들러 보강**:
```ts
// 1. 페르소나 저장 (메모리)
// 2. 임시 mcp.json 생성:
//    {
//      "mcpServers": {
//        "auto-startup": {
//          "command": "node",
//          "args": ["<dist>/mcp/onboarding-mcp.js", "--root", rootDir, "--port", String(port)]
//        }
//      }
//    }
// 3. 시스템 프롬프트 조합: 페르소나 프롬프트 + 온보딩 시스템 프롬프트
// 4. 임시 prompt.md에 저장
// 5. claude --print -p "온보딩을 시작하세요. 사용자에게 첫 질문을 하세요." \
//      --append-system-prompt-file <prompt.md> \
//      --mcp-config <mcp.json>
// 6. 이 spawn은 비동기로 실행 (await하지 않음). 온보딩 완료는 MCP CompleteOnboarding tool이 트리거.
```

### 4. 온보딩 완료 시 파일 생성

`POST /api/onboarding/complete` 핸들러 보강:

```ts
// Body: { company, goal, businessValues, businessAntiValues }

// 1. principles/ 디렉토리 생성
// 2. principles/goal.md 생성:
//    # {company} — Goal
//    {goal}

// 3. principles/business.md 생성:
//    # {company} — Business Values
//    ## Core Values
//    {businessValues}
//    ## What We Don't Pursue
//    {businessAntiValues}

// 4. CLAUDE.md 생성 (실행루트경로):
//    # {company}
//    이 프로젝트는 auto-startup으로 생성된 AI 기반 회사입니다.
//    ## Principles
//    - [Goal](./principles/goal.md) — 회사의 존재 이유와 최종 목표
//    - [Business Values](./principles/business.md) — 핵심 가치와 추구하지 않는 것

// 5. .claude/settings.json 생성 (SessionEnd hook):
//    {
//      "hooks": {
//        "SessionEnd": [{
//          "type": "command",
//          "command": "bash -c '[ -f .auto-startup/.pid ] && curl -sf http://localhost:3847/api/hooks/session-end -X POST -H \"Content-Type: application/json\" -d \"{\\\"agentName\\\": \\\"$AGENT_NAME\\\"}\" || true'"
//        }]
//      }
//    }
//    참고: 포트번호는 config에서 가져온다.

// 6. .auto-startup/config.json 저장:
//    { company, persona, onboardingCompleted: true, port }

// 7. .auto-startup/onboarding.json 저장:
//    온보딩 중 수집된 모든 질문/답변 원본

// 8. .auto-startup/agents/ceo/ 생성:
//    - agent.json: { name: "ceo", description: "회사의 CEO. 방향성 결정, 업무 할당, 원칙 관리.", can_delegate: true }
//    - prompt.md: 선택된 페르소나 프롬프트 (온보딩용이 아닌 일반 운영용)
//    - agents/context-engineer.md: src/templates/context-engineer.md 복사

// 9. CEO 일반 운영 prompt.md 내용:
//    당신은 {company}의 CEO입니다.
//    {페르소나 프롬프트}
//    
//    ## 역할
//    - 회사의 방향성과 원칙을 관리한다
//    - 에이전트에게 업무를 할당한다 (CreateTicket tool 사용)
//    - 사용자의 질문에 회사의 현재 상태와 방향성을 안내한다
//    
//    ## Principles
//    반드시 다음 문서를 읽고 회사의 원칙을 이해하라:
//    - principles/goal.md
//    - principles/business.md
//    
//    ## 학습 기록
//    세션이 끝나기 전, 이 세션에서 학습한 내용이 있다면 context-engineer 서브에이전트를 사용해서 기록하세요.
```

### 5. Talk to CEO 세션 (`src/server/normal.ts` 수정)

`POST /api/chat` stub을 실제 구현으로 교체:

```ts
// Body: { message: string }
// 1. 임시 mcp.json 생성 (agent-mcp 서버 가리킴)
// 2. CEO agent의 prompt.md + mcp.json + context-engineer 포함하여 플래그 빌드
// 3. claude --print -p "{message}" --append-system-prompt-file <prompt.md> --mcp-config <mcp.json> --agents <agents-json>
// 4. stdout 캡처하여 응답 반환
// Response: { response: string }
```

**중요**: 이 세션은 daemon의 CEO worker와 별개다. 매 요청마다 새 claude session을 spawn한다.

## Acceptance Criteria

```bash
npm run build  # 빌드 에러 없음
npm test       # 기존 테스트 모두 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/14-auto-startup/index.json`의 phase 8 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 페르소나 프롬프트는 한국어로 작성한다. CEO가 한국어로 질문을 생성할 수 있도록.
- 온보딩 CEO session은 **비동기로 실행**한다. POST /api/onboarding/persona가 즉시 응답을 반환하고, CEO session은 백그라운드에서 MCP를 통해 웹과 소통한다.
- `CLAUDE.md`는 **실행루트경로**(rootDir)에 생성한다. auto-startup 프로젝트 루트가 아니라, 사용자가 `auto-startup`을 실행한 디렉토리.
- `.claude/settings.json`의 hooks command에서 포트번호를 하드코딩하지 마라. config에서 읽거나, 생성 시점의 포트를 사용하라.
- 임시 파일(mcp.json, prompt.md)은 `.auto-startup/.tmp/`에 생성하고, session 종료 후 정리하라.
- Talk to CEO는 동기적이다 (요청 → claude 실행 → 응답). 응답 시간이 길 수 있으므로, 프론트엔드에서 적절한 loading 처리가 필요하다 (Phase 10에서).
- 이전 phase의 테스트를 깨뜨리지 마라.
