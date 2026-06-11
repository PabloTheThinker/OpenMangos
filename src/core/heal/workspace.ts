import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_CONFIG, configPath, saveConfig } from '../config.js'
import { PROFILE_DIR, profilePath, saveProfile } from '../profile.js'
import { pathExists } from '../../probes/util.js'
import type { UserProfile } from '../../types.js'

export async function healWorkspace(root: string): Promise<string[]> {
  const healed: string[] = []
  const dir = join(root, PROFILE_DIR)
  await mkdir(dir, { recursive: true })

  if (!(await pathExists(profilePath(root)))) {
    const profile: UserProfile = { backends: { preferred: 'opencode' } }
    await saveProfile(root, profile)
    healed.push('created .openmangos/profile.yaml')
  }

  if (!(await pathExists(configPath(root)))) {
    await saveConfig(root, DEFAULT_CONFIG)
    healed.push('created .openmangos/config.yaml')
  }

  return healed
}

export async function detectWorkspaceIssues(root: string): Promise<
  Array<{ id: string; message: string }>
> {
  const issues: Array<{ id: string; message: string }> = []
  if (!(await pathExists(join(root, PROFILE_DIR)))) {
    issues.push({ id: 'workspace-missing', message: 'missing .openmangos/ workspace directory' })
    return issues
  }
  if (!(await pathExists(profilePath(root)))) {
    issues.push({ id: 'profile-missing', message: 'missing .openmangos/profile.yaml' })
  }
  if (!(await pathExists(configPath(root)))) {
    issues.push({ id: 'config-missing', message: 'missing .openmangos/config.yaml' })
  }
  return issues
}