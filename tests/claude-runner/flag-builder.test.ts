import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { buildFlags } from '../../src/claude-runner/flag-builder'
import { saveAgent, saveAgentPrompt, saveAgentSubagent, saveAgentHooks } from '../../src/core/store/agent-store'
import type { SubagentConfig } from '../../src/core/types'

describe('flag-builder', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-startup-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('buildFlags', () => {
    it('기본 빌드: context-engineer가 항상 포함됨', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      const { flags } = buildFlags({ rootDir: tmpDir, agentName: 'developer' })

      // --agents 플래그가 있어야 함
      const agentsIdx = flags.indexOf('--agents')
      expect(agentsIdx).toBeGreaterThanOrEqual(0)

      const agentsJson = JSON.parse(flags[agentsIdx + 1])
      expect(agentsJson['context-engineer']).toBeDefined()
      expect(agentsJson['context-engineer'].name).toBe('context-engineer')
      expect(agentsJson['context-engineer'].description).toContain('skill')
    })

    it('prompt.md 있을 때 --append-system-prompt-file 포함', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })
      saveAgentPrompt(tmpDir, 'developer', 'You are a developer.')

      const { flags } = buildFlags({ rootDir: tmpDir, agentName: 'developer' })

      const idx = flags.indexOf('--append-system-prompt-file')
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(flags[idx + 1]).toContain('prompt.md')
    })

    it('prompt.md 없을 때 --append-system-prompt-file 없음', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      const { flags } = buildFlags({ rootDir: tmpDir, agentName: 'developer' })

      expect(flags.includes('--append-system-prompt-file')).toBe(false)
    })

    it('사용자 정의 sub-agents가 --agents JSON에 포함됨', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      const subagent: SubagentConfig = {
        name: 'git-expert',
        description: 'Git 전문가',
        prompt: 'You are a git expert.',
        model: 'sonnet',
      }
      saveAgentSubagent(tmpDir, 'developer', subagent)

      const { flags } = buildFlags({ rootDir: tmpDir, agentName: 'developer' })

      const agentsIdx = flags.indexOf('--agents')
      expect(agentsIdx).toBeGreaterThanOrEqual(0)

      const agentsJson = JSON.parse(flags[agentsIdx + 1])
      expect(agentsJson['git-expert']).toBeDefined()
      expect(agentsJson['git-expert'].name).toBe('git-expert')
      expect(agentsJson['git-expert'].description).toBe('Git 전문가')
      expect(agentsJson['git-expert'].prompt).toBe('You are a git expert.')
      expect(agentsJson['git-expert'].model).toBe('sonnet')
    })

    it('사용자가 context-engineer를 재정의할 수 있음', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      const customContextEngineer: SubagentConfig = {
        name: 'context-engineer',
        description: 'Custom context engineer',
        prompt: 'Custom prompt for context engineer.',
      }
      saveAgentSubagent(tmpDir, 'developer', customContextEngineer)

      const { flags } = buildFlags({ rootDir: tmpDir, agentName: 'developer' })

      const agentsIdx = flags.indexOf('--agents')
      const agentsJson = JSON.parse(flags[agentsIdx + 1])

      expect(agentsJson['context-engineer'].description).toBe('Custom context engineer')
      expect(agentsJson['context-engineer'].prompt).toBe('Custom prompt for context engineer.')
    })

    it('skills가 있을 때 --add-dir 포함', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      // Create skills directory with a skill
      const skillsDir = path.join(tmpDir, '.auto-startup', 'agents', 'developer', 'skills', 'deploy')
      fs.mkdirSync(skillsDir, { recursive: true })
      fs.writeFileSync(path.join(skillsDir, 'SKILL.md'), '# Deploy skill')

      const { flags, tmpDir: resultTmpDir } = buildFlags({ rootDir: tmpDir, agentName: 'developer' })

      expect(flags.includes('--add-dir')).toBe(true)
      expect(resultTmpDir).toBeDefined()

      // Verify skill was copied
      const copiedSkillPath = path.join(resultTmpDir!, '.claude', 'skills', 'deploy', 'SKILL.md')
      expect(fs.existsSync(copiedSkillPath)).toBe(true)

      // Cleanup
      fs.rmSync(resultTmpDir!, { recursive: true, force: true })
    })

    it('skills가 없을 때 --add-dir 없음', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      const { flags } = buildFlags({ rootDir: tmpDir, agentName: 'developer' })

      expect(flags.includes('--add-dir')).toBe(false)
    })

    it('hooks.json이 있을 때 --settings 포함', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      const hooks = {
        PreToolUse: [
          {
            matcher: 'Edit|Write',
            hooks: [{ type: 'command', command: 'echo "editing"' }],
          },
        ],
      }
      saveAgentHooks(tmpDir, 'developer', hooks)

      const { flags, tmpDir: resultTmpDir } = buildFlags({ rootDir: tmpDir, agentName: 'developer' })

      expect(flags.includes('--settings')).toBe(true)
      expect(resultTmpDir).toBeDefined()

      // Verify settings.json was created
      const settingsPath = path.join(resultTmpDir!, 'settings.json')
      expect(fs.existsSync(settingsPath)).toBe(true)

      const settingsContent = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      expect(settingsContent.hooks).toEqual(hooks)

      // Cleanup
      fs.rmSync(resultTmpDir!, { recursive: true, force: true })
    })

    it('hooks.json이 없을 때 --settings 없음 (skills도 없을 때)', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      const { flags, tmpDir: resultTmpDir } = buildFlags({ rootDir: tmpDir, agentName: 'developer' })

      expect(flags.includes('--settings')).toBe(false)
      expect(resultTmpDir).toBeUndefined()
    })

    it('mcp.json이 있을 때 --mcp-config 포함', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      const mcpConfigPath = path.join(tmpDir, '.auto-startup', 'agents', 'developer', 'mcp.json')
      fs.writeFileSync(mcpConfigPath, JSON.stringify({ servers: {} }))

      const { flags } = buildFlags({ rootDir: tmpDir, agentName: 'developer' })

      const idx = flags.indexOf('--mcp-config')
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(flags[idx + 1]).toContain('mcp.json')
    })

    it('printMode가 true이면 --print 포함', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      const { flags } = buildFlags({ rootDir: tmpDir, agentName: 'developer', printMode: true })

      expect(flags.includes('--print')).toBe(true)
    })

    it('printMode가 false이면 --print 없음', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      const { flags } = buildFlags({ rootDir: tmpDir, agentName: 'developer', printMode: false })

      expect(flags.includes('--print')).toBe(false)
    })

    it('prompt가 있으면 -p 플래그 포함', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      const { flags } = buildFlags({ rootDir: tmpDir, agentName: 'developer', prompt: 'Hello world' })

      const idx = flags.indexOf('-p')
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(flags[idx + 1]).toBe('Hello world')
    })

    it('passthroughFlags가 있으면 그대로 전달', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      const { flags } = buildFlags({
        rootDir: tmpDir,
        agentName: 'developer',
        passthroughFlags: ['--verbose', '--dangerously-skip-permissions'],
      })

      expect(flags.includes('--verbose')).toBe(true)
      expect(flags.includes('--dangerously-skip-permissions')).toBe(true)
    })

    it('passthroughFlags에 --add-dir이 있으면 에러', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      expect(() =>
        buildFlags({
          rootDir: tmpDir,
          agentName: 'developer',
          passthroughFlags: ['--add-dir', '/some/path'],
        })
      ).toThrow('--add-dir is not allowed')
    })

    it('passthroughFlags에 --add-dir=xxx가 있으면 에러', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })

      expect(() =>
        buildFlags({
          rootDir: tmpDir,
          agentName: 'developer',
          passthroughFlags: ['--add-dir=/some/path'],
        })
      ).toThrow('--add-dir is not allowed')
    })

    it('플래그 순서: system prompt → agents → add-dir → settings → mcp-config → print → prompt → passthrough', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev agent' })
      saveAgentPrompt(tmpDir, 'developer', 'System prompt')

      const subagent: SubagentConfig = {
        name: 'helper',
        description: 'Helper',
        prompt: 'Help',
      }
      saveAgentSubagent(tmpDir, 'developer', subagent)

      // Create skills
      const skillsDir = path.join(tmpDir, '.auto-startup', 'agents', 'developer', 'skills', 'test')
      fs.mkdirSync(skillsDir, { recursive: true })
      fs.writeFileSync(path.join(skillsDir, 'SKILL.md'), '# Test')

      // Create hooks
      saveAgentHooks(tmpDir, 'developer', { PreToolUse: [] })

      // Create mcp.json
      const mcpPath = path.join(tmpDir, '.auto-startup', 'agents', 'developer', 'mcp.json')
      fs.writeFileSync(mcpPath, '{}')

      const { flags, tmpDir: resultTmpDir } = buildFlags({
        rootDir: tmpDir,
        agentName: 'developer',
        printMode: true,
        prompt: 'Test prompt',
        passthroughFlags: ['--verbose'],
      })

      // Check order
      const systemPromptIdx = flags.indexOf('--append-system-prompt-file')
      const agentsIdx = flags.indexOf('--agents')
      const addDirIdx = flags.indexOf('--add-dir')
      const settingsIdx = flags.indexOf('--settings')
      const mcpConfigIdx = flags.indexOf('--mcp-config')
      const printIdx = flags.indexOf('--print')
      const promptIdx = flags.indexOf('-p')
      const verboseIdx = flags.indexOf('--verbose')

      expect(systemPromptIdx).toBeLessThan(agentsIdx)
      expect(agentsIdx).toBeLessThan(addDirIdx)
      expect(addDirIdx).toBeLessThan(settingsIdx)
      expect(settingsIdx).toBeLessThan(mcpConfigIdx)
      expect(mcpConfigIdx).toBeLessThan(printIdx)
      expect(printIdx).toBeLessThan(promptIdx)
      expect(promptIdx).toBeLessThan(verboseIdx)

      // Cleanup
      fs.rmSync(resultTmpDir!, { recursive: true, force: true })
    })
  })
})
