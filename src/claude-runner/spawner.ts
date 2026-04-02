import { spawn } from 'node:child_process'

export interface SpawnResult {
  exitCode: number
  stdout: string
  stderr: string
}

export interface SpawnClaudeOptions {
  cwd?: string
  stdio?: 'inherit' | 'pipe'
}

export async function spawnClaude(
  flags: string[],
  env: Record<string, string>,
  options?: SpawnClaudeOptions
): Promise<SpawnResult> {
  const { cwd, stdio = 'inherit' } = options || {}

  return new Promise((resolve, reject) => {
    const spawnOpts: import('node:child_process').SpawnOptions = {
      env: { ...process.env, ...env },
      cwd,
      stdio: stdio === 'inherit' ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    }

    const proc = spawn('claude', flags, spawnOpts)

    let stdout = ''
    let stderr = ''

    if (stdio === 'pipe') {
      proc.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr?.on('data', (data) => {
        stderr += data.toString()
      })
    }

    proc.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      })
    })

    proc.on('error', (err) => {
      reject(err)
    })
  })
}
