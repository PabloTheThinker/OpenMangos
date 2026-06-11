import { homedir } from 'node:os'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import YAML from 'yaml'
import type { BackendId } from '../../types.js'

export const GLOBAL_OM_DIR = '.openmangos'
export const INSTALL_STATE_FILE = 'install.yaml'

export type InstallMethod = 'npm-link' | 'npm-global' | 'dev' | 'script'

export type InstallState = {
  version: number
  user_id?: string
  installed_at?: string
  onboarding_completed_at?: string
  install_method?: InstallMethod
  preferred_backend?: BackendId
  mangos_display_name?: string
  last_workspace?: string
}

export function globalOmDir(): string {
  return join(homedir(), GLOBAL_OM_DIR)
}

export function installStatePath(): string {
  return join(globalOmDir(), INSTALL_STATE_FILE)
}

export async function loadInstallState(): Promise<InstallState> {
  try {
    const text = await readFile(installStatePath(), 'utf8')
    return (YAML.parse(text) as InstallState) ?? { version: 1 }
  } catch {
    return { version: 1 }
  }
}

export async function saveInstallState(state: InstallState): Promise<string> {
  await mkdir(globalOmDir(), { recursive: true })
  const path = installStatePath()
  await writeFile(path, YAML.stringify(state), 'utf8')
  return path
}

export function needsOnboarding(state: InstallState): boolean {
  return !state.onboarding_completed_at
}