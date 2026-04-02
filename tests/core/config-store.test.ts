import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { getConfig, saveConfig, isOnboarded } from '../../src/core/store/config-store'
import type { Config } from '../../src/core/types'

describe('config-store', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-startup-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('getConfig', () => {
    it('config 파일이 없으면 null 반환', () => {
      const config = getConfig(tmpDir)
      expect(config).toBeNull()
    })

    it('config 파일이 있으면 정상 반환', () => {
      const configDir = path.join(tmpDir, '.auto-startup')
      fs.mkdirSync(configDir, { recursive: true })
      const testConfig: Config = {
        company: 'Test Corp',
        persona: 'elon-musk',
        onboardingCompleted: true,
        port: 3847,
      }
      fs.writeFileSync(
        path.join(configDir, 'config.json'),
        JSON.stringify(testConfig)
      )

      const config = getConfig(tmpDir)

      expect(config).not.toBeNull()
      expect(config!.company).toBe('Test Corp')
      expect(config!.persona).toBe('elon-musk')
      expect(config!.onboardingCompleted).toBe(true)
      expect(config!.port).toBe(3847)
    })
  })

  describe('saveConfig', () => {
    it('디렉토리 자동 생성 후 config 저장', () => {
      const testConfig: Config = {
        company: 'New Company',
        persona: 'steve-jobs',
        onboardingCompleted: false,
        port: 4000,
      }

      saveConfig(tmpDir, testConfig)

      const configPath = path.join(tmpDir, '.auto-startup', 'config.json')
      expect(fs.existsSync(configPath)).toBe(true)

      const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      expect(saved.company).toBe('New Company')
      expect(saved.persona).toBe('steve-jobs')
      expect(saved.onboardingCompleted).toBe(false)
      expect(saved.port).toBe(4000)
    })

    it('기존 config 덮어쓰기', () => {
      const config1: Config = {
        company: 'Company 1',
        persona: 'bill-gates',
        onboardingCompleted: false,
        port: 3847,
      }
      const config2: Config = {
        company: 'Company 2',
        persona: 'peter-thiel',
        onboardingCompleted: true,
        port: 5000,
      }

      saveConfig(tmpDir, config1)
      saveConfig(tmpDir, config2)

      const config = getConfig(tmpDir)
      expect(config!.company).toBe('Company 2')
      expect(config!.persona).toBe('peter-thiel')
      expect(config!.onboardingCompleted).toBe(true)
    })
  })

  describe('isOnboarded', () => {
    it('config 파일 없으면 false', () => {
      expect(isOnboarded(tmpDir)).toBe(false)
    })

    it('onboardingCompleted가 false이면 false', () => {
      const testConfig: Config = {
        company: 'Test',
        persona: 'elon-musk',
        onboardingCompleted: false,
        port: 3847,
      }
      saveConfig(tmpDir, testConfig)

      expect(isOnboarded(tmpDir)).toBe(false)
    })

    it('onboardingCompleted가 true이면 true', () => {
      const testConfig: Config = {
        company: 'Test',
        persona: 'elon-musk',
        onboardingCompleted: true,
        port: 3847,
      }
      saveConfig(tmpDir, testConfig)

      expect(isOnboarded(tmpDir)).toBe(true)
    })
  })
})
