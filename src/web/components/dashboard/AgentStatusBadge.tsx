import type { AgentStatus } from '../../hooks/useAgents'

interface AgentStatusBadgeProps {
  status: AgentStatus
}

const STATUS_STYLES: Record<AgentStatus, string> = {
  idle: 'bg-green-100 text-green-700',
  working: 'bg-blue-100 text-blue-700',
  offline: 'bg-gray-100 text-gray-500',
}

export function AgentStatusBadge({ status }: AgentStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}
