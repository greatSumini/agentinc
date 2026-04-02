import type { AgentWithStatus } from '../../hooks/useAgents'
import { AgentStatusBadge } from './AgentStatusBadge'

interface AgentTableProps {
  agents: AgentWithStatus[]
  loading: boolean
}

export function AgentTable({ agents, loading }: AgentTableProps) {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">Loading agents...</div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">No agents found</div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
              Description
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {agents.map((agent) => (
            <tr key={agent.name}>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {agent.name}
              </td>
              <td className="px-4 py-3">
                <AgentStatusBadge status={agent.status} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {agent.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
