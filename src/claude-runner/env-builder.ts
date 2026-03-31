import { spawn } from 'node:child_process'

export interface GithubProfile {
  token: string
  name: string
  email: string
}

interface CacheEntry {
  profile: GithubProfile
  expiresAt: number
}

const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

const cache: Map<string, CacheEntry> = new Map()

async function execGhCommand(args: string[], env?: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('gh', args, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim())
      } else {
        reject(new Error(`gh command failed with code ${code}: ${stderr}`))
      }
    })

    proc.on('error', (err) => {
      reject(err)
    })
  })
}

export async function resolveGithubProfile(ghUser: string): Promise<GithubProfile> {
  // Check cache
  const cached = cache.get(ghUser)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.profile
  }

  // Get token
  const token = await execGhCommand(['auth', 'token', '--user', ghUser])

  // Get user info with token
  const ghEnv = { GH_TOKEN: token }
  const name = await execGhCommand(['api', '/user', '--jq', '.name'], ghEnv)
  const email = await execGhCommand(['api', '/user', '--jq', '.email'], ghEnv)

  const profile: GithubProfile = {
    token,
    name: name || ghUser, // fallback to username if name is null
    email: email || `${ghUser}@users.noreply.github.com`, // fallback to noreply email
  }

  // Cache the result
  cache.set(ghUser, {
    profile,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })

  return profile
}

export async function buildEnv(ghUser?: string): Promise<Record<string, string>> {
  if (!ghUser) {
    return {}
  }

  const profile = await resolveGithubProfile(ghUser)

  return {
    GH_TOKEN: profile.token,
    GIT_AUTHOR_NAME: profile.name,
    GIT_AUTHOR_EMAIL: profile.email,
    GIT_COMMITTER_NAME: profile.name,
    GIT_COMMITTER_EMAIL: profile.email,
  }
}

// Export for testing purposes
export function clearCache(): void {
  cache.clear()
}

export function getCacheSize(): number {
  return cache.size
}
