import pc from 'picocolors'
import { wrapAndLaunch } from '../adapters/wrap.js'
import { loadConfig } from './config.js'
import {
  pickBackendInteractive,
  shouldShowBackendPicker,
  sortAvailableBackends,
} from './backend-select.js'
import { detectTerminalHost } from './host.js'
import { loadProfile, saveProfile } from './profile.js'
import { buildSituation } from './situation.js'
import type { BackendId, SituationGraph } from '../types.js'
import { isBackendId } from './backends.js'
import { OSS_FIRST } from './heal/constants.js'
import { runQuickHeal, shouldAutoHeal } from './heal/index.js'

export interface BootstrapOptions {
  directory: string
  backend?: BackendId
  task?: string
  verifyOnExit?: boolean
  dryRun?: boolean
  yes?: boolean
  pick?: boolean
  noHeal?: boolean
}

export interface BootstrapResult {
  situation: SituationGraph
  backend: BackendId
  notes: string[]
}

export function resolveBootstrapBackend(
  situation: SituationGraph,
  explicit?: BackendId,
): BackendId {
  if (explicit && situation.backends.available.includes(explicit)) return explicit

  const envBackend = process.env.OPENMANGOS_BACKEND
  if (envBackend && isBackendId(envBackend) && situation.backends.available.includes(envBackend)) {
    return envBackend
  }

  for (const id of OSS_FIRST) {
    if (situation.backends.available.includes(id)) return id
  }
  return situation.backends.preferred
}

export async function resolveBootstrapBackendInteractive(
  root: string,
  situation: SituationGraph,
  options: Pick<BootstrapOptions, 'backend' | 'yes' | 'pick'>,
): Promise<BackendId> {
  const available = situation.backends.available
  if (!available.length) {
    throw new Error('No agent backends on PATH. Install opencode, grok, claude, codex, or cursor CLI.')
  }

  if (options.backend && available.includes(options.backend)) return options.backend

  const profile = await loadProfile(root)

  if (
    shouldShowBackendPicker({
      explicit: options.backend,
      yes: options.yes,
      pick: options.pick,
      available,
    })
  ) {
    return pickBackendInteractive(sortAvailableBackends(available), {
      current: profile.backends?.preferred,
      remember: async (backend) => {
        profile.backends = { ...profile.backends, preferred: backend }
        await saveProfile(root, profile)
        console.error(pc.dim(`Saved preferred backend: ${backend}`))
      },
    })
  }

  return resolveBootstrapBackend(situation, options.backend)
}

export async function runBootstrap(options: BootstrapOptions): Promise<BootstrapResult> {
  const root = options.directory

  if (!options.dryRun && !options.backend && !options.yes) {
    const { maybePromptOnboarding } = await import('./onboarding/wizard.js')
    const onboarded = await maybePromptOnboarding(root)
    if (onboarded) {
      console.error(pc.dim('Onboarding done — continuing to bootstrap…\n'))
    }
  }

  const config = await loadConfig(root)
  const autoHeal = !options.noHeal && config.auto_heal !== false && shouldAutoHeal(root)

  if (autoHeal && !options.dryRun) {
    const healed = await runQuickHeal(root, options.backend)
    if (healed.length) {
      console.error(pc.dim(healed.map((h) => `↻ ${h}`).join('\n')))
      console.error('')
    }
  }

  let situation = await buildSituation(root)

  if (options.task) {
    const { routeTask } = await import('./router.js')
    const route = routeTask(options.task, situation, config)
    if (route.mode !== situation.mode) {
      const profile = await loadProfile(root)
      profile.mode = route.mode
      await saveProfile(root, profile)
      situation = await buildSituation(root)
    }
  }

  const backend = await resolveBootstrapBackendInteractive(root, situation, options)
  const host = detectTerminalHost()
  const notes: string[] = [...host.hints]

  printBootstrapBanner(situation, backend, host.host)

  if (options.dryRun) {
    const { writeContextPackFiles } = await import('./context-pack.js')
    const { packMdPath: packPath, memory: packMemory } = await writeContextPackFiles(
      root,
      situation,
      config,
    )
    if (packMemory.agentdrive) {
      console.error(pc.dim('AgentDrive recall: merged into context pack'))
    }
    const { resolveLaunchPlan } = await import('../adapters/launch.js')
    const plan = await resolveLaunchPlan(root, backend, situation, packPath)
    notes.push(`dry-run: would launch ${backend} ${plan.args.join(' ')}`.trim())
    for (const n of plan.notes) notes.push(n)
    console.error(pc.dim(notes.join('\n')))
    return { situation, backend, notes }
  }

  console.error(pc.bold(pc.yellow(`OpenMangos boot → ${backend}`)))
  console.error(pc.dim('Tip: om opencode · om grok · om boot --yes\n'))

  await wrapAndLaunch(root, backend, {
    situation,
    verifyFlag: options.verifyOnExit,
  })
  return { situation, backend, notes }
}

function printBootstrapBanner(situation: SituationGraph, backend: BackendId, host: string): void {
  const stack = situation.stack.slice(0, 4).join(', ') || '—'
  const infra = situation.infra.slice(0, 3).join(', ') || '—'
  const health = Object.entries(situation.health)
    .slice(0, 2)
    .map(([k, v]) => `${k}:${v.status}`)
    .join(' ')

  console.error('')
  console.error(pc.bold(pc.yellow('🥭 OpenMangos — adaptive bootstrap')))
  console.error(
    pc.dim(
      `  mode ${situation.mode} · stack ${stack} · infra ${infra}${health ? ` · ${health}` : ''}`,
    ),
  )
  console.error(
    pc.dim(
      `  backend ${backend} · installed ${situation.backends.available.join(', ') || 'none'} · host ${host}`,
    ),
  )
  console.error('')
}