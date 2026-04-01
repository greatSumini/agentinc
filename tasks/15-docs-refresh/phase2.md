# Phase 2: README.md 재작성

## 사전 준비

먼저 아래 파일들을 읽어라:

- `CLAUDE.md` — 프로젝트 아키텍처 개요
- `package.json` — 패키지 정보 (name, version, scripts)
- `spec/spec.md` — Phase 1에서 생성된 핵심 스펙
- `src/cli/index.ts` — CLI 진입점 (실행 흐름)
- `README.md` — 현재 내용 (agentinc 구버전)

## 작업 내용

### `README.md` 전면 재작성

현재 README는 agentinc 시절 내용이다. auto-startup에 맞게 전면 교체하라.

다음 구조로 작성:

```markdown
# auto-startup

AI 에이전트 기반의 "회사"를 로컬에서 운영하는 CLI 도구. 목표와 원칙만 제시하면, AI CEO가 에이전트를 관리하고 업무를 할당한다.

## Quick Start

\`\`\`bash
npx auto-startup
\`\`\`

또는 글로벌 설치:

\`\`\`bash
npm install -g auto-startup
auto-startup
\`\`\`

## How It Works

1. **CEO 선택** — 일론 머스크, 피터 틸, 스티브 잡스, 빌 게이츠 중 CEO 페르소나를 고른다
2. **온보딩** — CEO가 회사의 목표와 가치를 질문한다
3. **회사 생성** — 답변을 기반으로 `principles/` 문서를 생성한다
4. **운영** — 대시보드에서 에이전트 상태를 확인하고, CEO와 대화하며 업무를 지시한다

## Architecture

- **Hono** — 로컬 API 서버
- **Vite + React** — 웹 대시보드
- **Claude Code** — AI 에이전트 실행
- **MCP** — CEO ↔ 웹 UI 양방향 통신

## 생성되는 파일

\`\`\`
your-project/
├── principles/
│   ├── goal.md          # 회사의 존재 이유
│   └── business.md      # 핵심 가치
├── CLAUDE.md            # 원칙 참조
├── .claude/settings.json # 세션 hooks
└── .auto-startup/       # 내부 상태
\`\`\`

## Development

\`\`\`bash
npm install
npm run dev        # 서버 직접 실행
npm run dev:web    # Vite dev 서버 (프론트엔드)
npm run build      # 프로덕션 빌드
npm test           # 테스트
\`\`\`

## Requirements

- Node.js 18+
- [Claude Code](https://claude.ai/code) CLI 설치 및 인증

## License

MIT
```

**주의**: 위 템플릿은 가이드다. `package.json`의 실제 scripts와 `src/cli/index.ts`의 실제 실행 흐름을 확인하고, 사실과 다른 부분이 있으면 코드 기준으로 수정하라.

배지(npm, license 등)는 넣지 마라. 배너 이미지도 제거하라.

## Acceptance Criteria

```bash
# README 존재 + 핵심 내용 포함
grep -q "auto-startup" README.md && echo "PASS" || echo "FAIL"
grep -q "agentinc" README.md && echo "FAIL: stale reference" || echo "PASS: no stale refs"
grep -q "Quick Start" README.md && echo "PASS" || echo "FAIL"

# 빌드/테스트
npm run build
npm test
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/15-docs-refresh/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- README에 agentinc 참조가 남아있으면 안 된다.
- 배지, 배너 이미지 제거. 텍스트 중심의 간결한 README.
- `npx auto-startup`이 실제로 동작하려면 npm에 publish되어야 하지만, README에는 이렇게 적는 것이 표준이다.
- `## Requirements` 섹션에 Claude Code CLI 필요성을 명시하라 — 이 도구는 Claude Code에 의존적이다.
- 이모지 사용하지 마라.
