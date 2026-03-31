import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  getAgent,
  saveAgent,
  listAgents,
  getAgentPrompt,
  saveAgentPrompt,
  getAgentSubagents,
  saveAgentSubagent,
  getAgentHooks,
  saveAgentHooks,
  listAgentSkillDirs,
} from '../../src/core/store/agent-store'
import type { AgentConfig, SubagentConfig } from '../../src/core/types'

describe('agent-store', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-startup-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('getAgent / saveAgent', () => {
    it('agent가 없으면 null 반환', () => {
      const agent = getAgent(tmpDir, 'nonexistent')
      expect(agent).toBeNull()
    })

    it('agent 저장 후 읽기', () => {
      const config: AgentConfig = {
        name: 'developer',
        description: '개발자 에이전트',
        gh_user: 'devuser',
        can_delegate: true,
      }

      saveAgent(tmpDir, 'developer', config)
      const loaded = getAgent(tmpDir, 'developer')

      expect(loaded).not.toBeNull()
      expect(loaded!.name).toBe('developer')
      expect(loaded!.description).toBe('개발자 에이전트')
      expect(loaded!.gh_user).toBe('devuser')
      expect(loaded!.can_delegate).toBe(true)
    })

    it('agent 업데이트', () => {
      const config1: AgentConfig = {
        name: 'developer',
        description: 'Original',
      }
      const config2: AgentConfig = {
        name: 'developer',
        description: 'Updated',
        can_delegate: true,
      }

      saveAgent(tmpDir, 'developer', config1)
      saveAgent(tmpDir, 'developer', config2)

      const loaded = getAgent(tmpDir, 'developer')
      expect(loaded!.description).toBe('Updated')
      expect(loaded!.can_delegate).toBe(true)
    })
  })

  describe('listAgents', () => {
    it('agents가 없으면 빈 배열', () => {
      const agents = listAgents(tmpDir)
      expect(agents).toEqual([])
    })

    it('여러 agent 목록 반환', () => {
      saveAgent(tmpDir, 'agent1', { name: 'agent1', description: 'Agent 1' })
      saveAgent(tmpDir, 'agent2', { name: 'agent2', description: 'Agent 2' })
      saveAgent(tmpDir, 'agent3', { name: 'agent3', description: 'Agent 3' })

      const agents = listAgents(tmpDir)

      expect(agents).toHaveLength(3)
      const names = agents.map((a) => a.name).sort()
      expect(names).toEqual(['agent1', 'agent2', 'agent3'])
    })
  })

  describe('getAgentPrompt / saveAgentPrompt', () => {
    it('prompt가 없으면 null 반환', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev' })
      const prompt = getAgentPrompt(tmpDir, 'developer')
      expect(prompt).toBeNull()
    })

    it('prompt 저장 후 읽기', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev' })
      saveAgentPrompt(tmpDir, 'developer', 'You are a helpful developer.')

      const prompt = getAgentPrompt(tmpDir, 'developer')
      expect(prompt).toBe('You are a helpful developer.')
    })
  })

  describe('getAgentSubagents / saveAgentSubagent', () => {
    it('subagents가 없으면 빈 배열', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev' })
      const subagents = getAgentSubagents(tmpDir, 'developer')
      expect(subagents).toEqual([])
    })

    it('subagent 저장 후 읽기', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev' })

      const subagent: SubagentConfig = {
        name: 'git-expert',
        description: 'Git 전문가',
        prompt: 'You are a git expert.',
        model: 'sonnet',
      }
      saveAgentSubagent(tmpDir, 'developer', subagent)

      const subagents = getAgentSubagents(tmpDir, 'developer')
      expect(subagents).toHaveLength(1)
      expect(subagents[0].name).toBe('git-expert')
      expect(subagents[0].description).toBe('Git 전문가')
      expect(subagents[0].prompt).toBe('You are a git expert.')
      expect(subagents[0].model).toBe('sonnet')
    })

    it('여러 subagent 저장 후 읽기', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev' })

      saveAgentSubagent(tmpDir, 'developer', {
        name: 'git-expert',
        description: 'Git 전문가',
        prompt: 'Git prompt',
      })
      saveAgentSubagent(tmpDir, 'developer', {
        name: 'code-reviewer',
        description: '코드 리뷰어',
        prompt: 'Review prompt',
      })

      const subagents = getAgentSubagents(tmpDir, 'developer')
      expect(subagents).toHaveLength(2)
      const names = subagents.map((s) => s.name).sort()
      expect(names).toEqual(['code-reviewer', 'git-expert'])
    })

    it('frontmatter MD 형식으로 저장 확인', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev' })

      const subagent: SubagentConfig = {
        name: 'git-expert',
        description: 'Git 전문가',
        prompt: 'You are a git expert.',
      }
      saveAgentSubagent(tmpDir, 'developer', subagent)

      const filePath = path.join(
        tmpDir,
        '.auto-startup',
        'agents',
        'developer',
        'agents',
        'git-expert.md'
      )
      expect(fs.existsSync(filePath)).toBe(true)

      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('---')
      expect(content).toContain('name: git-expert')
      expect(content).toContain('description: Git 전문가')
      expect(content).toContain('You are a git expert.')
    })
  })

  describe('getAgentHooks / saveAgentHooks', () => {
    it('hooks가 없으면 null 반환', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev' })
      const hooks = getAgentHooks(tmpDir, 'developer')
      expect(hooks).toBeNull()
    })

    it('hooks 저장 후 읽기', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev' })

      const hooks = {
        PreToolUse: [
          {
            matcher: 'Edit|Write',
            hooks: [{ type: 'command', command: 'echo "editing"' }],
          },
        ],
      }
      saveAgentHooks(tmpDir, 'developer', hooks)

      const loaded = getAgentHooks(tmpDir, 'developer')
      expect(loaded).not.toBeNull()
      expect(loaded!.PreToolUse).toBeDefined()
    })
  })

  describe('listAgentSkillDirs', () => {
    it('skills 디렉토리가 없으면 빈 배열', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev' })
      const skills = listAgentSkillDirs(tmpDir, 'developer')
      expect(skills).toEqual([])
    })

    it('skills 하위 디렉토리명 목록 반환', () => {
      saveAgent(tmpDir, 'developer', { name: 'developer', description: 'Dev' })

      const skillsDir = path.join(tmpDir, '.auto-startup', 'agents', 'developer', 'skills')
      fs.mkdirSync(path.join(skillsDir, 'deploy'), { recursive: true })
      fs.mkdirSync(path.join(skillsDir, 'test'), { recursive: true })
      fs.writeFileSync(path.join(skillsDir, 'README.md'), 'ignore this file')

      const skills = listAgentSkillDirs(tmpDir, 'developer')
      expect(skills).toHaveLength(2)
      expect(skills.sort()).toEqual(['deploy', 'test'])
    })
  })
})
