import type { BackendId, MissionRole } from '../../types.js'

export interface BackendAdapter {
  id: BackendId
  command: string
  args: string[]
  description: string
  roles: MissionRole[]
  strengths: string[]
}

export const BACKEND_ADAPTERS: BackendAdapter[] = [
  {
    id: 'grok',
    command: 'grok',
    args: [],
    description: 'Grok Build CLI',
    roles: ['implementer', 'research'],
    strengths: ['research', 'MCP/skills', 'Vektra integration'],
  },
  {
    id: 'claude',
    command: 'claude',
    args: [],
    description: 'Claude Code',
    roles: ['orchestrator', 'implementer'],
    strengths: ['long reasoning', 'architecture', 'review'],
  },
  {
    id: 'codex',
    command: 'codex',
    args: [],
    description: 'OpenAI Codex CLI',
    roles: ['validator', 'implementer'],
    strengths: ['fast edits', 'validation', 'refactors'],
  },
  {
    id: 'opencode',
    command: 'opencode',
    args: [],
    description: 'OpenCode — open multi-provider agent',
    roles: ['implementer'],
    strengths: ['open source', 'provider choice', 'plan/build modes'],
  },
  {
    id: 'cursor',
    command: 'agent',
    args: [],
    description: 'Cursor CLI',
    roles: ['implementer', 'validator'],
    strengths: ['cloud handoff', 'sandbox', 'IDE parity'],
  },
]

export function getBackendAdapter(id: BackendId): BackendAdapter | undefined {
  return BACKEND_ADAPTERS.find((b) => b.id === id)
}