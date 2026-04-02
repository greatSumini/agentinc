// --- Config ---

export type Persona = 'elon-musk' | 'peter-thiel' | 'steve-jobs' | 'bill-gates'

export interface Config {
  company: string
  persona: Persona
  onboardingCompleted: boolean
  port: number
}

// --- Agent ---

export interface AgentConfig {
  name: string
  description: string
  gh_user?: string
  can_delegate?: boolean
}

// --- Ticket ---

export type TicketStatus = 'blocked' | 'ready' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketType = 'task' | 'cc_review'

export interface Comment {
  id: string
  author: string
  content: string
  createdAt: string
}

export interface Ticket {
  id: string
  title: string
  prompt: string
  type: TicketType
  parentTicketId?: string
  ccReviewTicketIds?: string[]
  assignee: string
  priority: TicketPriority
  status: TicketStatus
  createdBy: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  cancelledAt?: string
  result?: { exitCode: number; logPath: string }
  comments: Comment[]
  metadata?: Record<string, unknown>
  version: number
}

// --- Subagent (frontmatter MD) ---

export interface SubagentConfig {
  name: string
  description: string
  prompt: string
  model?: string
  tools?: string
  maxTurns?: number
  disallowedTools?: string
  permissionMode?: string
}
