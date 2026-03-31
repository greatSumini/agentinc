/**
 * MCP Protocol
 *
 * JSON-RPC over stdin/stdout handling for MCP servers.
 */

import * as readline from 'node:readline'

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface MCPToolHandler {
  (params: Record<string, unknown>): Promise<unknown>
}

interface JSONRPCRequest {
  jsonrpc: '2.0'
  id?: number
  method: string
  params?: Record<string, unknown>
}

interface JSONRPCResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: {
    code: number
    message: string
  }
}

export class MCPServer {
  private tools: Map<string, { definition: MCPTool; handler: MCPToolHandler }> = new Map()

  registerTool(tool: MCPTool, handler: MCPToolHandler): void {
    this.tools.set(tool.name, { definition: tool, handler })
  }

  async start(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    })

    for await (const line of rl) {
      if (!line.trim()) continue

      try {
        const request = JSON.parse(line) as JSONRPCRequest
        await this.handleRequest(request)
      } catch (error) {
        // Parse error
        this.sendError(0, -32700, `Parse error: ${(error as Error).message}`)
      }
    }
  }

  private async handleRequest(request: JSONRPCRequest): Promise<void> {
    const { id, method, params } = request

    // Notifications (no id) don't require a response
    if (id === undefined) {
      // Handle notification methods silently
      if (method === 'notifications/initialized') {
        // ACK not required
      }
      return
    }

    try {
      switch (method) {
        case 'initialize':
          this.sendResult(id, {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: 'auto-startup-mcp',
              version: '1.0.0',
            },
            capabilities: {
              tools: {},
            },
          })
          break

        case 'tools/list':
          this.sendResult(id, {
            tools: Array.from(this.tools.values()).map(({ definition }) => definition),
          })
          break

        case 'tools/call': {
          const toolName = (params as { name: string })?.name
          const toolParams = (params as { arguments?: Record<string, unknown> })?.arguments ?? {}

          const tool = this.tools.get(toolName)
          if (!tool) {
            this.sendError(id, -32601, `Tool not found: ${toolName}`)
            return
          }

          const result = await tool.handler(toolParams)
          this.sendResult(id, {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          })
          break
        }

        default:
          this.sendError(id, -32601, `Method not found: ${method}`)
      }
    } catch (error) {
      this.sendError(id, -32603, `Internal error: ${(error as Error).message}`)
    }
  }

  private sendResult(id: number, result: unknown): void {
    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      id,
      result,
    }
    console.log(JSON.stringify(response))
  }

  private sendError(id: number, code: number, message: string): void {
    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message },
    }
    console.log(JSON.stringify(response))
  }
}
