/**
 * Orchestrator
 *
 * Manages agent worker processes. Spawns workers for each registered agent
 * and handles IPC communication for status updates.
 */

import { fork, type ChildProcess } from 'node:child_process'
import * as path from 'node:path'
import { listAgents } from '../core/store/agent-store.js'
import type { WorkerMessage } from './agent-worker.js'

export type AgentStatus = 'idle' | 'working' | 'offline'

export interface OrchestratorOptions {
  rootDir: string
  serverPort: number
}

export class Orchestrator {
  private workers: Map<string, ChildProcess> = new Map()
  private agentStatuses: Map<string, AgentStatus> = new Map()
  private isRunning = false

  constructor(private options: OrchestratorOptions) {}

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Orchestrator is already running')
    }

    this.isRunning = true

    // Get all registered agents
    const agents = listAgents(this.options.rootDir)

    if (agents.length === 0) {
      console.log('No agents registered, orchestrator idle')
      return
    }

    // Fork a worker for each agent
    for (const agent of agents) {
      this.forkWorker(agent.name)
    }

    // Setup shutdown handlers
    const shutdown = () => {
      this.stop().catch(console.error)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    console.log(`Orchestrator started with ${agents.length} agent(s)`)
  }

  private forkWorker(agentName: string): ChildProcess {
    // Determine worker script path
    // In production, use compiled JS; in development, the path would be the same
    // since we compile TypeScript before running
    const workerPath = path.join(__dirname, 'agent-worker.js')

    const child = fork(workerPath, [], {
      env: {
        ...process.env,
        AGENT_NAME: agentName,
        ROOT_DIR: this.options.rootDir,
        SERVER_PORT: String(this.options.serverPort),
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    })

    // Initialize status
    this.agentStatuses.set(agentName, 'idle')
    this.workers.set(agentName, child)

    // Handle messages from worker
    child.on('message', (message: WorkerMessage) => {
      if (message.type === 'heartbeat' || message.type === 'status') {
        this.agentStatuses.set(message.agentName, message.status)
      }
    })

    // Handle worker exit
    child.on('exit', (code, signal) => {
      console.log(`Worker ${agentName} exited with code ${code}, signal ${signal}`)
      this.agentStatuses.set(agentName, 'offline')
      this.workers.delete(agentName)
    })

    // Forward stdout/stderr
    child.stdout?.on('data', (data) => {
      console.log(`[${agentName}] ${data.toString().trim()}`)
    })

    child.stderr?.on('data', (data) => {
      console.error(`[${agentName}] ${data.toString().trim()}`)
    })

    console.log(`Forked worker for agent: ${agentName}`)
    return child
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    console.log('Stopping orchestrator...')

    const stopPromises: Promise<void>[] = []

    for (const [agentName, child] of this.workers) {
      stopPromises.push(this.stopWorker(agentName, child))
    }

    await Promise.all(stopPromises)
    console.log('Orchestrator stopped')
  }

  private async stopWorker(agentName: string, child: ChildProcess): Promise<void> {
    return new Promise((resolve) => {
      const KILL_TIMEOUT = 30000 // 30 seconds

      // Send SIGTERM for graceful shutdown
      child.kill('SIGTERM')

      const timeout = setTimeout(() => {
        console.log(`Worker ${agentName} did not exit in time, sending SIGKILL`)
        child.kill('SIGKILL')
      }, KILL_TIMEOUT)

      child.on('exit', () => {
        clearTimeout(timeout)
        resolve()
      })

      // If already exited, resolve immediately
      if (child.exitCode !== null || child.signalCode !== null) {
        clearTimeout(timeout)
        resolve()
      }
    })
  }

  getAgentStatuses(): Map<string, AgentStatus> {
    return new Map(this.agentStatuses)
  }
}
