import { homedir } from 'node:os'
import { join } from 'node:path'
import { runCommand } from '../../probes/util.js'
import { pathExists } from '../../probes/util.js'
import type { BackendId } from '../../types.js'
import { probeOpenCodeAuth } from './opencode-auth.js'

export type BackendAuthStatus = {
  backend: BackendId
  installed: boolean
  authenticated: boolean
  detail?: string
  hint?: string
}

async function grokAuth(): Promise<BackendAuthStatus> {
  const installed = (await runCommand('which', ['grok'], process.cwd(), 2000)).ok
  if (!installed) return { backend: 'grok', installed: false, authenticated: false }

  const hasEnv = Boolean(process.env.XAI_API_KEY || process.env.GROK_API_KEY)
  const hasDir = await pathExists(join(homedir(), '.grok'))
  const hasSessions = await pathExists(join(homedir(), '.grok', 'active_sessions.json'))
  const authenticated = hasEnv || hasSessions
  return {
    backend: 'grok',
    installed: true,
    authenticated,
    hint: authenticated ? undefined : 'run grok and sign in',
  }
}

async function claudeAuth(): Promise<BackendAuthStatus> {
  const installed = (await runCommand('which', ['claude'], process.cwd(), 2000)).ok
  if (!installed) return { backend: 'claude', installed: false, authenticated: false }

  const hasEnv = Boolean(process.env.ANTHROPIC_API_KEY)
  const hasConfig =
    (await pathExists(join(homedir(), '.claude.json'))) ||
    (await pathExists(join(homedir(), '.config', 'claude')))
  return {
    backend: 'claude',
    installed: true,
    authenticated: hasEnv || hasConfig,
    hint: hasEnv || hasConfig ? undefined : 'run claude and authenticate',
  }
}

async function opencodeAuth(): Promise<BackendAuthStatus> {
  const installed = (await runCommand('which', ['opencode'], process.cwd(), 2000)).ok
  if (!installed) return { backend: 'opencode', installed: false, authenticated: false }

  const auth = await probeOpenCodeAuth(process.cwd())
  return {
    backend: 'opencode',
    installed: true,
    authenticated: auth.authenticated,
    detail: auth.detail,
    hint: auth.hint,
  }
}

async function codexAuth(): Promise<BackendAuthStatus> {
  const installed = (await runCommand('which', ['codex'], process.cwd(), 2000)).ok
  if (!installed) return { backend: 'codex', installed: false, authenticated: false }

  const authenticated = Boolean(process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY)
  return {
    backend: 'codex',
    installed: true,
    authenticated,
    hint: authenticated ? undefined : 'set OPENAI_API_KEY or run codex login',
  }
}

async function cursorAuth(): Promise<BackendAuthStatus> {
  const installed = (await runCommand('which', ['agent'], process.cwd(), 2000)).ok
  return {
    backend: 'cursor',
    installed,
    authenticated: installed,
    hint: installed ? undefined : 'install Cursor CLI (agent)',
  }
}

export async function probeBackendAuth(): Promise<BackendAuthStatus[]> {
  return Promise.all([grokAuth(), claudeAuth(), opencodeAuth(), codexAuth(), cursorAuth()])
}

export function backendAuthLines(statuses: BackendAuthStatus[]): string[] {
  const lines: string[] = []
  for (const status of statuses) {
    if (!status.installed) continue
    if (status.authenticated) {
      lines.push(
        status.detail ? `✓ ${status.backend} auth (${status.detail})` : `✓ ${status.backend} auth`,
      )
    } else {
      lines.push(`⚠ ${status.backend} not authenticated`)
      if (status.hint) lines.push(`  ${status.hint}`)
    }
  }
  return lines
}