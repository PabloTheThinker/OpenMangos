import { homedir } from 'node:os'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { globalOmDir } from './install/state.js'
import { PROFILE_DIR } from './profile.js'
import { OPENMANGOS_SECTION_END, OPENMANGOS_SECTION_START } from './agents-md.js'

export type ResetScope = {
  global?: boolean
  workspace?: boolean
  mangosSwarms?: boolean
  agentsMd?: boolean
}

export type ResetResult = {
  removed: string[]
  errors: string[]
}

async function removePath(path: string, removed: string[], errors: string[]): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true })
    removed.push(path)
  } catch (error) {
    errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function removeMangosSwarms(removed: string[], errors: string[]): Promise<void> {
  const swarmsRoot = join(homedir(), '.agentdrive', 'swarms')
  try {
    const entries = await readdir(swarmsRoot)
    for (const entry of entries) {
      if (entry.startsWith('mangos-')) {
        await removePath(join(swarmsRoot, entry), removed, errors)
      }
    }
  } catch {
    /* no agentdrive swarms dir */
  }
}

export async function stripAgentsMdSection(root: string): Promise<boolean> {
  const { readFile, writeFile } = await import('node:fs/promises')
  const path = join(root, 'AGENTS.md')
  try {
    const content = await readFile(path, 'utf8')
    const startIdx = content.indexOf(OPENMANGOS_SECTION_START)
    const endIdx = content.indexOf(OPENMANGOS_SECTION_END)
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return false

    const before = content.slice(0, startIdx).trimEnd()
    const after = content.slice(endIdx + OPENMANGOS_SECTION_END.length).trimStart()
    const next = [before, after].filter(Boolean).join('\n\n') + '\n'
    await writeFile(path, next, 'utf8')
    return true
  } catch {
    return false
  }
}

export async function resetOpenMangosData(
  root: string,
  scope: ResetScope = { global: true, workspace: true, mangosSwarms: true, agentsMd: true },
): Promise<ResetResult> {
  const removed: string[] = []
  const errors: string[] = []

  if (scope.global) {
    await removePath(globalOmDir(), removed, errors)
  }

  if (scope.workspace) {
    await removePath(join(root, PROFILE_DIR), removed, errors)
  }

  if (scope.mangosSwarms) {
    await removeMangosSwarms(removed, errors)
  }

  if (scope.agentsMd) {
    const stripped = await stripAgentsMdSection(root)
    if (stripped) removed.push(join(root, 'AGENTS.md (OPENMANGOS section)'))
  }

  return { removed, errors }
}