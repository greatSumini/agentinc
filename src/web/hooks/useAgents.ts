import { useEffect, useState, useCallback } from 'react'
import { get } from '../lib/api-client'
import { useSSE } from './useSSE'
import type { AgentConfig } from '../../core/types'

export type AgentStatus = 'idle' | 'working' | 'offline'

export interface AgentWithStatus extends AgentConfig {
  status: AgentStatus
}

interface AgentStatusEvent {
  agentName: string
  status: AgentStatus
}

export function useAgents(): { agents: AgentWithStatus[]; loading: boolean } {
  const [agents, setAgents] = useState<AgentWithStatus[]>([])
  const [loading, setLoading] = useState(true)

  const handleEvent = useCallback((type: string, data: unknown) => {
    if (type === 'agent:status') {
      const event = data as AgentStatusEvent
      setAgents((prev) =>
        prev.map((agent) =>
          agent.name === event.agentName ? { ...agent, status: event.status } : agent
        )
      )
    }
  }, [])

  useSSE(['agent:status'], handleEvent)

  useEffect(() => {
    get<AgentWithStatus[]>('/agents')
      .then((data) => {
        setAgents(data)
      })
      .catch(() => {
        setAgents([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return { agents, loading }
}
