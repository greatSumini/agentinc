import { describe, it, expect } from 'vitest'
import { parseSubagentMd, serializeSubagentMd } from '../../src/core/utils/frontmatter'

describe('frontmatter utils', () => {
  describe('parseSubagentMd', () => {
    it('정상적인 frontmatter + body → name, description, prompt 추출', () => {
      const content = `---
name: git-expert
description: Git 버전 관리 전문가
---

You are a Git version control expert.
Help users with git commands and best practices.`

      const result = parseSubagentMd(content)

      expect(result.name).toBe('git-expert')
      expect(result.description).toBe('Git 버전 관리 전문가')
      expect(result.prompt).toBe(
        'You are a Git version control expert.\nHelp users with git commands and best practices.'
      )
    })

    it('optional 필드(model, tools, maxTurns) 포함 → 해당 필드 파싱', () => {
      const content = `---
name: code-reviewer
description: 코드 리뷰 전문가
model: sonnet
tools: Read, Glob, Grep
disallowedTools: Write, Bash
maxTurns: 10
permissionMode: auto
---

You are a code review expert.`

      const result = parseSubagentMd(content)

      expect(result.name).toBe('code-reviewer')
      expect(result.description).toBe('코드 리뷰 전문가')
      expect(result.model).toBe('sonnet')
      expect(result.tools).toBe('Read, Glob, Grep')
      expect(result.disallowedTools).toBe('Write, Bash')
      expect(result.maxTurns).toBe(10)
      expect(result.permissionMode).toBe('auto')
      expect(result.prompt).toBe('You are a code review expert.')
    })

    it('name 필드 누락 → 에러', () => {
      const content = `---
description: 설명만 있는 잘못된 파일
---

Some prompt content.`

      expect(() => parseSubagentMd(content)).toThrow(
        "Invalid frontmatter: missing required field 'name'"
      )
    })

    it('description 필드 누락 → 에러', () => {
      const content = `---
name: no-desc
---

Some prompt.`

      expect(() => parseSubagentMd(content)).toThrow(
        "Invalid frontmatter: missing required field 'description'"
      )
    })

    it('frontmatter 없는 순수 마크다운 → 에러', () => {
      const content = `# Git Expert

This is just a plain markdown file without frontmatter.`

      expect(() => parseSubagentMd(content)).toThrow('No frontmatter found')
    })

    it('빈 body → prompt가 빈 문자열', () => {
      const content = `---
name: empty-prompt
description: 빈 프롬프트 테스트
---
`

      const result = parseSubagentMd(content)

      expect(result.name).toBe('empty-prompt')
      expect(result.description).toBe('빈 프롬프트 테스트')
      expect(result.prompt).toBe('')
    })
  })

  describe('serializeSubagentMd', () => {
    it('subagent serialize 후 parse → 원본과 동일 (round-trip)', () => {
      const original = {
        name: 'git-expert',
        description: 'Git 버전 관리 전문가',
        prompt: 'You are a Git expert.\nHelp with version control.',
        model: 'sonnet',
        tools: 'Read, Glob',
        maxTurns: 5,
      }

      const serialized = serializeSubagentMd(original)
      const parsed = parseSubagentMd(serialized)

      expect(parsed.name).toBe(original.name)
      expect(parsed.description).toBe(original.description)
      expect(parsed.prompt).toBe(original.prompt)
      expect(parsed.model).toBe(original.model)
      expect(parsed.tools).toBe(original.tools)
      expect(parsed.maxTurns).toBe(original.maxTurns)
    })

    it('undefined optional 필드는 직렬화 시 생략', () => {
      const config = {
        name: 'minimal',
        description: '최소 설정',
        prompt: 'Minimal prompt.',
        model: undefined,
        tools: undefined,
      }

      const serialized = serializeSubagentMd(config)

      expect(serialized).not.toContain('model:')
      expect(serialized).not.toContain('tools:')
      expect(serialized).toContain('name: minimal')
      expect(serialized).toContain('description: 최소 설정')
    })

    it('빈 prompt → frontmatter만 생성', () => {
      const config = {
        name: 'no-body',
        description: '본문 없음',
        prompt: '',
      }

      const serialized = serializeSubagentMd(config)
      const parsed = parseSubagentMd(serialized)

      expect(parsed.name).toBe('no-body')
      expect(parsed.prompt).toBe('')
    })
  })
})
