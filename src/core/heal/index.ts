import type { BackendId } from '../../types.js'
import { healOmLink } from './om.js'
import {
  healOpenCodeAutoupdate,
  healOpenCodeBinaries,
  healOpenCodeScaffold,
  probeOpenCodeHealth,
} from './opencode.js'
import { healProfileDrift } from './profile.js'
import { healMangosDrive } from './mangos-drive.js'
import { healWorkspace } from './workspace.js'

export type HealPassOptions = {
  /** Skip slow binary upgrades unless conflicting versions */
  quick?: boolean
  /** Target backend — scopes opencode scaffold */
  backend?: BackendId
}

export { OSS_FIRST, pickInstalledBackend } from './constants.js'
export { npmPrefixFromBin, resolvePrimaryNpmPrefix, healOpenCodeAutoupdate } from './opencode.js'

export async function runHealPass(root: string, opts: HealPassOptions = {}): Promise<string[]> {
  const healed: string[] = []
  const { quick = false, backend } = opts

  healed.push(...(await healOmLink(root)))
  healed.push(...(await healWorkspace(root)))
  healed.push(...(await healMangosDrive(root)))
  healed.push(...(await healProfileDrift(root)))

  const health = await probeOpenCodeHealth(root)
  if (health.installed) {
    const needsBinaryHeal = health.outdated || health.conflictingPaths
    if (needsBinaryHeal && (!quick || health.conflictingPaths)) {
      healed.push(...(await healOpenCodeBinaries(root, health)))
    }
    healed.push(...(await healOpenCodeAutoupdate(root)))
    if (!backend || backend === 'opencode') {
      healed.push(...(await healOpenCodeScaffold(root)))
    }
  }

  return healed.filter(Boolean)
}

/** Fast pre-bootstrap heal — no slow npm upgrades unless PATH conflict */
export async function runQuickHeal(root: string, backend?: BackendId): Promise<string[]> {
  return runHealPass(root, { quick: true, backend })
}

export function shouldAutoHeal(root: string): boolean {
  if (process.env.OPENMANGOS_NO_HEAL === '1') return false
  return true
}