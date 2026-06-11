import type { AgentDriveConfig, SituationGraph } from '../types.js'
import {
  loadMangosDriveManifest,
  provisionMangosDrive,
  resolveMangosSwarmIds,
  slugify,
} from './mangos-drive.js'

export type ResolvedAgentDriveSwarms = {
  workspaceSwarmId: string
  personalSwarmId?: string
  driveId?: string
  displayName?: string
  provisionNotes: string[]
}

export async function resolveAgentDriveSwarms(
  root: string,
  situation: Pick<SituationGraph, 'workspace'>,
  config: AgentDriveConfig = {},
): Promise<ResolvedAgentDriveSwarms> {
  const provisionNotes: string[] = []
  let manifest = await loadMangosDriveManifest(root)

  if (config.auto_provision !== false && !manifest) {
    const provisioned = await provisionMangosDrive(root, situation, config)
    manifest = provisioned.manifest
    if (provisioned.created) provisionNotes.push(...provisioned.notes)
  }

  const ids = resolveMangosSwarmIds(manifest, config, slugify(situation.workspace))
  return { ...ids, provisionNotes }
}