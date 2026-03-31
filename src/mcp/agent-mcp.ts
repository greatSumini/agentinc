/**
 * Agent MCP Server
 *
 * MCP server for agent operations. Provides tools for creating,
 * listing, and updating tickets.
 *
 * CLI args: --root <rootDir> --port <serverPort>
 */

import { MCPServer } from './protocol.js'

function parseArgs(): { rootDir: string; port: number } {
  const args = process.argv.slice(2)
  const rootIdx = args.indexOf('--root')
  const portIdx = args.indexOf('--port')

  if (rootIdx === -1 || portIdx === -1) {
    console.error('Usage: agent-mcp --root <rootDir> --port <serverPort>')
    process.exit(1)
  }

  return {
    rootDir: args[rootIdx + 1],
    port: parseInt(args[portIdx + 1], 10),
  }
}

async function apiCall(
  port: number,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = `http://localhost:${port}${path}`
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API call failed: ${response.status} ${text}`)
  }

  return response.json()
}

function createAgentMCPServer(port: number): MCPServer {
  const server = new MCPServer()

  // Tool: CreateTicket
  server.registerTool(
    {
      name: 'CreateTicket',
      description: 'Create a new ticket and assign it to an agent.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          prompt: { type: 'string' },
          assignee: { type: 'string' },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'urgent'],
          },
          cc: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['title', 'prompt', 'assignee'],
      },
    },
    async (params) => {
      const result = (await apiCall(port, 'POST', '/api/tickets', {
        title: params.title,
        prompt: params.prompt,
        assignee: params.assignee,
        priority: params.priority,
        cc: params.cc,
      })) as { id: string; status: string }

      return { ticketId: result.id, status: result.status }
    }
  )

  // Tool: ListTickets
  server.registerTool(
    {
      name: 'ListTickets',
      description: 'List tickets with optional filters.',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          assignee: { type: 'string' },
        },
      },
    },
    async (params) => {
      const queryParams = new URLSearchParams()
      if (params.status) queryParams.set('status', params.status as string)
      if (params.assignee) queryParams.set('assignee', params.assignee as string)

      const query = queryParams.toString()
      const path = query ? `/api/tickets?${query}` : '/api/tickets'

      const tickets = await apiCall(port, 'GET', path)
      return { tickets }
    }
  )

  // Tool: UpdateTicket
  server.registerTool(
    {
      name: 'UpdateTicket',
      description: 'Update a ticket status or priority.',
      inputSchema: {
        type: 'object',
        properties: {
          ticketId: { type: 'string' },
          status: { type: 'string' },
          priority: { type: 'string' },
          expectedVersion: { type: 'number' },
        },
        required: ['ticketId', 'expectedVersion'],
      },
    },
    async (params) => {
      const ticketId = params.ticketId as string
      const result = await apiCall(port, 'PATCH', `/api/tickets/${ticketId}`, {
        status: params.status,
        priority: params.priority,
        expectedVersion: params.expectedVersion,
      })

      return { ticket: result }
    }
  )

  return server
}

// Main entry point
const { port } = parseArgs()
const server = createAgentMCPServer(port)
server.start().catch((err) => {
  console.error('MCP server error:', err)
  process.exit(1)
})
