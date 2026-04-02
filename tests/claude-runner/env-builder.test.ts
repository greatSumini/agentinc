import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as childProcess from 'node:child_process'
import { buildEnv, clearCache, getCacheSize } from '../../src/claude-runner/env-builder'

// Mock child_process.spawn
vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn(),
  }
})

function createMockProcess(stdout: string, exitCode = 0) {
  const stdoutEmitter = {
    on: vi.fn((event: string, callback: (data: Buffer) => void) => {
      if (event === 'data') {
        setTimeout(() => callback(Buffer.from(stdout)), 0)
      }
      return stdoutEmitter
    }),
  }

  const stderrEmitter = {
    on: vi.fn(() => stderrEmitter),
  }

  const processEmitter = {
    stdout: stdoutEmitter,
    stderr: stderrEmitter,
    on: vi.fn((event: string, callback: (code: number) => void) => {
      if (event === 'close') {
        setTimeout(() => callback(exitCode), 10)
      }
      return processEmitter
    }),
  }

  return processEmitter
}

describe('env-builder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearCache()
  })

  afterEach(() => {
    clearCache()
  })

  describe('buildEnv', () => {
    it('ghUser가 없으면 빈 객체 반환', async () => {
      const env = await buildEnv()
      expect(env).toEqual({})
    })

    it('ghUser가 undefined면 빈 객체 반환', async () => {
      const env = await buildEnv(undefined)
      expect(env).toEqual({})
    })

    it('ghUser가 있으면 GitHub 환경변수 반환', async () => {
      // Mock responses for token, name, email
      const mockSpawn = vi.mocked(childProcess.spawn)
      let callCount = 0

      mockSpawn.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // gh auth token
          return createMockProcess('ghp_test_token_12345') as any
        } else if (callCount === 2) {
          // gh api /user --jq .name
          return createMockProcess('Test User') as any
        } else {
          // gh api /user --jq .email
          return createMockProcess('test@example.com') as any
        }
      })

      const env = await buildEnv('testuser')

      expect(env.GH_TOKEN).toBe('ghp_test_token_12345')
      expect(env.GIT_AUTHOR_NAME).toBe('Test User')
      expect(env.GIT_AUTHOR_EMAIL).toBe('test@example.com')
      expect(env.GIT_COMMITTER_NAME).toBe('Test User')
      expect(env.GIT_COMMITTER_EMAIL).toBe('test@example.com')
    })

    it('name이 없으면 username을 fallback으로 사용', async () => {
      const mockSpawn = vi.mocked(childProcess.spawn)
      let callCount = 0

      mockSpawn.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return createMockProcess('ghp_test_token') as any
        } else if (callCount === 2) {
          return createMockProcess('') as any // empty name
        } else {
          return createMockProcess('test@example.com') as any
        }
      })

      const env = await buildEnv('myuser')

      expect(env.GIT_AUTHOR_NAME).toBe('myuser')
      expect(env.GIT_COMMITTER_NAME).toBe('myuser')
    })

    it('email이 없으면 noreply email을 fallback으로 사용', async () => {
      const mockSpawn = vi.mocked(childProcess.spawn)
      let callCount = 0

      mockSpawn.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return createMockProcess('ghp_test_token') as any
        } else if (callCount === 2) {
          return createMockProcess('Test User') as any
        } else {
          return createMockProcess('') as any // empty email
        }
      })

      const env = await buildEnv('myuser')

      expect(env.GIT_AUTHOR_EMAIL).toBe('myuser@users.noreply.github.com')
      expect(env.GIT_COMMITTER_EMAIL).toBe('myuser@users.noreply.github.com')
    })
  })

  describe('캐시 동작', () => {
    it('캐시가 비어있을 때 getCacheSize는 0', () => {
      expect(getCacheSize()).toBe(0)
    })

    it('buildEnv 호출 후 캐시에 저장됨', async () => {
      const mockSpawn = vi.mocked(childProcess.spawn)
      let callCount = 0

      mockSpawn.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return createMockProcess('ghp_token') as any
        } else if (callCount === 2) {
          return createMockProcess('User') as any
        } else {
          return createMockProcess('user@example.com') as any
        }
      })

      await buildEnv('testuser')

      expect(getCacheSize()).toBe(1)
    })

    it('같은 user로 두 번 호출하면 gh는 한 번만 호출됨', async () => {
      const mockSpawn = vi.mocked(childProcess.spawn)
      let callCount = 0

      mockSpawn.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return createMockProcess('ghp_token') as any
        } else if (callCount === 2) {
          return createMockProcess('User') as any
        } else {
          return createMockProcess('user@example.com') as any
        }
      })

      await buildEnv('testuser')
      await buildEnv('testuser')

      // Should only be called 3 times (token, name, email) for the first call
      // Second call should use cache
      expect(mockSpawn).toHaveBeenCalledTimes(3)
    })

    it('clearCache 후 다시 gh 호출됨', async () => {
      const mockSpawn = vi.mocked(childProcess.spawn)
      let callCount = 0

      mockSpawn.mockImplementation(() => {
        callCount++
        const idx = ((callCount - 1) % 3) + 1
        if (idx === 1) {
          return createMockProcess('ghp_token') as any
        } else if (idx === 2) {
          return createMockProcess('User') as any
        } else {
          return createMockProcess('user@example.com') as any
        }
      })

      await buildEnv('testuser')
      expect(mockSpawn).toHaveBeenCalledTimes(3)

      clearCache()
      expect(getCacheSize()).toBe(0)

      await buildEnv('testuser')
      expect(mockSpawn).toHaveBeenCalledTimes(6)
    })
  })
})
