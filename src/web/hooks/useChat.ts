import { useState, useCallback } from 'react'

const BASE_URL = '/api'

interface ChatMessage {
  role: 'user' | 'ceo'
  content: string
}

export interface ChatState {
  messages: ChatMessage[]
  loading: boolean
  error: string | null
}

interface ChatResponse {
  response: string
}

export function useChat(): {
  state: ChatState
  sendMessage: (message: string) => Promise<void>
} {
  const [state, setState] = useState<ChatState>({
    messages: [],
    loading: false,
    error: null,
  })

  const sendMessage = useCallback(async (message: string) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, { role: 'user', content: message }],
      loading: true,
      error: null,
    }))

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000) // 5 min timeout

      const res = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errData.error || `Request failed: ${res.status}`)
      }

      const data: ChatResponse = await res.json()

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, { role: 'ceo', content: data.response }],
        loading: false,
      }))
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.name === 'AbortError'
            ? 'Request timed out'
            : error.message
          : 'Unknown error'

      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }))
    }
  }, [])

  return { state, sendMessage }
}
