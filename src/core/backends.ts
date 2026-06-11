import { runCommand } from '../probes/util.js'
import type { BackendId } from '../types.js'

interface BackendSpec {
  id: BackendId
  command: string
  args: string[]
  description: string
}

const BACKENDS: BackendSpec[] = [
  { id: 'grok', command: 'grok', args: [], description: 'Grok Build CLI' },
  { id: 'claude', command: 'claude', args: [], description: 'Claude Code' },
  { id: 'opencode', command: 'opencode', args: [], description: 'OpenCode' },
  { id: 'codex', command: 'codex', args: [], description: 'OpenAI Codex CLI' },
  { id: 'cursor', command: 'agent', args: [], description: 'Cursor CLI (agent)' },
]

export async function detectAvailableBackends(): Promise<BackendId[]> {
  const available: BackendId[] = []
  for (const backend of BACKENDS) {
    const which =
      process.platform === 'win32' ?
        await runCommand('where', [backend.command], process.cwd(), 2000)
      : await runCommand('which', [backend.command], process.cwd(), 2000)
    if (which.ok && which.stdout) available.push(backend.id)
  }
  return available
}

export function getBackendSpec(id: BackendId): BackendSpec | undefined {
  return BACKENDS.find((b) => b.id === id)
}

export function isBackendId(value: string): value is BackendId {
  return BACKENDS.some((b) => b.id === value)
}