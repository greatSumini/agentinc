# Phase 1: Scaffold & Build Pipeline

## 사전 준비

이전 phase에서 기존 모노레포 코드가 전부 삭제되었다. 이제 빈 프로젝트에서 Vite + Hono + React 기반의 새 프로젝트를 초기화한다.

이전 phase의 작업물을 확인하라:

- `scripts/run-phases.py` — 수정된 상태 확인
- `.gitignore` — 정리된 상태 확인
- `packages/`, `spec/` — 삭제 확인

## 작업 내용

### 1. `package.json` 생성

프로젝트 루트에 `package.json`을 생성하라:

```json
{
  "name": "auto-startup",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "auto-startup": "./dist/cli/index.js"
  },
  "scripts": {
    "dev": "tsx src/cli/index.ts",
    "build": "vite build && tsc -p tsconfig.server.json",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

의존성 설치 (`npm install`):

**dependencies:**
- `hono` — API 서버
- `@hono/node-server` — Node.js용 Hono 어댑터
- `react` (^18) — UI
- `react-dom` (^18) — UI
- `react-router-dom` (^6) — 라우팅
- `gray-matter` — Markdown frontmatter 파싱

**devDependencies:**
- `typescript` (^5.7)
- `vite` (^5) — 프론트엔드 빌드
- `@vitejs/plugin-react` — Vite React 플러그인
- `vitest` (^2) — 테스트
- `tsx` — TypeScript 실행 (개발 모드)
- `tailwindcss` (^3) — 스타일링
- `postcss`, `autoprefixer` — CSS 처리
- `@types/react`, `@types/react-dom`, `@types/node`

### 2. TypeScript 설정

**`tsconfig.json`** (프로젝트 전체):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["src/web/**/*", "node_modules", "dist"]
}
```

**`tsconfig.server.json`** (서버/CLI/코어 빌드용):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": [
    "src/core/**/*",
    "src/server/**/*",
    "src/cli/**/*",
    "src/claude-runner/**/*",
    "src/daemon/**/*",
    "src/mcp/**/*",
    "src/templates/**/*"
  ]
}
```

### 3. Vite 설정

**`vite.config.ts`**:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: 'src/web',
  build: {
    outDir: '../../dist/web',
    emptyDirOnBuild: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3847',
    },
  },
})
```

### 4. Vitest 설정

**`vitest.config.ts`**:
```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

### 5. Tailwind CSS 설정

**`tailwind.config.ts`**:
```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/web/**/*.{tsx,ts,html}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

**`postcss.config.js`**:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### 6. 최소 소스 파일 생성

**`src/web/index.html`**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>auto-startup</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

**`src/web/main.tsx`**:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**`src/web/App.tsx`**:
```tsx
export default function App() {
  return <div className="p-8 text-xl">auto-startup</div>
}
```

**`src/web/index.css`**:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**`src/server/index.ts`**:
```ts
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

const app = new Hono()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Static files (built web UI)
app.use('/*', serveStatic({ root: './dist/web' }))

export function startServer(port: number = 3847) {
  return serve({ fetch: app.fetch, port }, (info) => {
    console.log(`auto-startup server running on http://localhost:${info.port}`)
  })
}

export { app }
```

**`src/cli/index.ts`**:
```ts
#!/usr/bin/env node
import { startServer } from '../server/index.js'

const port = parseInt(process.env.PORT || '3847', 10)
startServer(port)
```

### 7. 디렉토리 구조 생성

다음 빈 디렉토리들을 `.gitkeep` 파일과 함께 생성하라:

- `src/core/store/`
- `src/core/services/`
- `src/claude-runner/`
- `src/daemon/`
- `src/mcp/`
- `src/templates/personas/`
- `tests/core/`
- `tests/claude-runner/`

## Acceptance Criteria

```bash
npm run build  # 에러 없이 빌드 완료 (vite build + tsc)
npm test       # vitest가 실행됨 (테스트 파일이 없으므로 0 tests, 에러 없음)

# 서버 기동 테스트 (백그라운드로 시작 후 health check)
node dist/cli/index.js &
SERVER_PID=$!
sleep 2
curl -s http://localhost:3847/api/health | grep -q '"ok"' && echo "PASS" || echo "FAIL"
kill $SERVER_PID 2>/dev/null
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/14-auto-startup/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `@hono/node-server`의 `serveStatic`은 `dist/web/` 경로를 기준으로 한다. Vite 빌드 출력이 이 경로에 있어야 한다.
- `package.json`의 `"type": "module"`을 반드시 설정하라. ESM 모듈 시스템을 사용한다.
- `tsconfig.server.json`은 `src/web/`을 제외한다. 웹 코드는 Vite가 빌드한다.
- 이 phase에서는 비즈니스 로직을 작성하지 마라. 빌드 파이프라인만 동작하면 된다.
- `node_modules/`와 `dist/`는 `.gitignore`에 포함되어 있어야 한다 (Phase 0에서 처리됨).
