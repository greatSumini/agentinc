# Phase 11: CLI Entry Point & Integration

## 사전 준비

먼저 아래 파일들을 읽고 현재 프로젝트 상태를 파악하라:

- `src/cli/index.ts` — 현재 CLI 진입점 (최소 서버 시작)
- `src/server/index.ts` — startOnboardingServer, startNormalServer
- `src/daemon/orchestrator.ts` — Orchestrator 클래스
- `src/core/store/config-store.ts` — isOnboarded(), getConfig()
- `src/core/store/agent-store.ts` — listAgents()
- `package.json` — bin 필드 확인

## 작업 내용

### 1. `src/cli/index.ts` — 전체 리팩터

최소 서버 시작 코드를 전체 통합 로직으로 교체:

```ts
#!/usr/bin/env node

import { isOnboarded, getConfig } from '../core/store/config-store.js'
import { startOnboardingServer, startNormalServer } from '../server/index.js'
import { Orchestrator } from '../daemon/orchestrator.js'
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const DEFAULT_PORT = 3847

async function main() {
  const rootDir = process.cwd()
  const config = getConfig(rootDir)
  const port = config?.port ?? DEFAULT_PORT

  console.log('auto-startup starting...')

  // --- 온보딩 모드 ---
  if (!isOnboarded(rootDir)) {
    console.log('Onboarding required. Starting onboarding server...')
    const { server, eventBus } = startOnboardingServer(rootDir, port)
    openBrowser(port)

    // 온보딩 완료까지 대기
    await waitForOnboardingComplete(rootDir)

    // 온보딩 서버 종료
    server.close()
    console.log('Onboarding completed. Restarting in normal mode...')
  }

  // --- 노멀 모드 ---
  console.log('Starting dashboard & daemon...')

  // PID 파일 생성
  const pidFile = join(rootDir, '.auto-startup', '.pid')
  mkdirSync(join(rootDir, '.auto-startup'), { recursive: true })
  writeFileSync(pidFile, String(process.pid))

  // Orchestrator 시작
  const orchestrator = new Orchestrator({ rootDir, serverPort: port })

  // 노멀 서버 시작
  const { server } = startNormalServer(rootDir, port, orchestrator)

  // Daemon 시작
  await orchestrator.start()

  openBrowser(port)

  console.log(`auto-startup running at http://localhost:${port}`)
  console.log('Press Ctrl+C to stop.')

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...')
    await orchestrator.stop()
    server.close()
    if (existsSync(pidFile)) unlinkSync(pidFile)
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

function openBrowser(port: number) {
  const url = `http://localhost:${port}`
  try {
    // macOS
    execSync(`open ${url}`, { stdio: 'ignore' })
  } catch {
    // Linux
    try {
      execSync(`xdg-open ${url}`, { stdio: 'ignore' })
    } catch {
      console.log(`Open ${url} in your browser.`)
    }
  }
}

async function waitForOnboardingComplete(rootDir: string): Promise<void> {
  // 1초 간격으로 config 확인
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (isOnboarded(rootDir)) {
        clearInterval(interval)
        resolve()
      }
    }, 1000)
  })
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
```

### 2. PID 파일 관리

- **생성**: 노멀 모드 시작 시 `.auto-startup/.pid`에 `process.pid` 기록
- **삭제**: SIGINT/SIGTERM 핸들러에서 삭제
- **용도**: SessionEnd hook이 auto-startup 실행 중인지 판단하는 데 사용

### 3. 빌드 스크립트 확인

`package.json`의 빌드 후 `dist/cli/index.js`가 실행 가능한지 확인:

```json
{
  "bin": {
    "auto-startup": "./dist/cli/index.js"
  }
}
```

`dist/cli/index.js` 파일 상단에 `#!/usr/bin/env node` shebang이 있어야 한다. TypeScript 컴파일 시 유지되는지 확인하고, 안 되면 빌드 후 스크립트에서 추가하라.

### 4. 개발 모드 지원

`package.json` scripts에 개발 모드 추가/수정:

```json
{
  "scripts": {
    "dev": "tsx src/cli/index.ts",
    "dev:web": "vite --config vite.config.ts",
    "build": "vite build && tsc -p tsconfig.server.json",
    "test": "vitest run"
  }
}
```

- `npm run dev`: 서버 + daemon 직접 실행 (빌드 없이)
- `npm run dev:web`: Vite dev 서버만 (프론트엔드 개발용, API는 프록시)

### 5. 통합 검증

전체 시스템 통합 동작 확인을 위한 체크리스트:

1. `npm run build` 성공
2. `node dist/cli/index.js` 실행 → 서버 시작
3. 온보딩 미완료 시: 온보딩 UI 표시
4. Ctrl+C → 깨끗한 종료 (.pid 삭제)

## Acceptance Criteria

```bash
npm run build  # 빌드 에러 없음
npm test       # 모든 테스트 통과

# CLI 실행 테스트
node dist/cli/index.js &
CLI_PID=$!
sleep 3

# 서버 응답 확인
curl -sf http://localhost:3847/api/health | grep -q "ok" && echo "PASS: health" || echo "FAIL: health"

# PID 파일 또는 온보딩 모드 확인 (온보딩 미완료면 PID 파일 없음이 정상)
echo "PASS: server running"

# 종료
kill $CLI_PID 2>/dev/null
sleep 1

# PID 파일 정리 확인 (있었다면)
echo "PASS: shutdown clean"
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/14-auto-startup/index.json`의 phase 11 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `openBrowser()`는 실패해도 전체 프로세스를 중단하지 않는다. try-catch로 감싸서 무시.
- PID 파일은 **노멀 모드에서만** 생성한다. 온보딩 모드에서는 SessionEnd hook이 동작할 필요 없으므로.
- `waitForOnboardingComplete`는 파일 시스템 polling이다. 온보딩 서버가 `config.json`을 저장하면 감지된다. EventEmitter 등 복잡한 IPC가 아닌, 단순한 접근.
- `server.close()`는 Hono의 `@hono/node-server`에서 반환하는 서버 인스턴스의 close 메서드다. `startOnboardingServer`/`startNormalServer`가 서버 인스턴스를 반환하는지 확인하라. 안 한다면 이 phase에서 수정.
- shebang (`#!/usr/bin/env node`)이 tsc 컴파일 후에도 유지되는지 확인. 제거된다면 `build` 스크립트에 `echo '#!/usr/bin/env node' | cat - dist/cli/index.js > temp && mv temp dist/cli/index.js` 같은 후처리를 추가하라.
- 이전 phase의 테스트를 깨뜨리지 마라.
