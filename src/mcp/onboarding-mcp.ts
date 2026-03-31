/**
 * Onboarding MCP Server
 *
 * MCP server for onboarding flow. Provides tools for asking questions,
 * confirming company name, and completing onboarding.
 *
 * CLI args: --root <rootDir> --port <serverPort>
 */

import { MCPServer } from './protocol.js'

function parseArgs(): { rootDir: string; port: number } {
  const args = process.argv.slice(2)
  const rootIdx = args.indexOf('--root')
  const portIdx = args.indexOf('--port')

  if (rootIdx === -1 || portIdx === -1) {
    console.error('Usage: onboarding-mcp --root <rootDir> --port <serverPort>')
    process.exit(1)
  }

  return {
    rootDir: args[rootIdx + 1],
    port: parseInt(args[portIdx + 1], 10),
  }
}

async function apiCall(
  port: number,
  method: 'GET' | 'POST',
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

function createOnboardingMCPServer(port: number): MCPServer {
  const server = new MCPServer()

  // Tool: AskOnboardingQuestions
  server.registerTool(
    {
      name: 'AskOnboardingQuestions',
      description: 'Present onboarding questions to the user and receive their answers.',
      inputSchema: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                options: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 3,
                  maxItems: 3,
                },
              },
              required: ['id', 'text', 'options'],
            },
          },
        },
        required: ['questions'],
      },
    },
    async (params) => {
      const questions = params.questions as Array<{
        id: string
        text: string
        options: [string, string, string]
      }>

      // Push questions to the web UI
      await apiCall(port, 'POST', '/api/onboarding/push-questions', { questions })

      // Poll for answers (long-polling with timeout)
      const maxRetries = 10 // 10 * 60s = 10 minutes max
      for (let i = 0; i < maxRetries; i++) {
        const result = (await apiCall(port, 'GET', '/api/onboarding/pending-answer')) as {
          answers?: Array<{ questionId: string; answer: string }>
          wantMoreQuestions?: boolean
          timeout?: boolean
        }

        if (!result.timeout) {
          return {
            answers: result.answers,
            wantMoreQuestions: result.wantMoreQuestions,
          }
        }
        // Timeout, retry
      }

      throw new Error('Timed out waiting for user answers')
    }
  )

  // Tool: ConfirmCompanyName
  server.registerTool(
    {
      name: 'ConfirmCompanyName',
      description: 'Ask the user to confirm the company name.',
      inputSchema: {
        type: 'object',
        properties: {
          suggestedName: { type: 'string' },
        },
        required: ['suggestedName'],
      },
    },
    async (params) => {
      const suggestedName = params.suggestedName as string

      // Push company name suggestion to web UI
      await apiCall(port, 'POST', '/api/onboarding/push-company-name', { suggestedName })

      // Poll for confirmation
      const maxRetries = 10
      for (let i = 0; i < maxRetries; i++) {
        const result = (await apiCall(port, 'GET', '/api/onboarding/pending-company-name')) as {
          confirmedName?: string
          timeout?: boolean
        }

        if (!result.timeout) {
          return { confirmedName: result.confirmedName }
        }
      }

      throw new Error('Timed out waiting for company name confirmation')
    }
  )

  // Tool: CompleteOnboarding
  server.registerTool(
    {
      name: 'CompleteOnboarding',
      description: 'Complete the onboarding process and create the company.',
      inputSchema: {
        type: 'object',
        properties: {
          company: { type: 'string' },
          goal: { type: 'string' },
          businessValues: { type: 'string' },
          businessAntiValues: { type: 'string' },
        },
        required: ['company', 'goal', 'businessValues', 'businessAntiValues'],
      },
    },
    async (params) => {
      const result = await apiCall(port, 'POST', '/api/onboarding/complete', {
        company: params.company,
        goal: params.goal,
        businessValues: params.businessValues,
        businessAntiValues: params.businessAntiValues,
      })

      return result
    }
  )

  return server
}

// Main entry point
const { port } = parseArgs()
const server = createOnboardingMCPServer(port)
server.start().catch((err) => {
  console.error('MCP server error:', err)
  process.exit(1)
})
