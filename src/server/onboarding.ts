/**
 * Onboarding Server
 *
 * Hono app for onboarding mode. Only active during the onboarding process.
 */

import { Hono } from 'hono'
import type { EventBus } from './shared/event-bus.js'
import { createSSEHandler } from './shared/sse-handler.js'
import type { Persona } from '../core/types.js'

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createOnboardingServer(_rootDir: string, eventBus: EventBus): Hono {
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

  // POST /api/onboarding/answers — Receive user answers (MCP bridge)
  app.post('/api/onboarding/answers', async (c) => {
    const body = await c.req.json<{
      answers: Array<{ questionId: string; answer: string }>
      wantMoreQuestions: boolean
    }>()

    // Validate body structure
    if (!Array.isArray(body.answers)) {
      return c.json({ error: 'Invalid answers format' }, 400)
    }

    // TODO: Phase 7에서 구현 — 대기 중인 MCP tool의 Promise를 resolve
    console.log('[onboarding] Received answers:', body.answers.length, 'wantMore:', body.wantMoreQuestions)

    return c.json({ ok: true })
  })

  // POST /api/onboarding/company-name — Confirm company name
  app.post('/api/onboarding/company-name', async (c) => {
    const body = await c.req.json<{ name: string }>()

    if (!body.name || typeof body.name !== 'string') {
      return c.json({ error: 'Invalid company name' }, 400)
    }

    state.step = 'completed'

    // Emit status change
    eventBus.emit('onboarding:status', { persona: state.persona, step: state.step })

    // TODO: Phase 7에서 구현 — 대기 중인 MCP tool의 Promise를 resolve
    console.log('[onboarding] Company name confirmed:', body.name)

    return c.json({ ok: true })
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
