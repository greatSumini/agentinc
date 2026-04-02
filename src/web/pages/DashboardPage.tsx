import { useAgents } from '../hooks/useAgents'
import { AgentTable } from '../components/dashboard/AgentTable'

export function DashboardPage() {
  const { agents, loading } = useAgents()

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Agents</h1>
      <AgentTable agents={agents} loading={loading} />
    </div>
  )
}
