import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import YAML from 'yaml'
import type { SituationGraph, UserProfile } from '../types.js'

export const PROFILE_DIR = '.openmangos'
export const PROFILE_FILE = 'profile.yaml'

export function profilePath(root: string): string {
  return join(root, PROFILE_DIR, PROFILE_FILE)
}

export async function loadProfile(root: string): Promise<UserProfile> {
  try {
    const text = await readFile(profilePath(root), 'utf8')
    return (YAML.parse(text) as UserProfile) ?? {}
  } catch {
    return {}
  }
}

export async function saveProfile(root: string, profile: UserProfile): Promise<string> {
  const dir = join(root, PROFILE_DIR)
  await mkdir(dir, { recursive: true })
  const path = profilePath(root)
  await writeFile(path, YAML.stringify(profile), 'utf8')
  return path
}

export async function saveSituationProfile(root: string, situation: SituationGraph): Promise<string> {
  const profile: UserProfile = {
    mode: situation.mode,
    intent: situation.workflow.intent,
    constraints: situation.constraints,
    backends: { preferred: situation.backends.preferred },
  }
  return saveProfile(root, profile)
}

export function profileFromSituation(situation: SituationGraph): UserProfile {
  return {
    mode: situation.mode,
    intent: situation.workflow.intent,
    constraints: situation.constraints,
    backends: { preferred: situation.backends.preferred },
  }
}