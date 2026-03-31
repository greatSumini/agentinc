import matter from 'gray-matter'
import type { SubagentConfig } from '../types.js'

export function parseSubagentMd(content: string): SubagentConfig {
  const parsed = matter(content)

  if (!parsed.data || Object.keys(parsed.data).length === 0) {
    throw new Error('No frontmatter found')
  }

  if (!parsed.data.name) {
    throw new Error("Invalid frontmatter: missing required field 'name'")
  }

  if (!parsed.data.description) {
    throw new Error("Invalid frontmatter: missing required field 'description'")
  }

  const { name, description, model, tools, maxTurns, disallowedTools, permissionMode } =
    parsed.data as Record<string, unknown>

  return {
    name: name as string,
    description: description as string,
    prompt: parsed.content.trim(),
    model: model as string | undefined,
    tools: tools as string | undefined,
    maxTurns: maxTurns as number | undefined,
    disallowedTools: disallowedTools as string | undefined,
    permissionMode: permissionMode as string | undefined,
  }
}

export function serializeSubagentMd(config: SubagentConfig): string {
  const frontmatterData: Record<string, unknown> = {
    name: config.name,
    description: config.description,
  }

  if (config.model !== undefined) frontmatterData.model = config.model
  if (config.tools !== undefined) frontmatterData.tools = config.tools
  if (config.disallowedTools !== undefined) frontmatterData.disallowedTools = config.disallowedTools
  if (config.maxTurns !== undefined) frontmatterData.maxTurns = config.maxTurns
  if (config.permissionMode !== undefined) frontmatterData.permissionMode = config.permissionMode

  return matter.stringify(config.prompt, frontmatterData)
}
