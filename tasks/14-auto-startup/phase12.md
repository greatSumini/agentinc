# Phase 12: Docs & Cleanup

## 사전 준비

먼저 아래 파일들을 읽고 현재 프로젝트 전체 구조를 파악하라:

- `CLAUDE.md` — 현재 프로젝트 지침 (agentinc 시절)
- `soul/project/insights.toml` — 프로젝트 인사이트
- `soul/project/gotchas.toml` — 프로젝트 gotchas
- `soul/ai/insights.toml` — AI 인사이트
- `scripts/` 디렉토리의 모든 파일 목록 확인
- `src/` 디렉토리의 전체 구조 확인

## 작업 내용

### 1. `CLAUDE.md` 갱신

현재 `CLAUDE.md`는 agentinc 시절의 내용이다. auto-startup에 맞게 전면 갱신:

```markdown
# auto-startup

CLI 도구로, 실행 시 로컬 웹 서버를 띄워 AI 에이전트 기반의 "회사"를 운영한다.

## Architecture

```
src/
├── core/           # 비즈니스 로직 (타입, 스토어, 서비스)
├── server/         # Hono API 서버 (온보딩 / 노멀 모드 분리)
├── claude-runner/  # Claude CLI spawn (flag-builder, env-builder, spawner)
├── daemon/         # 에이전트 워커 (orchestrator + agent-worker)
├── mcp/            # MCP stdio 서버 (온보딩용 / 에이전트용)
├── templates/      # 프롬프트 템플릿 (페르소나, context-engineer)
├── cli/            # CLI 진입점 (auto-startup 명령어)
└── web/            # React 프론트엔드 (Vite + Tailwind)
```

## 실행 흐름

1. `auto-startup` 실행 → 온보딩 완료 여부 확인
2. 미완료: 온보딩 서버 시작 → CEO 에이전트와 대화 → 회사 생성 → 서버 종료
3. 완료: 대시보드 서버 + daemon 시작 → 에이전트 워커 폴링

## 데이터 저장

실행루트경로(사용자가 auto-startup을 실행한 디렉토리) 기준:

- `.auto-startup/` — 내부 상태 (config, agents, tickets)
- `principles/` — 회사 원칙 (goal.md, business.md)
- `CLAUDE.md` — 원칙 참조 (auto-startup이 생성)
- `.claude/settings.json` — SessionEnd hook

## 개발

```bash
npm run dev        # 서버 직접 실행 (tsx)
npm run dev:web    # Vite dev 서버 (프론트엔드만)
npm run build      # 프로덕션 빌드
npm test           # 테스트 실행
```

## soul/ 디렉토리

AI 인사이트/gotchas 기록. 자세한 내용은 루트 CLAUDE.md의 soul 관련 지침 참조.

## 테스트

- vitest 사용
- 순수 로직만 테스트 (flag-builder, store, service, frontmatter)
- mock 최소화, 실제 fs 테스트 선호
- E2E/CLI/UI 테스트 없음
```

**중요**: 기존 `CLAUDE.md`의 "Who You Are" 섹션(개발자 가치관)과 soul/ 관련 지침은 **그대로 유지**하라. 아키텍처/설계 관련 내용만 위 내용으로 교체.

### 2. `soul/project/insights.toml` 업데이트

기존 agentinc 관련 인사이트 중 더 이상 유효하지 않은 것들을 갱신하라. 예:
- "모노레포 구조" → "단일 패키지 (Vite + Hono)"
- "공유 리소스 풀" → "per-agent 리소스"
- "3개 기본 에이전트 (developer, designer, hr)" → "CEO 에이전트 + context-engineer 서브에이전트"
- 새 인사이트 추가: auto-startup 전환의 핵심 가치 (온보딩 → 원칙 → 에이전트 운영)

기존 항목의 `id`는 유지하고 `content`와 `last_used_at`을 업데이트. 완전히 무효한 항목은 삭제.

### 3. 불필요한 scripts 정리

`scripts/` 디렉토리에서 더 이상 필요 없는 파일 확인:
- `release.py` — npm release 용. 패키지명이 바뀌었으므로 내부 참조 업데이트 필요. 지금 당장 필요하지 않으면 삭제.
- `gen-spec-diff.py` — spec/ 삭제로 무의미. 삭제.
- `soul-manager.py` — soul/ TOML 관리. 여전히 유효하면 유지.
- `create-pr.py` — PR 생성. 유지.
- `run-phases.py` — Phase 0에서 이미 수정됨. 유지.
- `_utils.py` — 공통 유틸. 유지.

삭제 대상이 아닌 파일에서 `agentinc` 참조가 있으면 `auto-startup`으로 변경.

### 4. `run-phases.py`에서 spec-diff 참조 제거

`run-phases.py`에서 `gen-spec-diff.py` 호출 부분이 있는지 확인하라. 있다면 제거하라 (`gen-spec-diff.py`를 삭제했으므로).

### 5. `.gitignore` 최종 확인

다음이 포함되어 있는지 확인:
```
node_modules/
dist/
.auto-startup/.pid
.auto-startup/.tmp/
*.log
```

## Acceptance Criteria

```bash
npm run build  # 빌드 에러 없음
npm test       # 모든 테스트 통과

# CLAUDE.md에 새 아키텍처 정보 포함 확인
grep -q "auto-startup" CLAUDE.md && echo "PASS" || echo "FAIL"
grep -q "Hono" CLAUDE.md && echo "PASS" || echo "FAIL"

# 삭제 대상 파일이 없는지 확인
test ! -f scripts/gen-spec-diff.py && echo "PASS" || echo "FAIL"
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/14-auto-startup/index.json`의 phase 12 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `CLAUDE.md`의 "Who You Are" 섹션, soul/ 관련 지침, 개발자 가치관 부분은 **절대 삭제하지 마라**.
- soul/master/ 인사이트는 사용자 개인 정보이므로 수정하지 마라.
- soul/ai/ 인사이트는 현재 내용을 읽고, auto-startup 맥락에서 유효한지 확인 후 필요 시 갱신.
- `scripts/create-pr.py`는 유지하되, 내부에서 `agentinc`을 참조하는 부분이 있으면 `auto-startup`으로 변경.
- 이 phase가 마지막이므로, 전체 빌드 + 테스트가 깨끗하게 통과하는지 최종 확인하라.
