import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { getAgentSubagents, getAgentHooks, listAgentSkillDirs } from '../core/store/agent-store.js'
import { parseSubagentMd } from '../core/utils/frontmatter.js'
import type { SubagentConfig } from '../core/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface BuildFlagsParams {
  rootDir: string
  agentName: string
  prompt?: string
  printMode?: boolean
  passthroughFlags?: string[]
}

export interface BuildFlagsResult {
  flags: string[]
  tmpDir?: string
}

function getContextEngineerConfig(): SubagentConfig {
  const templatePath = path.resolve(__dirname, '../templates/context-engineer.md')
  // Fallback to dist path if running from compiled code
  const distTemplatePath = path.resolve(__dirname, '../../templates/context-engineer.md')

  let content: string
  if (fs.existsSync(templatePath)) {
    content = fs.readFileSync(templatePath, 'utf-8')
  } else if (fs.existsSync(distTemplatePath)) {
    content = fs.readFileSync(distTemplatePath, 'utf-8')
  } else {
    throw new Error(`context-engineer.md template not found at ${templatePath} or ${distTemplatePath}`)
  }

  return parseSubagentMd(content)
}

function subagentConfigToClaudeFormat(config: SubagentConfig): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: config.name,
    description: config.description,
    prompt: config.prompt,
  }

  if (config.model) result.model = config.model
  if (config.tools) result.tools = config.tools
  if (config.maxTurns) result.maxTurns = config.maxTurns
  if (config.disallowedTools) result.disallowedTools = config.disallowedTools
  if (config.permissionMode) result.permissionMode = config.permissionMode

  return result
}

function copySkillsToTmpDir(rootDir: string, agentName: string, tmpDir: string): void {
  const skillNames = listAgentSkillDirs(rootDir, agentName)
  if (skillNames.length === 0) return

  const srcSkillsDir = path.join(rootDir, '.auto-startup', 'agents', agentName, 'skills')
  const destSkillsDir = path.join(tmpDir, '.claude', 'skills')

  for (const skillName of skillNames) {
    const srcSkillPath = path.join(srcSkillsDir, skillName)
    const destSkillPath = path.join(destSkillsDir, skillName)

    fs.mkdirSync(destSkillPath, { recursive: true })

    const entries = fs.readdirSync(srcSkillPath, { withFileTypes: true })
    for (const entry of entries) {
      const srcPath = path.join(srcSkillPath, entry.name)
      const destPath = path.join(destSkillPath, entry.name)

      if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath)
      } else if (entry.isDirectory()) {
        fs.cpSync(srcPath, destPath, { recursive: true })
      }
    }
  }
}

export function buildFlags(params: BuildFlagsParams): BuildFlagsResult {
  const { rootDir, agentName, prompt, printMode, passthroughFlags } = params

  // Validate passthrough flags
  if (passthroughFlags?.some((flag) => flag === '--add-dir' || flag.startsWith('--add-dir='))) {
    throw new Error('--add-dir is not allowed in passthroughFlags. Skills are managed by the agent configuration.')
  }

  const flags: string[] = []
  let tmpDir: string | undefined

  // 1. System prompt
  const promptPath = path.join(rootDir, '.auto-startup', 'agents', agentName, 'prompt.md')
  if (fs.existsSync(promptPath)) {
    flags.push('--append-system-prompt-file', promptPath)
  }

  // 2. Sub-agents with context-engineer always included
  const userSubagents = getAgentSubagents(rootDir, agentName)
  const contextEngineer = getContextEngineerConfig()

  const agentsMap: Record<string, Record<string, unknown>> = {}

  // Add context-engineer first (can be overridden if user defines their own)
  agentsMap[contextEngineer.name] = subagentConfigToClaudeFormat(contextEngineer)

  // Add user-defined subagents (may override context-engineer)
  for (const subagent of userSubagents) {
    agentsMap[subagent.name] = subagentConfigToClaudeFormat(subagent)
  }

  if (Object.keys(agentsMap).length > 0) {
    flags.push('--agents', JSON.stringify(agentsMap))
  }

  // 3. Skills
  const skillNames = listAgentSkillDirs(rootDir, agentName)
  if (skillNames.length > 0) {
    tmpDir = path.join(rootDir, '.auto-startup', '.tmp', `run-${randomUUID()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    copySkillsToTmpDir(rootDir, agentName, tmpDir)
    flags.push('--add-dir', tmpDir)
  }

  // 4. Hooks
  const hooks = getAgentHooks(rootDir, agentName)
  if (hooks) {
    if (!tmpDir) {
      tmpDir = path.join(rootDir, '.auto-startup', '.tmp', `run-${randomUUID()}`)
      fs.mkdirSync(tmpDir, { recursive: true })
    }
    const settingsPath = path.join(tmpDir, 'settings.json')
    fs.writeFileSync(settingsPath, JSON.stringify({ hooks }, null, 2))
    flags.push('--settings', settingsPath)
  }

  // 5. MCP config
  const mcpConfigPath = path.join(rootDir, '.auto-startup', 'agents', agentName, 'mcp.json')
  if (fs.existsSync(mcpConfigPath)) {
    flags.push('--mcp-config', mcpConfigPath)
  }

  // 6. Print mode
  if (printMode) {
    flags.push('--print')
  }

  // 7. Prompt
  if (prompt) {
    flags.push('-p', prompt)
  }

  // 8. Passthrough flags
  if (passthroughFlags && passthroughFlags.length > 0) {
    flags.push(...passthroughFlags)
  }

  return { flags, tmpDir }
}
