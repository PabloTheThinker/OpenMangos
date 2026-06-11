import type { BackendId, MissionRole, OpenMangosConfig } from '../types.js'

export interface RoleAssignment {
  role: MissionRole
  backend: BackendId
  reason: string
}

const DEFAULT_ROLE_BACKENDS: Record<MissionRole, BackendId> = {
  orchestrator: 'claude',
  implementer: 'grok',
  validator: 'codex',
  research: 'grok',
}

const ROLE_DESCRIPTIONS: Record<MissionRole, string> = {
  orchestrator: 'Planning, coordination, re-scoping (Factory: Opus)',
  implementer: 'Feature implementation, refactoring (Factory: Sonnet)',
  validator: 'Regression detection, verification (Factory: Codex)',
  research: 'Exploration, API/docs research (Factory: Kimi)',
}

export function resolveRoleBackends(
  available: BackendId[],
  config: OpenMangosConfig = {},
): RoleAssignment[] {
  const configured = config.backends?.roles ?? {}
  const roles = Object.keys(DEFAULT_ROLE_BACKENDS) as MissionRole[]

  return roles.map((role) => {
    const preferred = configured[role] ?? DEFAULT_ROLE_BACKENDS[role]
    const backend = available.includes(preferred) ? preferred : available[0] ?? preferred
    const reason =
      backend === preferred ?
        ROLE_DESCRIPTIONS[role]
      : `${preferred} not on PATH → ${backend}`
    return { role, backend, reason }
  })
}