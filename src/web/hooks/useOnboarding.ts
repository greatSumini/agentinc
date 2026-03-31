import { useState, useCallback } from 'react'
import { useSSE } from './useSSE'
import { get, post } from '../lib/api-client'
import type { Persona } from '../../core/types'

export interface ChatMessage {
  role: 'ceo' | 'user'
  content: string
}

export interface Question {
  id: string
  text: string
  options: [string, string, string]
}

export interface OnboardingState {
  step: 'persona' | 'chat' | 'company-name' | 'completed'
  persona: Persona | null
  messages: ChatMessage[]
  currentQuestions: Question[] | null
  suggestedCompanyName: string | null
  loading: boolean
}

interface OnboardingStatusResponse {
  persona: Persona | null
  step: 'persona' | 'chat' | 'company-name' | 'completed'
  suggestedCompanyName?: string
}

export interface Answer {
  questionId: string
  answer: string
}

export function useOnboarding(): {
  state: OnboardingState
  selectPersona: (persona: Persona) => Promise<void>
  submitAnswers: (answers: Answer[], wantMore: boolean) => Promise<void>
  confirmCompanyName: (name: string) => Promise<void>
  sendInitialMessage: (message: string) => void
  fetchStatus: () => Promise<void>
} {
  const [state, setState] = useState<OnboardingState>({
    step: 'persona',
    persona: null,
    messages: [],
    currentQuestions: null,
    suggestedCompanyName: null,
    loading: false,
  })

  // Handle SSE events
  const handleSSEEvent = useCallback((type: string, data: unknown) => {
    if (type === 'onboarding:question') {
      const questions = data as Question[]
      setState((prev) => ({
        ...prev,
        currentQuestions: questions,
        loading: false,
      }))
    } else if (type === 'onboarding:status') {
      const status = data as OnboardingStatusResponse
      setState((prev) => ({
        ...prev,
        step: status.step,
        persona: status.persona,
        suggestedCompanyName: status.suggestedCompanyName || null,
        loading: false,
      }))
    }
  }, [])

  useSSE(['onboarding:question', 'onboarding:status'], handleSSEEvent)

  const fetchStatus = useCallback(async () => {
    const status = await get<OnboardingStatusResponse>('/onboarding/status')
    setState((prev) => ({
      ...prev,
      step: status.step,
      persona: status.persona,
    }))
  }, [])

  const selectPersona = useCallback(async (persona: Persona) => {
    setState((prev) => ({ ...prev, loading: true }))
    await post('/onboarding/persona', { persona })
    setState((prev) => ({
      ...prev,
      persona,
      step: 'chat',
      loading: false,
    }))
  }, [])

  const sendInitialMessage = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, { role: 'user', content: message }],
      loading: true,
    }))
  }, [])

  const submitAnswers = useCallback(async (answers: Answer[], wantMore: boolean) => {
    setState((prev) => ({ ...prev, loading: true, currentQuestions: null }))
    await post('/onboarding/answers', {
      answers,
      wantMoreQuestions: wantMore,
    })
    // If wantMore is true, wait for new questions via SSE
    // If wantMore is false, wait for company name via SSE
    if (!wantMore) {
      setState((prev) => ({ ...prev, loading: true }))
    }
  }, [])

  const confirmCompanyName = useCallback(async (name: string) => {
    setState((prev) => ({ ...prev, loading: true }))
    await post('/onboarding/company-name', { name })
    // Wait for SSE to update step to 'completed'
  }, [])

  return {
    state,
    selectPersona,
    submitAnswers,
    confirmCompanyName,
    sendInitialMessage,
    fetchStatus,
  }
}
