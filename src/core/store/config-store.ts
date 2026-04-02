import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Config } from '../types.js'

const CONFIG_DIR = '.auto-startup'
const CONFIG_FILE = 'config.json'

function getConfigPath(rootDir: string): string {
  return path.join(rootDir, CONFIG_DIR, CONFIG_FILE)
}

export function getConfig(rootDir: string): Config | null {
  const configPath = getConfigPath(rootDir)
  if (!fs.existsSync(configPath)) {
    return null
  }
  const content = fs.readFileSync(configPath, 'utf-8')
  return JSON.parse(content) as Config
}

export function saveConfig(rootDir: string, config: Config): void {
  const dir = path.join(rootDir, CONFIG_DIR)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const configPath = getConfigPath(rootDir)
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

export function isOnboarded(rootDir: string): boolean {
  const config = getConfig(rootDir)
  return config?.onboardingCompleted === true
}
