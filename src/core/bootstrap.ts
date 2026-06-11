import pc from 'picocolors'
import { wrapAndLaunch } from '../adapters/wrap.js'
import { loadConfig } from './config.js'
import { detectTerminalHost } from './host.js'
import { buildSituation } from './situation.js'
import type { BackendId, SituationGraph } from '../types.js'

export interface BootstrapOptions {
  directory: string
  backend?: BackendId
  task?: string
  verifyOnExit?: boolean
  dryRun?: boolean
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
  if (situation.backends.available.includes(situation.backends.preferred)) {
    return situation.backends.preferred
  }
  const ossFirst: BackendId[] = ['opencode', 'codex', 'grok', 'claude', 'cursor']
  for (const id of ossFirst) {
    if (situation.backends.available.includes(id)) return id
  }
  return situation.backends.preferred
}

export async function runBootstrap(options: BootstrapOptions): Promise<BootstrapResult> {
  const root = options.directory
  const config = await loadConfig(root)
  let situation = await buildSituation(root)

  if (options.task) {
    const { routeTask } = await import('./router.js')
    const route = routeTask(options.task, situation, config)
    if (route.mode !== situation.mode) {
      const { loadProfile, saveProfile } = await import('./profile.js')
      const profile = await loadProfile(root)
      profile.mode = route.mode
      await saveProfile(root, profile)
      situation = await buildSituation(root)
    }
  }

  const backend = resolveBootstrapBackend(situation, options.backend)
  const host = detectTerminalHost()
  const notes: string[] = [...host.hints]

  printBootstrapBanner(situation, backend, host.host)

  if (options.dryRun) {
    const { mkdir, writeFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { situationToMarkdown } = await import('./pack.js')
    const { PROFILE_DIR } = await import('./profile.js')
    const dir = join(root, PROFILE_DIR)
    await mkdir(dir, { recursive: true })
    const packPath = join(dir, 'context-pack.md')
    await writeFile(packPath, situationToMarkdown(situation), 'utf8')
    const { resolveLaunchPlan } = await import('../adapters/launch.js')
    const plan = await resolveLaunchPlan(root, backend, situation, packPath)
    notes.push(`dry-run: would launch ${backend} ${plan.args.join(' ')}`.trim())
    for (const n of plan.notes) notes.push(n)
    console.error(pc.dim(notes.join('\n')))
    return { situation, backend, notes }
  }

  console.error(pc.bold(pc.yellow(`OpenMangos boot → ${backend}`)))
  console.error(pc.dim('Full TUI later (Grok Build-style) — orchestration layer first.\n'))

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
  console.error(pc.dim(`  backend ${backend} · host ${host} · workspace ${situation.workspace}`))
  console.error('')
}