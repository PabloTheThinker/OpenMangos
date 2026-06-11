import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { runCommand } from '../../probes/util.js'

export type OpenCodeAuthState = {
  credentialProviders: string[]
  builtinModels: string[]
  authenticated: boolean
  detail?: string
  hint?: string
}

export function parseOpenCodeModelLines(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('opencode/'))
}

export function classifyOpenCodeAuth(
  credentialProviders: string[],
  builtinModels: string[],
): OpenCodeAuthState {
  const authenticated = credentialProviders.length > 0 || builtinModels.length > 0
  if (!authenticated) {
    return {
      credentialProviders,
      builtinModels,
      authenticated: false,
      hint: 'run opencode, then /connect or opencode providers login',
    }
  }

  const parts: string[] = []
  if (credentialProviders.length > 0) {
    parts.push(
      `${credentialProviders.length} provider${credentialProviders.length === 1 ? '' : 's'}`,
    )
  }
  if (builtinModels.length > 0) {
    const freeCount = builtinModels.filter(
      (model) => model.includes('-free') || model.includes('big-pickle'),
    ).length
    parts.push(freeCount > 0 ? 'free models' : 'built-in models')
  }

  return {
    credentialProviders,
    builtinModels,
    authenticated: true,
    detail: parts.join(', '),
  }
}

export async function readOpenCodeCredentialProviders(): Promise<string[]> {
  const authPath = join(homedir(), '.local', 'share', 'opencode', 'auth.json')
  try {
    const raw = JSON.parse(await readFile(authPath, 'utf8')) as Record<string, unknown>
    return Object.keys(raw).filter((key) => !key.startsWith('_'))
  } catch {
    return []
  }
}

export async function listBuiltinOpenCodeModels(cwd = process.cwd()): Promise<string[]> {
  const result = await runCommand('opencode', ['models'], cwd, 15_000)
  if (!result.ok) return []
  return parseOpenCodeModelLines(result.stdout)
}

export async function probeOpenCodeAuth(cwd = process.cwd()): Promise<OpenCodeAuthState> {
  const [credentialProviders, builtinModels] = await Promise.all([
    readOpenCodeCredentialProviders(),
    listBuiltinOpenCodeModels(cwd),
  ])
  return classifyOpenCodeAuth(credentialProviders, builtinModels)
}