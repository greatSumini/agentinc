/**
 * Onboarding Server
 *
 * Hono app for onboarding mode. Only active during the onboarding process.
 */

import { Hono } from 'hono'
import type { EventBus } from './shared/event-bus.js'
import { createSSEHandler } from './shared/sse-handler.js'
import type { Persona, Config } from '../core/types.js'
import { saveConfig, getConfig } from '../core/store/config-store.js'

type OnboardingStep = 'persona' | 'chat' | 'company-name' | 'completed'

interface OnboardingState {
  persona: Persona | null
  step: OnboardingStep
}

// In-memory state for onboarding
const state: OnboardingState = {
  persona: null,
  step: 'persona',
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

export function createOnboardingServer(rootDir: string, eventBus: EventBus): Hono {
  const app = new Hono()

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

    // Emit status change
    eventBus.emit('onboarding:status', { persona: state.persona, step: state.step })

    // TODO: Phase 8에서 구현 — CEO claude session spawn 트리거
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

    // For Phase 7: just mark onboarding as completed in config
    // Phase 8 will handle file creation
    const existingConfig = getConfig(rootDir)
    const defaultPersona: Persona = 'steve-jobs'
    const config: Config = {
      company: body.company,
      persona: state.persona || existingConfig?.persona || defaultPersona,
      onboardingCompleted: true,
      port: existingConfig?.port || 3000,
    }
    saveConfig(rootDir, config)

    state.step = 'completed'
    eventBus.emit('onboarding:status', { persona: state.persona, step: state.step })

    return c.json({ success: true })
  })

  // GET /api/events — SSE stream (onboarding events)
  app.get('/api/events', createSSEHandler(eventBus))

  return app
}

export function resetOnboardingState(): void {
  state.persona = null
  state.step = 'persona'
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
