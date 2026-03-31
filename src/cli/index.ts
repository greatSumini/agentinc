#!/usr/bin/env node
/**
 * CLI Entry Point
 *
 * Starts either onboarding or normal server based on config.
 * Full CLI implementation will be in Phase 11.
 */

import { startOnboardingServer, startNormalServer } from '../server/index.js'
import { isOnboarded } from '../core/store/config-store.js'
import { Orchestrator } from '../daemon/orchestrator.js'

const port = parseInt(process.env.PORT || '3847', 10)
const rootDir = process.cwd()

async function main() {
  const onboarded = isOnboarded(rootDir)

  if (onboarded) {
    // Normal mode — start with orchestrator
    const orchestrator = new Orchestrator({ rootDir, serverPort: port })
    await orchestrator.start()
    startNormalServer(rootDir, port, orchestrator)
  } else {
    // Onboarding mode
    startOnboardingServer(rootDir, port)
  }
}

main().catch((error) => {
  console.error('Failed to start:', error)
  process.exit(1)
})
