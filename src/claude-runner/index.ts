import * as fs from 'node:fs'
import { getAgent } from '../core/store/agent-store.js'
import { buildFlags } from './flag-builder.js'
import { buildEnv } from './env-builder.js'
import { spawnClaude, type SpawnResult } from './spawner.js'

export interface RunClaudeParams {
  rootDir: string
  agentName: string
  prompt?: string
  printMode?: boolean
  passthroughFlags?: string[]
}

export async function runClaude(params: RunClaudeParams): Promise<SpawnResult> {
  const { rootDir, agentName, prompt, printMode, passthroughFlags } = params

  // Get agent config
  const agent = getAgent(rootDir, agentName)
  if (!agent) {
    throw new Error(`Agent '${agentName}' not found`)
  }

  // Build flags
  const { flags, tmpDir } = buildFlags({
    rootDir,
    agentName,
    prompt,
    printMode,
    passthroughFlags,
  })

  // Build environment
  const env = await buildEnv(agent.gh_user)

  try {
    // Spawn Claude CLI
    const result = await spawnClaude(flags, env, {
      cwd: rootDir,
      stdio: printMode ? 'pipe' : 'inherit',
    })

    return result
  } finally {
    // Cleanup temp directory
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// Re-export types and functions for convenience
export type { SpawnResult, SpawnClaudeOptions } from './spawner.js'
export type { BuildFlagsParams, BuildFlagsResult } from './flag-builder.js'
export type { GithubProfile } from './env-builder.js'
export { buildFlags } from './flag-builder.js'
export { buildEnv, resolveGithubProfile } from './env-builder.js'
export { spawnClaude } from './spawner.js'
