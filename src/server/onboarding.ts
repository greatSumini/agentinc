/**
 * Onboarding Server
 *
 * Hono app for onboarding mode. Only active during the onboarding process.
 */

import { Hono } from 'hono'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import type { EventBus } from './shared/event-bus.js'
import { createSSEHandler } from './shared/sse-handler.js'
import type { Persona, Config, AgentConfig } from '../core/types.js'
import { saveConfig, getConfig } from '../core/store/config-store.js'
import { saveAgent, saveAgentPrompt, saveAgentSubagent } from '../core/store/agent-store.js'
import { parseSubagentMd } from '../core/utils/frontmatter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type OnboardingStep = 'persona' | 'chat' | 'company-name' | 'completed'

interface OnboardingState {
  persona: Persona | null
  step: OnboardingStep
  answers: Array<{ questionId: string; question: string; answer: string }>
}

// In-memory state for onboarding
const state: OnboardingState = {
  persona: null,
  step: 'persona',
  answers: [],
}

// MCP Bridge — in-memory callbacks for MCP <-> Web UI communication
interface OnboardingBridge {
  pendingQuestionResolve: ((data: {
    answers: Array<{ questionId: string; answer: string }>
    wantMoreQuestions: boolean
  }) => void) | null
  pendingCompanyNameResolve: ((name: string) => void) | null
  currentQuestions: Array<{
    id: string
    text: string
    options: [string, string, string]
  }> | null
  currentSuggestedCompanyName: string | null
}

const bridge: OnboardingBridge = {
  pendingQuestionResolve: null,
  pendingCompanyNameResolve: null,
  currentQuestions: null,
  currentSuggestedCompanyName: null,
}

function getPersonaPromptPath(persona: Persona): string {
  // Try source path first (development)
  const srcPath = path.resolve(__dirname, '../templates/personas', `${persona}.md`)
  if (fs.existsSync(srcPath)) {
    return srcPath
  }
  // Fallback to dist path (production)
  const distPath = path.resolve(__dirname, '../../templates/personas', `${persona}.md`)
  if (fs.existsSync(distPath)) {
    return distPath
  }
  throw new Error(`Persona prompt not found: ${persona}`)
}

function getOnboardingSystemPromptPath(): string {
  // Try source path first (development)
  const srcPath = path.resolve(__dirname, '../templates/onboarding-system.md')
  if (fs.existsSync(srcPath)) {
    return srcPath
  }
  // Fallback to dist path (production)
  const distPath = path.resolve(__dirname, '../../templates/onboarding-system.md')
  if (fs.existsSync(distPath)) {
    return distPath
  }
  throw new Error('Onboarding system prompt not found')
}

function getContextEngineerPath(): string {
  // Try source path first (development)
  const srcPath = path.resolve(__dirname, '../templates/context-engineer.md')
  if (fs.existsSync(srcPath)) {
    return srcPath
  }
  // Fallback to dist path (production)
  const distPath = path.resolve(__dirname, '../../templates/context-engineer.md')
  if (fs.existsSync(distPath)) {
    return distPath
  }
  throw new Error('context-engineer.md template not found')
}

function getMcpServerPath(): string {
  // Try dist path (production)
  const distPath = path.resolve(__dirname, '../../mcp/onboarding-mcp.js')
  if (fs.existsSync(distPath)) {
    return distPath
  }
  // Fallback to source path (won't work without transpilation, but for path reference)
  const srcPath = path.resolve(__dirname, '../mcp/onboarding-mcp.js')
  return distPath // Return dist path anyway, it should exist after build
}

export function createOnboardingServer(rootDir: string, eventBus: EventBus, port?: number): Hono {
  const app = new Hono()
  const serverPort = port || getConfig(rootDir)?.port || 3000

  // Health check
  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  // GET /api/onboarding/status — Current onboarding state
  app.get('/api/onboarding/status', (c) => {
    return c.json({
      persona: state.persona,
      step: state.step,
    })
  })

  // POST /api/onboarding/persona — Select persona
  app.post('/api/onboarding/persona', async (c) => {
    const body = await c.req.json<{ persona: Persona }>()
    const validPersonas: Persona[] = ['elon-musk', 'peter-thiel', 'steve-jobs', 'bill-gates']

    if (!validPersonas.includes(body.persona)) {
      return c.json({ error: 'Invalid persona' }, 400)
    }

    state.persona = body.persona
    state.step = 'chat'
    state.answers = [] // Reset answers for new persona

    // Emit status change
    eventBus.emit('onboarding:status', { persona: state.persona, step: state.step })

    // Spawn CEO claude session (async, don't await)
    spawnCEOSession(rootDir, body.persona, serverPort).catch((err) => {
      console.error('[onboarding] Failed to spawn CEO session:', err)
    })

    return c.json({ ok: true })
  })

  // === MCP Bridge Endpoints ===

  // POST /api/onboarding/push-questions — MCP pushes questions to web UI
  app.post('/api/onboarding/push-questions', async (c) => {
    const body = await c.req.json<{
      questions: Array<{
        id: string
        text: string
        options: [string, string, string]
      }>
    }>()

    if (!Array.isArray(body.questions)) {
      return c.json({ error: 'Invalid questions format' }, 400)
    }

    bridge.currentQuestions = body.questions

    // Emit to SSE for web UI
    eventBus.emit('onboarding:question', body.questions)

    return c.json({ ok: true })
  })

  // GET /api/onboarding/pending-answer — MCP polls for user answers (long-poll)
  app.get('/api/onboarding/pending-answer', async (c) => {
    const TIMEOUT_MS = 60000 // 60 seconds

    return new Promise<Response>((resolve) => {
      const timeoutId = setTimeout(() => {
        bridge.pendingQuestionResolve = null
        resolve(c.json({ timeout: true }))
      }, TIMEOUT_MS)

      bridge.pendingQuestionResolve = (data) => {
        clearTimeout(timeoutId)
        bridge.pendingQuestionResolve = null

        // Store answers for later use
        if (bridge.currentQuestions) {
          for (const answer of data.answers) {
            const question = bridge.currentQuestions.find((q) => q.id === answer.questionId)
            if (question) {
              state.answers.push({
                questionId: answer.questionId,
                question: question.text,
                answer: answer.answer,
              })
            }
          }
        }

        bridge.currentQuestions = null
        resolve(c.json(data))
      }
    })
  })

  // POST /api/onboarding/push-company-name — MCP pushes company name suggestion
  app.post('/api/onboarding/push-company-name', async (c) => {
    const body = await c.req.json<{ suggestedName: string }>()

    if (!body.suggestedName || typeof body.suggestedName !== 'string') {
      return c.json({ error: 'Invalid suggestedName' }, 400)
    }

    bridge.currentSuggestedCompanyName = body.suggestedName
    state.step = 'company-name'

    // Emit to SSE for web UI
    eventBus.emit('onboarding:status', {
      persona: state.persona,
      step: state.step,
      suggestedCompanyName: body.suggestedName,
    })

    return c.json({ ok: true })
  })

  // GET /api/onboarding/pending-company-name — MCP polls for company name confirmation
  app.get('/api/onboarding/pending-company-name', async (c) => {
    const TIMEOUT_MS = 60000 // 60 seconds

    return new Promise<Response>((resolve) => {
      const timeoutId = setTimeout(() => {
        bridge.pendingCompanyNameResolve = null
        resolve(c.json({ timeout: true }))
      }, TIMEOUT_MS)

      bridge.pendingCompanyNameResolve = (name) => {
        clearTimeout(timeoutId)
        bridge.pendingCompanyNameResolve = null
        bridge.currentSuggestedCompanyName = null
        resolve(c.json({ confirmedName: name }))
      }
    })
  })

  // POST /api/onboarding/answers — Web UI sends answers (resolves MCP's pending promise)
  app.post('/api/onboarding/answers', async (c) => {
    const body = await c.req.json<{
      answers: Array<{ questionId: string; answer: string }>
      wantMoreQuestions: boolean
    }>()

    // Validate body structure
    if (!Array.isArray(body.answers)) {
      return c.json({ error: 'Invalid answers format' }, 400)
    }

    // Resolve MCP's pending promise
    if (bridge.pendingQuestionResolve) {
      bridge.pendingQuestionResolve({
        answers: body.answers,
        wantMoreQuestions: body.wantMoreQuestions,
      })
    }

    return c.json({ ok: true })
  })

  // POST /api/onboarding/company-name — Web UI confirms company name (resolves MCP's pending promise)
  app.post('/api/onboarding/company-name', async (c) => {
    const body = await c.req.json<{ name: string }>()

    if (!body.name || typeof body.name !== 'string') {
      return c.json({ error: 'Invalid company name' }, 400)
    }

    state.step = 'completed'

    // Emit status change
    eventBus.emit('onboarding:status', { persona: state.persona, step: state.step })

    // Resolve MCP's pending promise
    if (bridge.pendingCompanyNameResolve) {
      bridge.pendingCompanyNameResolve(body.name)
    }

    return c.json({ ok: true })
  })

  // POST /api/onboarding/complete — MCP completes onboarding
  app.post('/api/onboarding/complete', async (c) => {
    const body = await c.req.json<{
      company: string
      goal: string
      businessValues: string
      businessAntiValues: string
    }>()

    if (!body.company || !body.goal || !body.businessValues || !body.businessAntiValues) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const persona = state.persona || 'steve-jobs'

    // 1. Create principles/ directory and files
    const principlesDir = path.join(rootDir, 'principles')
    fs.mkdirSync(principlesDir, { recursive: true })

    // principles/goal.md
    const goalContent = `# ${body.company} — Goal

${body.goal}
`
    fs.writeFileSync(path.join(principlesDir, 'goal.md'), goalContent)

    // principles/business.md
    const businessContent = `# ${body.company} — Business Values

## Core Values

${body.businessValues}

## What We Don't Pursue

${body.businessAntiValues}
`
    fs.writeFileSync(path.join(principlesDir, 'business.md'), businessContent)

    // 2. Create CLAUDE.md at rootDir
    const claudeMdContent = `# ${body.company}

이 프로젝트는 auto-startup으로 생성된 AI 기반 회사입니다.

## Principles

- [Goal](./principles/goal.md) — 회사의 존재 이유와 최종 목표
- [Business Values](./principles/business.md) — 핵심 가치와 추구하지 않는 것
`
    fs.writeFileSync(path.join(rootDir, 'CLAUDE.md'), claudeMdContent)

    // 3. Create .claude/settings.json with SessionEnd hook
    const claudeDir = path.join(rootDir, '.claude')
    fs.mkdirSync(claudeDir, { recursive: true })

    const settingsJson = {
      hooks: {
        SessionEnd: [
          {
            type: 'command',
            command: `bash -c '[ -f .auto-startup/.pid ] && curl -sf http://localhost:${serverPort}/api/hooks/session-end -X POST -H "Content-Type: application/json" -d "{\\"agentName\\": \\"$AGENT_NAME\\"}" || true'`,
          },
        ],
      },
    }
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify(settingsJson, null, 2))

    // 4. Save config
    const config: Config = {
      company: body.company,
      persona,
      onboardingCompleted: true,
      port: serverPort,
    }
    saveConfig(rootDir, config)

    // 5. Save onboarding.json with all Q&A
    const onboardingData = {
      persona,
      company: body.company,
      goal: body.goal,
      businessValues: body.businessValues,
      businessAntiValues: body.businessAntiValues,
      answers: state.answers,
      completedAt: new Date().toISOString(),
    }
    const autoStartupDir = path.join(rootDir, '.auto-startup')
    fs.mkdirSync(autoStartupDir, { recursive: true })
    fs.writeFileSync(
      path.join(autoStartupDir, 'onboarding.json'),
      JSON.stringify(onboardingData, null, 2)
    )

    // 6. Create CEO agent
    const ceoAgentConfig: AgentConfig = {
      name: 'ceo',
      description: '회사의 CEO. 방향성 결정, 업무 할당, 원칙 관리.',
      can_delegate: true,
    }
    saveAgent(rootDir, 'ceo', ceoAgentConfig)

    // 7. Create CEO prompt.md (operational mode, not onboarding)
    const personaPromptContent = fs.readFileSync(getPersonaPromptPath(persona), 'utf-8')
    const ceoPromptContent = `당신은 ${body.company}의 CEO입니다.

${personaPromptContent}

## 역할

- 회사의 방향성과 원칙을 관리한다
- 에이전트에게 업무를 할당한다 (CreateTicket tool 사용)
- 사용자의 질문에 회사의 현재 상태와 방향성을 안내한다

## Principles

반드시 다음 문서를 읽고 회사의 원칙을 이해하라:
- principles/goal.md
- principles/business.md

## 학습 기록

세션이 끝나기 전, 이 세션에서 학습한 내용이 있다면 context-engineer 서브에이전트를 사용해서 기록하세요.
`
    saveAgentPrompt(rootDir, 'ceo', ceoPromptContent)

    // 8. Copy context-engineer.md to CEO's agents/
    const contextEngineerContent = fs.readFileSync(getContextEngineerPath(), 'utf-8')
    const contextEngineerConfig = parseSubagentMd(contextEngineerContent)
    saveAgentSubagent(rootDir, 'ceo', contextEngineerConfig)

    // 9. Cleanup temp files
    const tmpDir = path.join(rootDir, '.auto-startup', '.tmp')
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }

    state.step = 'completed'
    eventBus.emit('onboarding:status', { persona: state.persona, step: state.step })

    return c.json({ success: true })
  })

  // GET /api/events — SSE stream (onboarding events)
  app.get('/api/events', createSSEHandler(eventBus))

  return app
}

async function spawnCEOSession(rootDir: string, persona: Persona, port: number): Promise<void> {
  // Create tmp directory
  const tmpDir = path.join(rootDir, '.auto-startup', '.tmp')
  fs.mkdirSync(tmpDir, { recursive: true })

  // 1. Create temp mcp.json
  const mcpConfig = {
    mcpServers: {
      'auto-startup': {
        command: 'node',
        args: [getMcpServerPath(), '--root', rootDir, '--port', String(port)],
      },
    },
  }
  const mcpConfigPath = path.join(tmpDir, 'onboarding-mcp.json')
  fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2))

  // 2. Create combined system prompt (persona + onboarding system)
  const personaPrompt = fs.readFileSync(getPersonaPromptPath(persona), 'utf-8')
  const onboardingSystemPrompt = fs.readFileSync(getOnboardingSystemPromptPath(), 'utf-8')
  const combinedPrompt = `${personaPrompt}\n\n${onboardingSystemPrompt}`
  const promptPath = path.join(tmpDir, 'onboarding-prompt.md')
  fs.writeFileSync(promptPath, combinedPrompt)

  // 3. Spawn claude with --print mode (async)
  const flags = [
    '--print',
    '-p',
    '온보딩을 시작하세요. 사용자에게 첫 질문을 하세요.',
    '--append-system-prompt-file',
    promptPath,
    '--mcp-config',
    mcpConfigPath,
  ]

  console.log('[onboarding] Spawning CEO session with persona:', persona)

  const proc = spawn('claude', flags, {
    cwd: rootDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  })

  proc.stdout?.on('data', (data) => {
    console.log('[ceo-session]', data.toString())
  })

  proc.stderr?.on('data', (data) => {
    console.error('[ceo-session:err]', data.toString())
  })

  proc.on('close', (code) => {
    console.log('[onboarding] CEO session exited with code:', code)
    // Cleanup tmp files on session end
    try {
      if (fs.existsSync(mcpConfigPath)) fs.unlinkSync(mcpConfigPath)
      if (fs.existsSync(promptPath)) fs.unlinkSync(promptPath)
    } catch {
      // Ignore cleanup errors
    }
  })

  proc.on('error', (err) => {
    console.error('[onboarding] Failed to spawn CEO session:', err)
  })
}

export function resetOnboardingState(): void {
  state.persona = null
  state.step = 'persona'
  state.answers = []
}

export function getOnboardingState(): OnboardingState {
  return { ...state }
}

export function setOnboardingStep(step: OnboardingStep): void {
  state.step = step
}

// Export bridge for testing
export function getOnboardingBridge(): OnboardingBridge {
  return bridge
}

export function resetOnboardingBridge(): void {
  bridge.pendingQuestionResolve = null
  bridge.pendingCompanyNameResolve = null
  bridge.currentQuestions = null
  bridge.currentSuggestedCompanyName = null
}
