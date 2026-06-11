import { access, appendFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { scaffoldOpenCodeIntegration } from '../adapters/opencode.js'
import { DEFAULT_CONFIG, saveConfig } from './config.js'
import { PROFILE_DIR, saveSituationProfile } from './profile.js'
import { buildSituation } from './situation.js'

const GITIGNORE_HINT = `
# OpenMangos generated context (commit profile.yaml, ignore packs)
.openmangos/context-pack.*
`

export interface InitResult {
  profilePath: string
  configPath: string
  gitignoreUpdated: boolean
  situationSaved: boolean
  opencodeScaffold: string[]
}

async function ensureGitignore(root: string): Promise<boolean> {
  const gitignorePath = join(root, '.gitignore')
  try {
    const content = await readFile(gitignorePath, 'utf8')
    if (content.includes('.openmangos/context-pack')) return false
    await appendFile(gitignorePath, GITIGNORE_HINT, 'utf8')
    return true
  } catch {
    try {
      await access(join(root, '.gitignore'))
      return false
    } catch {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(gitignorePath, `.openmangos/context-pack.*\n`, 'utf8')
      return true
    }
  }
}

export async function initWorkspace(root: string): Promise<InitResult> {
  const situation = await buildSituation(root)
  const profilePath = await saveSituationProfile(root, situation)
  const configPath = await saveConfig(root, DEFAULT_CONFIG)
  const gitignoreUpdated = await ensureGitignore(root)
  const opencodeScaffold = await scaffoldOpenCodeIntegration(root)

  return {
    profilePath,
    configPath,
    gitignoreUpdated,
    situationSaved: true,
    opencodeScaffold,
  }
}

export function openMangosDir(root: string): string {
  return join(root, PROFILE_DIR)
}