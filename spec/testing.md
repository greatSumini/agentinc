# auto-startup Testing Strategy

## 원칙

- **순수 로직에 집중**: mock으로 접착제 코드를 테스트하지 않는다
- **커버리지 숫자 목표 없음**: 의미 있는 테스트만 작성
- **구현과 테스트를 함께 작성**: 테스트가 설계를 이끈다
- **실제 fs 선호**: 파일 I/O는 실제로 돌려봐야 의미 있음

## 도구

- **vitest** — TypeScript 네이티브, 빠른 실행

```bash
npm test           # 테스트 실행
npm run test:watch # 워치 모드
```

## 테스트 범위

| 모듈 | 파일 | 테스트 수 | 유형 | 수준 | 이유 |
|------|------|----------|------|------|------|
| frontmatter | `tests/core/frontmatter.test.ts` | 9 | 유닛 | 철저 | 파싱 실패 시 prompt 손실 |
| config-store | `tests/core/config-store.test.ts` | 7 | 통합 (실제 fs) | 핵심 경로 | 파일 I/O는 실제로 돌려봐야 의미 |
| agent-store | `tests/core/agent-store.test.ts` | 15 | 통합 (실제 fs) | 핵심 경로 | per-agent 경로 구조 검증 |
| ticket-store | `tests/core/ticket-store.test.ts` | 26 | 통합 (실제 fs) | 철저 | optimistic locking 검증, 버전 충돌 처리 |
| ticket.service | `tests/core/ticket-service.test.ts` | 32 | 유닛 | 철저 | 상태 머신 전이, CC 로직, 에러 케이스 |
| flag-builder | `tests/claude-runner/flag-builder.test.ts` | 17 | 유닛 | 철저 | 플래그 오류 시 Claude 오작동 |
| env-builder | `tests/claude-runner/env-builder.test.ts` | 9 | 유닛 | 핵심 분기 | GitHub 프로필 → 환경변수 변환 |

### 총계

- **파일 수**: 7개
- **테스트 케이스**: 115개

## 테스트 수준 기준

- **철저**: 모든 분기, 엣지 케이스, 에러 케이스 커버
- **핵심 경로**: happy path + 주요 에러 케이스
- **최소**: 기본 동작 확인만

## 테스트하지 않는 것

| 모듈 | 이유 |
|------|------|
| Hono routes (server/) | 프레임워크 책임. 라우트 정의는 선언적. |
| MCP server (mcp/) | stdio mock 무가치. 실제 Claude CLI 필요. |
| daemon (orchestrator, agent-worker) | child_process mock 무가치. E2E로만 검증 가능. |
| web UI (web/) | 빌드 성공 = 최소 검증. 타입 에러 시 빌드 실패. |
| spawner (claude-runner/) | dry-run으로 수동 검증. |
| CLI (cli/) | 전체 흐름 E2E만 의미 있음. |

## 테스트 구조

```
tests/
├── core/
│   ├── frontmatter.test.ts
│   ├── config-store.test.ts
│   ├── agent-store.test.ts
│   ├── ticket-store.test.ts
│   └── ticket-service.test.ts
└── claude-runner/
    ├── flag-builder.test.ts
    └── env-builder.test.ts
```

## 테스트 작성 가이드

### Store 테스트 (실제 fs)

```typescript
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('ConfigStore', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('should save and load config', () => {
    // 실제 파일 시스템 사용
  })
})
```

### Service 테스트

```typescript
describe('TicketService', () => {
  let tmpDir: string
  let service: TicketService

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'test-'))
    service = new TicketService(tmpDir)
  })

  it('should validate status transitions', () => {
    // 상태 머신 검증
  })

  it('should throw on invalid transition', () => {
    expect(() => service.updateStatus(...)).toThrow(InvalidTransitionError)
  })
})
```

### Builder 테스트

```typescript
describe('buildFlags', () => {
  it('should include context-engineer by default', () => {
    const result = buildFlags({ rootDir, agentName })
    expect(result.flags).toContain('--agents')
    // JSON 파싱해서 context-engineer 존재 확인
  })

  it('should reject --add-dir in passthroughFlags', () => {
    expect(() => buildFlags({
      ...params,
      passthroughFlags: ['--add-dir=/foo']
    })).toThrow()
  })
})
```
