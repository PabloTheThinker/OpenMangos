import { join } from 'node:path'
import { PROFILE_DIR } from '../core/profile.js'
import type { BackendId, SituationGraph } from '../types.js'
import { openCodeLaunchArgs, syncOpenCodeConfig } from './opencode.js'

export interface LaunchPlan {
  args: string[]
  notes: string[]
}

export async function resolveLaunchPlan(
  root: string,
  backend: BackendId,
  situation: SituationGraph,
  packMdPath: string,
): Promise<LaunchPlan> {
  const notes: string[] = []
  const packRel = join(PROFILE_DIR, 'context-pack.md')

  switch (backend) {
    case 'opencode': {
      const { agent, configPath } = await syncOpenCodeConfig(root, situation, packMdPath)
      notes.push(`opencode.json → default_agent=${agent}`)
      notes.push(`opencode.json synced: ${configPath}`)
      return { args: openCodeLaunchArgs(situation, packRel), notes }
    }
    default:
      return { args: [], notes }
  }
}