# Phase 4: Claude Runner

## 사전 준비

먼저 아래 파일들을 읽고 현재 프로젝트 상태를 파악하라:

- `src/core/types.ts` — AgentConfig, SubagentConfig 타입
- `src/core/store/agent-store.ts` — 에이전트 스토어 API (getAgentSubagents, getAgentHooks 등)
- `src/core/utils/frontmatter.ts` — frontmatter 파싱

기존 구현을 참조하려면 다음 git 명령어를 사용하라:
- `git show HEAD~3:packages/cli/src/claude-runner/flag-builder.ts` — 기존 플래그 빌더
- `git show HEAD~3:packages/cli/src/claude-runner/env-builder.ts` — 기존 환경변수 빌더
- `git show HEAD~3:packages/cli/src/claude-runner/spawner.ts` — 기존 스포너
- `git show HEAD~3:packages/cli/tests/claude-runner/flag-builder.test.ts` — 기존 테스트
- `git show HEAD~3:packages/cli/tests/claude-runner/env-builder.test.ts` — 기존 테스트

## 작업 내용

### 1. `src/claude-runner/flag-builder.ts`

에이전트 설정을 Claude CLI 플래그 배열로 변환:

```ts
interface BuildFlagsParams {
  rootDir: string
  agentName: string
  prompt?: string      // 있으면 -p 모드
  printMode?: boolean  // true면 --print 추가
  passthroughFlags?: string[]
}

buildFlags(params: BuildFlagsParams): string[]
```

**플래그 빌드 로직**:

1. **System prompt**: `--append-system-prompt-file .auto-startup/agents/<name>/prompt.md`
   - prompt.md가 존재할 때만 추가

2. **Sub-agents** (agents/ 디렉토리):
   - `getAgentSubagents(rootDir, agentName)`으로 조회
   - **context-engineer 자동 포함**: agents/ 디렉토리에 context-engineer.md가 없더라도, 내장 context-engineer 정의를 항상 추가
   - `--agents` JSON 문자열로 변환:
     ```json
     {"context-engineer":{"name":"context-engineer","description":"...","prompt":"..."},"other-agent":{...}}
     ```

3. **Skills** (skills/ 디렉토리):
   - `listAgentSkillDirs(rootDir, agentName)`으로 조회
   - skills가 있으면 임시 디렉토리에 복사하고 `--add-dir` 추가
   - 임시 디렉토리: `.auto-startup/.tmp/run-<uuid>/.claude/skills/`

4. **Hooks**: 
   - `getAgentHooks(rootDir, agentName)`으로 hooks.json 조회
   - 있으면 임시 settings.json을 생성하고 `--settings <path>` 추가

5. **MCP config**:
   - `.auto-startup/agents/<name>/mcp.json` 존재 시 `--mcp-config <path>` 추가

6. **Print mode**: `printMode`이 true면 `--print` 추가

7. **Prompt**: `prompt`이 있으면 `"-p"`, `prompt` 추가

8. **Passthrough**: `passthroughFlags` 그대로 append

### 2. `src/claude-runner/env-builder.ts`

에이전트의 gh_user로 GitHub 환경변수 생성:

```ts
interface GithubProfile {
  token: string
  name: string
  email: string
}

// 15분 캐시
const cache: Map<string, { profile: GithubProfile; expiresAt: number }> = new Map()

async function resolveGithubProfile(ghUser: string): Promise<GithubProfile>
// - 캐시 확인 (만료 안 됐으면 반환)
// - `gh auth token --user <ghUser>` 실행 → token
// - `gh api /user --jq .name` (GH_TOKEN 주입) → name
// - `gh api /user --jq .email` (GH_TOKEN 주입) → email
// - 캐시 저장 (15분 TTL)

async function buildEnv(ghUser?: string): Promise<Record<string, string>>
// - ghUser 없으면 빈 object 반환
// - resolveGithubProfile 호출
// - { GH_TOKEN, GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL } 반환
```

### 3. `src/claude-runner/spawner.ts`

Claude CLI 프로세스 spawn:

```ts
interface SpawnResult {
  exitCode: number
  stdout: string
  stderr: string
}

async function spawnClaude(flags: string[], env: Record<string, string>, options?: {
  cwd?: string
  stdio?: 'inherit' | 'pipe'
}): Promise<SpawnResult>
// - child_process.spawn("claude", flags, { env: { ...process.env, ...env }, stdio, cwd })
// - stdio='pipe'면 stdout/stderr 수집 후 반환
// - stdio='inherit'면 stdout/stderr는 빈 문자열
// - Promise로 프로세스 종료 대기
```

### 4. `src/claude-runner/index.ts` — 통합 함수

```ts
async function runClaude(params: {
  rootDir: string
  agentName: string
  prompt?: string
  printMode?: boolean
  passthroughFlags?: string[]
}): Promise<SpawnResult>
// - agent-store에서 agent 조회
// - buildFlags() → 플래그 빌드
// - buildEnv(agent.gh_user) → 환경변수
// - spawnClaude() → 실행
// - 임시 디렉토리 정리 (finally)
```

### 5. `src/templates/context-engineer.md` — context-engineer 서브에이전트 정의

```markdown
---
name: context-engineer
description: 에이전트의 skill, sub-agent, hooks를 생성하고 관리하는 전문가. 세션에서 학습한 프로세스, 도구 사용법, 반복 패턴을 기록한다.
model: sonnet
tools: Read, Write, Edit, Glob, Grep, Bash
---

당신은 context-engineer입니다. 에이전트의 컨텍스트(skill, sub-agent, hooks)를 관리합니다.

## 핵심 규칙

1. **경로 제한**: 모든 파일은 반드시 `.auto-startup/agents/<현재에이전트명>/` 하위에만 생성하라.
   - sub-agent: `.auto-startup/agents/<에이전트>/agents/<이름>.md`
   - skill: `.auto-startup/agents/<에이전트>/skills/<이름>/SKILL.md`
   - hooks: `.auto-startup/agents/<에이전트>/hooks.json`

2. **hooks.json 형식**: Claude Code의 settings.json hooks 형식을 따른다.
   - 기존 hooks.json이 있으면 읽어서 기존 항목을 유지하며 추가한다.
   - 이미 동일한 이벤트 타입에 핸들러가 존재하면, 그 사실을 보고하고 에이전트의 판단에 맡긴다.

3. **sub-agent 형식**: YAML frontmatter + markdown body.
   ```
   ---
   name: <이름>
   description: <설명>
   model: sonnet
   ---
   <프롬프트>
   ```

4. **기록 대상**: 세션에서 반복적으로 사용한 프로세스, 외부 도구 사용법, 특정 도메인 지식 등 향후 재사용 가치가 있는 것들.
```

이 파일은 `src/templates/context-engineer.md`에 위치하며, flag-builder가 빌드 시 이 내용을 읽어 context-engineer sub-agent로 자동 포함한다.

### 6. 테스트 작성

**`tests/claude-runner/flag-builder.test.ts`**:
- 기존 테스트 참조하여 포팅, per-agent 경로 구조에 맞게 수정
- prompt.md 있을 때 `--append-system-prompt-file` 포함
- prompt.md 없을 때 해당 플래그 없음
- sub-agents가 있을 때 `--agents` JSON 포함
- context-engineer가 항상 `--agents`에 포함되는지 확인
- skills가 있을 때 `--add-dir` 포함
- hooks.json이 있을 때 `--settings` 포함
- print mode 플래그
- passthrough 플래그 전달

**`tests/claude-runner/env-builder.test.ts`**:
- 기존 테스트 참조하여 포팅
- ghUser 없으면 빈 object
- (gh CLI mocking이 필요하므로, 캐시 로직과 결과 변환 로직 위주로 테스트)

## Acceptance Criteria

```bash
npm run build  # 빌드 에러 없음
npm test       # 모든 테스트 통과 (Phase 2, 3 테스트 포함)
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/14-auto-startup/index.json`의 phase 4 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `context-engineer.md`는 `src/templates/`에 위치한다. 빌드 시 `dist/templates/`로 복사되어야 하므로, flag-builder에서 이 파일을 읽을 때 적절한 경로 resolve 로직이 필요하다. `__dirname` 기반으로 resolve하라.
- `--add-dir`용 임시 디렉토리는 `.auto-startup/.tmp/run-<uuid>/`에 생성하고, `runClaude()`의 finally 블록에서 반드시 정리하라.
- 사용자가 `--add-dir`을 passthrough로 전달하는 것을 차단하라 (passthroughFlags에 `--add-dir`이 있으면 에러).
- env-builder 테스트에서 실제 `gh` CLI를 호출하지 마라. child_process.spawn을 mock하거나, resolveGithubProfile 함수를 주입 가능하게 설계하라.
- 이전 phase의 테스트를 깨뜨리지 마라.
