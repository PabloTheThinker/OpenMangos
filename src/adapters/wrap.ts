import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { syncAgentsMd } from '../core/agents-md.js'
import { getBackendSpec } from '../core/backends.js'
import { situationToJson, situationToMarkdown } from '../core/pack.js'
import { PROFILE_DIR, saveSituationProfile } from '../core/profile.js'
import { startSession } from '../core/session.js'
import type { BackendId, SituationGraph } from '../types.js'

export async function prepareWrapContext(
  root: string,
  situation: SituationGraph,
  backend: BackendId,
): Promise<{
  packPath: string
  profilePath: string
  env: NodeJS.ProcessEnv
}> {
  const agentsMd = await syncAgentsMd(root, situation)
  console.error(`OpenMangos → AGENTS.md: ${agentsMd.path}`)

  const dir = join(root, PROFILE_DIR)
  await mkdir(dir, { recursive: true })

  const packMdPath = join(dir, 'context-pack.md')
  const packJsonPath = join(dir, 'context-pack.json')
  await writeFile(packMdPath, situationToMarkdown(situation), 'utf8')
  await writeFile(packJsonPath, situationToJson(situation), 'utf8')

  const profilePath = await saveSituationProfile(root, situation)

  const session = await startSession(root, backend, situation.mode, situation.workspace, 'wrap')
  console.error(`OpenMangos → session: ${session.id}`)

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    OPENMANGOS_ROOT: root,
    OPENMANGOS_MODE: situation.mode,
    OPENMANGOS_CONTEXT: packJsonPath,
    OPENMANGOS_CONTEXT_MD: packMdPath,
    OPENMANGOS_PROFILE: profilePath,
    OPENMANGOS_WORKSPACE: situation.workspace,
    OPENMANGOS_SESSION: session.id,
    OPENMANGOS_BACKEND: backend,
  }

  return { packPath: packMdPath, profilePath, env }
}

export function launchBackend(
  backendId: BackendId,
  env: NodeJS.ProcessEnv,
  cwd: string,
  extraArgs: string[] = [],
): void {
  const spec = getBackendSpec(backendId)
  if (!spec) throw new Error(`Unknown backend: ${backendId}`)

  const child = spawn(spec.command, [...spec.args, ...extraArgs], {
    cwd,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  child.on('error', (error) => {
    console.error(`Failed to launch ${spec.command}: ${error.message}`)
    console.error(`Install ${spec.description} or choose another backend with: om wrap <backend>`)
    process.exit(1)
  })

  child.on('exit', (code, signal) => {
    if (signal) process.exit(1)
    process.exit(code ?? 0)
  })
}