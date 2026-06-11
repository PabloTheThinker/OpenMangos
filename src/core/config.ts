import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import YAML from 'yaml'
import { PROFILE_DIR } from './profile.js'
import type { OpenMangosConfig } from '../types.js'

export const CONFIG_FILE = 'config.yaml'

export function configPath(root: string): string {
  return join(root, PROFILE_DIR, CONFIG_FILE)
}

export async function loadConfig(root: string): Promise<OpenMangosConfig> {
  try {
    const text = await readFile(configPath(root), 'utf8')
    return (YAML.parse(text) as OpenMangosConfig) ?? {}
  } catch {
    return {}
  }
}

export async function saveConfig(root: string, config: OpenMangosConfig): Promise<string> {
  const { mkdir } = await import('node:fs/promises')
  const dir = join(root, PROFILE_DIR)
  await mkdir(dir, { recursive: true })
  const path = configPath(root)
  await writeFile(path, YAML.stringify(config), 'utf8')
  return path
}

export const DEFAULT_CONFIG: OpenMangosConfig = {
  auto_heal: true,
  constraints: [],
  backends: {
    preferred: 'opencode',
    routing: {
      research: 'opencode',
      refactor: 'claude',
      review: 'claude',
      ops: 'grok',
      quick: 'opencode',
    },
    roles: {
      orchestrator: 'claude',
      implementer: 'opencode',
      validator: 'codex',
      research: 'opencode',
    },
  },
  verify_on_exit: false,
  agentdrive: {
    enabled: true,
    auto_remember: true,
    auto_recall: true,
    auto_provision: true,
    recall_personal: true,
    mangos_display_name: 'Mangos Drive',
  },
  vektra: {
    enabled: true,
    auto_push: true,
  },
}