import * as fs from 'node:fs'
import * as path from 'node:path'
import type { AgentConfig, SubagentConfig } from '../types.js'
import { parseSubagentMd, serializeSubagentMd } from '../utils/frontmatter.js'

const CONFIG_DIR = '.auto-startup'
const AGENTS_DIR = 'agents'

function getAgentsBasePath(rootDir: string): string {
  return path.join(rootDir, CONFIG_DIR, AGENTS_DIR)
}

function getAgentPath(rootDir: string, name: string): string {
  return path.join(getAgentsBasePath(rootDir), name)
}

export function getAgent(rootDir: string, name: string): AgentConfig | null {
  const agentJsonPath = path.join(getAgentPath(rootDir, name), 'agent.json')
  if (!fs.existsSync(agentJsonPath)) {
    return null
  }
  const content = fs.readFileSync(agentJsonPath, 'utf-8')
  return JSON.parse(content) as AgentConfig
}

export function saveAgent(rootDir: string, name: string, config: AgentConfig): void {
  const agentDir = getAgentPath(rootDir, name)
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true })
  }
  const agentJsonPath = path.join(agentDir, 'agent.json')
  fs.writeFileSync(agentJsonPath, JSON.stringify(config, null, 2))
}

export function listAgents(rootDir: string): AgentConfig[] {
  const agentsDir = getAgentsBasePath(rootDir)
  if (!fs.existsSync(agentsDir)) {
    return []
  }
  const entries = fs.readdirSync(agentsDir, { withFileTypes: true })
  const agents: AgentConfig[] = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const config = getAgent(rootDir, entry.name)
      if (config) {
        agents.push(config)
      }
    }
  }
  return agents
}

export function getAgentPrompt(rootDir: string, name: string): string | null {
  const promptPath = path.join(getAgentPath(rootDir, name), 'prompt.md')
  if (!fs.existsSync(promptPath)) {
    return null
  }
  return fs.readFileSync(promptPath, 'utf-8')
}

export function saveAgentPrompt(rootDir: string, name: string, content: string): void {
  const agentDir = getAgentPath(rootDir, name)
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true })
  }
  const promptPath = path.join(agentDir, 'prompt.md')
  fs.writeFileSync(promptPath, content)
}

export function getAgentSubagents(rootDir: string, name: string): SubagentConfig[] {
  const subagentsDir = path.join(getAgentPath(rootDir, name), 'agents')
  if (!fs.existsSync(subagentsDir)) {
    return []
  }
  const files = fs.readdirSync(subagentsDir).filter((f) => f.endsWith('.md'))
  const subagents: SubagentConfig[] = []
  for (const file of files) {
    const content = fs.readFileSync(path.join(subagentsDir, file), 'utf-8')
    subagents.push(parseSubagentMd(content))
  }
  return subagents
}

export function saveAgentSubagent(rootDir: string, name: string, subagent: SubagentConfig): void {
  const subagentsDir = path.join(getAgentPath(rootDir, name), 'agents')
  if (!fs.existsSync(subagentsDir)) {
    fs.mkdirSync(subagentsDir, { recursive: true })
  }
  const filePath = path.join(subagentsDir, `${subagent.name}.md`)
  fs.writeFileSync(filePath, serializeSubagentMd(subagent))
}

export function getAgentHooks(rootDir: string, name: string): Record<string, unknown> | null {
  const hooksPath = path.join(getAgentPath(rootDir, name), 'hooks.json')
  if (!fs.existsSync(hooksPath)) {
    return null
  }
  const content = fs.readFileSync(hooksPath, 'utf-8')
  return JSON.parse(content) as Record<string, unknown>
}

export function saveAgentHooks(rootDir: string, name: string, hooks: Record<string, unknown>): void {
  const agentDir = getAgentPath(rootDir, name)
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true })
  }
  const hooksPath = path.join(agentDir, 'hooks.json')
  fs.writeFileSync(hooksPath, JSON.stringify(hooks, null, 2))
}

export function listAgentSkillDirs(rootDir: string, name: string): string[] {
  const skillsDir = path.join(getAgentPath(rootDir, name), 'skills')
  if (!fs.existsSync(skillsDir)) {
    return []
  }
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}
