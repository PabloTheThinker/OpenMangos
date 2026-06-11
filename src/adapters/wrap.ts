import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { syncAgentsMd } from '../core/agents-md.js'
import { getBackendSpec } from '../core/backends.js'
import { loadConfig } from '../core/config.js'
import { rememberSituation } from '../core/memory.js'
import { situationToJson, situationToMarkdown } from '../core/pack.js'
import { PROFILE_DIR, saveSituationProfile } from '../core/profile.js'
import { startSession } from '../core/session.js'
import { recordToAgentDrive } from '../integrations/agentdrive.js'
import { pushSituationToVektra } from '../integrations/vektra-bridge.js'
import { buildSituation } from '../core/situation.js'
import type { BackendId, SituationGraph } from '../types.js'
import { resolveVerificationSteps } from '../verify/registry.js'
import { printVerificationReport, runVerification } from '../verify/runner.js'

export interface WrapOptions {
  verifyOnExit?: boolean
}

export async function prepareWrapContext(
  root: string,
  situation: SituationGraph,
  backend: BackendId,
): Promise<{
  packPath: string
  profilePath: string
  env: NodeJS.ProcessEnv
}> {
  const config = await loadConfig(root)

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

  const memory = await rememberSituation(root, situation)
  console.error(`OpenMangos → memory: ${memory.id}`)

  if (config.agentdrive?.enabled !== false && config.agentdrive?.auto_remember !== false) {
    const ad = await recordToAgentDrive(root, situation, config.agentdrive ?? {})
    if (ad.ok) console.error(`OpenMangos → AgentDrive: ${ad.message}`)
  }

  if (config.vektra?.enabled !== false && config.vektra?.auto_push !== false) {
    const bridge = await pushSituationToVektra(root, situation)
    if (bridge.available) console.error(`OpenMangos → Vektra: ${bridge.message}`)
  }

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
    OPENMANGOS_MEMORY: memory.id,
  }

  return { packPath: packMdPath, profilePath, env }
}

async function runExitVerification(root: string): Promise<void> {
  console.error('\nOpenMangos → running post-session verification…')
  const situation = await buildSituation(root)
  const steps = await resolveVerificationSteps(situation, root)
  if (!steps.length) {
    console.error('  (no verification steps)')
    return
  }
  const result = await runVerification(root, steps)
  printVerificationReport(result)
  if (!result.ok) process.exit(1)
}

export function launchBackend(
  backendId: BackendId,
  env: NodeJS.ProcessEnv,
  cwd: string,
  extraArgs: string[] = [],
  options: WrapOptions = {},
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
    if (options.verifyOnExit) {
      void runExitVerification(cwd).then(() => process.exit(code ?? 0))
      return
    }
    process.exit(code ?? 0)
  })
}

export async function shouldVerifyOnExit(root: string, flag?: boolean): Promise<boolean> {
  if (flag === true) return true
  if (flag === false) return false
  const config = await loadConfig(root)
  return config.verify_on_exit === true
}