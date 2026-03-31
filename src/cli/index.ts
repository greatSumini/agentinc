#!/usr/bin/env node
/**
 * CLI Entry Point
 *
 * Starts either onboarding or normal server based on config.
 * Manages PID file and graceful shutdown.
 */

import { isOnboarded, getConfig } from '../core/store/config-store.js'
import { startOnboardingServer, startNormalServer } from '../server/index.js'
import { Orchestrator } from '../daemon/orchestrator.js'
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const DEFAULT_PORT = 3847

async function main() {
  const rootDir = process.cwd()
  const config = getConfig(rootDir)
  const port = config?.port ?? DEFAULT_PORT

  console.log('auto-startup starting...')

  // --- Onboarding mode ---
  if (!isOnboarded(rootDir)) {
    console.log('Onboarding required. Starting onboarding server...')
    const { server } = startOnboardingServer(rootDir, port)
    openBrowser(port)

    // Wait for onboarding to complete
    await waitForOnboardingComplete(rootDir)

    // Close onboarding server
    server.close()
    console.log('Onboarding completed. Restarting in normal mode...')
  }

  // --- Normal mode ---
  console.log('Starting dashboard & daemon...')

  // Create PID file
  const pidDir = join(rootDir, '.auto-startup')
  const pidFile = join(pidDir, '.pid')
  mkdirSync(pidDir, { recursive: true })
  writeFileSync(pidFile, String(process.pid))

  // Start Orchestrator
  const orchestrator = new Orchestrator({ rootDir, serverPort: port })

  // Start normal server
  const { server } = startNormalServer(rootDir, port, orchestrator)

  // Start daemon
  await orchestrator.start()

  openBrowser(port)

  console.log(`auto-startup running at http://localhost:${port}`)
  console.log('Press Ctrl+C to stop.')

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...')
    await orchestrator.stop()
    server.close()
    if (existsSync(pidFile)) unlinkSync(pidFile)
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

function openBrowser(port: number) {
  const url = `http://localhost:${port}`
  try {
    // macOS
    execSync(`open ${url}`, { stdio: 'ignore' })
  } catch {
    // Linux
    try {
      execSync(`xdg-open ${url}`, { stdio: 'ignore' })
    } catch {
      console.log(`Open ${url} in your browser.`)
    }
  }
}

async function waitForOnboardingComplete(rootDir: string): Promise<void> {
  // Poll config every 1 second
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (isOnboarded(rootDir)) {
        clearInterval(interval)
        resolve()
      }
    }, 1000)
  })
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
