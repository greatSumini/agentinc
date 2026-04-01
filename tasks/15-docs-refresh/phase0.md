# Phase 0: Cleanup & Scattered Reference Fixes

## 사전 준비

이 프로젝트는 `agentinc`에서 `auto-startup`으로 전환 완료된 상태다. 그러나 일부 파일에 구버전 참조가 남아있고, 무효화된 문서들이 존재한다. 이 phase에서 전부 정리한다.

프로젝트 구조를 파악하려면 다음 파일을 읽어라:
- `CLAUDE.md` — 현재 프로젝트 아키텍처 개요
- `package.json` — 패키지 정보

## 작업 내용

### 1. `docs/` 디렉토리 전체 삭제

다음 파일들이 존재한다면 전부 삭제하라:
- `docs/cli-reference.md`
- `docs/configuration.md`
- `docs/daemon-mode.md`
- `docs/getting-started.md`
- `docs/release.md`
- `docs/webhook-integration.md`

`docs/` 디렉토리 자체도 삭제하라.

### 2. 무효 prompts 삭제

다음 파일/디렉토리를 삭제하라:
- `prompts/init.md` — agentinc 초기 기획 프롬프트 (무효)
- `prompts/new-feature.md` — agentinc CLI 기반 기능 추가 프롬프트 (무효)
- `prompts/dave/` — 디렉토리 전체 삭제 (agentinc CLI 사용 프롬프트)

다음은 **유지**하라:
- `prompts/task-create.md` — task 생성 형식 (여전히 유효)
- `prompts/release-notes.md` — 릴리즈 노트 템플릿 (유지하되 agentinc 참조 있으면 수정)

### 3. `LICENSE` 수정

`Copyright (c) 2026 agentinc`를 `Copyright (c) 2026 auto-startup`으로 변경하라.

### 4. `tasks/index.json` 수정

`"repositoryUrl": "https://github.com/greatSumini/agentinc"`를 `"repositoryUrl": "https://github.com/vibemafiaclub/auto-startup"`로 변경하라.

### 5. `.claude/skills/release/SKILL.md` 수정

파일 내에서 `agentinc` 문자열을 모두 `auto-startup`으로 교체하라.

### 6. `prompts/release-notes.md` 확인

파일을 읽고 `agentinc` 참조가 있으면 `auto-startup`으로 교체하라. 없으면 수정 불필요.

### 7. `spec/external/` 복원

git history에서 3개 파일을 복원하라:

```bash
git show 5186e1a~1:spec/external/claude-code-cli.md > spec/external/claude-code-cli.md
git show 5186e1a~1:spec/external/claude-code-hooks-lifecycle.md > spec/external/claude-code-hooks-lifecycle.md
git show 5186e1a~1:spec/external/claude-skills-framework.md > spec/external/claude-skills-framework.md
```

`spec/external/` 디렉토리가 없으면 먼저 생성하라.

### 8. 최종 agentinc 참조 스캔

프로젝트 전체에서 `agentinc` 문자열을 검색하라 (소스코드, 설정파일 대상. tasks/ 하위의 역사적 기록은 무시):

```bash
grep -r "agentinc" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.toml" --include="*.py" . | grep -v node_modules | grep -v dist | grep -v "tasks/" | grep -v ".git/"
```

발견되면 `auto-startup`으로 교체하라. 단, `tasks/` 디렉토리 내의 과거 기록(이전 task의 phase 파일, output 파일 등)은 역사적 기록이므로 수정하지 마라.

## Acceptance Criteria

```bash
# 삭제 확인
test ! -d docs && echo "PASS" || echo "FAIL"
test ! -f prompts/init.md && echo "PASS" || echo "FAIL"
test ! -d prompts/dave && echo "PASS" || echo "FAIL"

# 복원 확인
test -f spec/external/claude-code-cli.md && echo "PASS" || echo "FAIL"
test -f spec/external/claude-code-hooks-lifecycle.md && echo "PASS" || echo "FAIL"
test -f spec/external/claude-skills-framework.md && echo "PASS" || echo "FAIL"

# agentinc 참조 없음 확인 (tasks/ 제외)
grep -r "agentinc" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.toml" --include="*.py" . | grep -v node_modules | grep -v dist | grep -v "tasks/" | grep -v ".git/" | wc -l | xargs test 0 -eq && echo "PASS" || echo "FAIL"

# 빌드/테스트
npm run build
npm test
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/15-docs-refresh/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `tasks/` 하위 파일의 agentinc 참조는 역사적 기록이므로 수정하지 마라.
- `soul/` 디렉토리 내 TOML 파일도 확인하되, 이미 갱신되었을 수 있다. 중복 수정하지 마라.
- `prompts/task-create.md`는 삭제하지 마라. 현재 task 시스템에서 사용 중이다.
- `spec/external/` 파일들은 git history에서 복원하는 것이므로 내용을 수정하지 마라.
