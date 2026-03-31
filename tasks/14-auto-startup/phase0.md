# Phase 0: Cleanup

## 사전 준비

이 프로젝트는 `agentinc`라는 이름의 모노레포(pnpm workspace)였다. 이번 task에서 `auto-startup`이라는 완전히 새로운 구조로 전환한다. 이 phase에서는 더 이상 필요 없는 코드와 설정을 제거한다.

**주의**: 삭제 전에 git status로 uncommitted changes가 없는지 확인하라. 있다면 먼저 커밋하라.

## 작업 내용

### 1. 삭제 대상

다음 디렉토리/파일을 전부 삭제하라:

- `packages/` — 모노레포 패키지 전체 (cli, core, server, web)
- `spec/` — 기존 설계 문서 전체
- `.agentinc/` — 기존 로컬 에이전트 스토어
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `package.json` (루트)
- `tsconfig.json` (루트)
- `.npmrc` (있다면)

### 2. 유지 대상

다음은 **절대 삭제하지 마라**:

- `soul/` — AI/프로젝트 인사이트
- `scripts/` — run-phases.py 등 유틸리티
- `tasks/` — 태스크 기록
- `prompts/` — 프롬프트 템플릿
- `.claude/` — Claude Code 설정
- `.git/` — Git 히스토리
- `CLAUDE.md` — 프로젝트 지침
- `.gitignore`

### 3. `scripts/run-phases.py` 수정

파일을 열어 다음을 변경하라:

- `build_preamble()` 함수의 기본 project_name이 `"agentinc"`로 되어있다면 무관 — index.json의 `project` 필드에서 읽으므로 변경 불필요.
- 하지만 헤더 출력 부분의 `"agentinc Phase Runner"` 문자열을 `"auto-startup Phase Runner"`로 변경하라.
- `git_commit_docs()` 함수에서 `git_run("add", "tasks/", "spec/", "prompts/")`의 `"spec/"` 부분을 제거하라 — spec 디렉토리는 더 이상 존재하지 않는다. `git_run("add", "tasks/", "prompts/")`로 변경.

### 4. `.gitignore` 정리

`.gitignore`에서 `packages/*/dist/` 같은 모노레포 관련 패턴이 있다면 제거하고, 다음을 추가하라:

```
# Build output
dist/

# Dependencies
node_modules/

# Environment
.env
.env.local

# Auto-startup runtime
.auto-startup/.pid
```

## Acceptance Criteria

```bash
# 삭제 확인
test ! -d packages && test ! -d spec && test ! -f pnpm-workspace.yaml && echo "PASS" || echo "FAIL"

# 유지 확인
test -d soul && test -d scripts && test -d tasks && test -f CLAUDE.md && echo "PASS" || echo "FAIL"

# run-phases.py 수정 확인
grep -q "auto-startup Phase Runner" scripts/run-phases.py && echo "PASS" || echo "FAIL"
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 PASS이면 `/tasks/14-auto-startup/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `soul/` 디렉토리를 절대 삭제하지 마라. 프로젝트의 핵심 인사이트가 담겨 있다.
- `scripts/` 내의 다른 파일(`create-pr.py`, `_utils.py` 등)은 수정하지 마라. 이후 phase에서 필요 시 수정한다.
- 이 phase에서는 새 파일을 생성하지 마라. 삭제와 최소 수정만 한다.
