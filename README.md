# auto-startup

AI 에이전트 기반의 "회사"를 로컬에서 운영하는 CLI 도구. 목표와 원칙만 제시하면, AI CEO가 에이전트를 관리하고 업무를 할당한다.

## Quick Start

```bash
npx auto-startup
```

또는 글로벌 설치:

```bash
npm install -g auto-startup
auto-startup
```

## How It Works

1. **CEO 선택** — 일론 머스크, 피터 틸, 스티브 잡스, 빌 게이츠 중 CEO 페르소나를 고른다
2. **온보딩** — CEO가 회사의 목표와 가치를 질문한다
3. **회사 생성** — 답변을 기반으로 `principles/` 문서를 생성한다
4. **운영** — 대시보드에서 에이전트 상태를 확인하고, CEO와 대화하며 업무를 지시한다

## Architecture

- **Hono** — 로컬 API 서버
- **Vite + React** — 웹 대시보드
- **Claude Code** — AI 에이전트 실행
- **MCP** — CEO와 웹 UI 양방향 통신

## 생성되는 파일

```
your-project/
├── principles/
│   ├── goal.md          # 회사의 존재 이유
│   └── business.md      # 핵심 가치
├── CLAUDE.md            # 원칙 참조
├── .claude/settings.json # 세션 hooks
└── .auto-startup/       # 내부 상태
```

## Development

```bash
npm install
npm run dev        # 서버 직접 실행
npm run dev:web    # Vite dev 서버 (프론트엔드)
npm run build      # 프로덕션 빌드
npm test           # 테스트
```

## Requirements

- Node.js 18+
- [Claude Code](https://claude.ai/code) CLI 설치 및 인증

## License

MIT
