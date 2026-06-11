import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { wrapAndLaunch } from '../adapters/wrap.js'
import { isBackendId } from '../core/backends.js'
import { loadConfig } from '../core/config.js'
import { buildMissionPlan, saveMissionPlan } from '../core/mission.js'
import { runMissionPhases } from '../core/mission-runner.js'
import { recallLocal } from '../core/memory.js'
import { isMode, MODES } from '../core/modes.js'
import { writeContextPackFiles } from '../core/context-pack.js'
import { loadProfile, saveProfile } from '../core/profile.js'
import { routeTask } from '../core/router.js'
import { listSessions } from '../core/session.js'
import { buildSituation } from '../core/situation.js'
import { resolveTools } from '../core/tools.js'
import { runDoctor } from '../core/doctor.js'
import { resolveVerificationSteps } from '../verify/registry.js'
import { runVerification } from '../verify/runner.js'
import type { BackendId, Mode, SituationGraph } from '../types.js'
import { theme } from './theme.js'

export interface SlashContext {
  root: string
  situation: SituationGraph
  selectedBackend: BackendId
  lastTask?: string
  onSituationUpdate: (s: SituationGraph) => void
  onBackendSelect: (b: BackendId) => void
  onExitForLaunch: () => void
}

export type SlashResult =
  | { type: 'lines'; lines: string[] }
  | { type: 'refresh' }
  | { type: 'launch'; backend: BackendId; task?: string }
  | { type: 'overlay'; kind: 'help' | 'sessions' | 'missions'; lines: string[] }
  | { type: 'clear' }
  | { type: 'none' }

export async function handleSlash(input: string, ctx: SlashContext): Promise<SlashResult> {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return { type: 'none' }

  const [cmd, ...rest] = trimmed.slice(1).split(/\s+/)
  const argText = rest.join(' ').trim()

  switch (cmd.toLowerCase()) {
    case 'help':
    case 'h':
      return { type: 'overlay', kind: 'help' as const, lines: [] }

    case 'clear':
      return { type: 'clear' }

    case 'sense':
      return await cmdSense(ctx)

    case 'mode':
      return await cmdMode(ctx, argText)

    case 'tools':
      return await cmdTools(ctx)

    case 'route':
      return await cmdRoute(ctx, argText)

    case 'run':
      return await cmdRun(ctx, argText)

    case 'wrap':
      return await cmdWrap(ctx, argText)

    case 'verify':
      return await cmdVerify(ctx)

    case 'pack':
      return await cmdPack(ctx)

    case 'mission':
      return await cmdMission(ctx, rest)

    case 'sessions':
    case 'session':
      return await cmdSessions(ctx)

    case 'recall':
      return await cmdRecall(ctx)

    case 'doctor':
      return await cmdDoctor(argText)

    case 'heal':
      return await cmdDoctor('fix')

    case 'backend':
      return cmdBackend(ctx, argText)

    case 'quit':
    case 'exit':
      process.exit(0)

    default:
      return {
        type: 'lines',
        lines: [theme.fail(`Unknown command: /${cmd}`), theme.dim('Type /help or ? for commands.')],
      }
  }
}

export async function handlePlainTask(task: string, ctx: SlashContext): Promise<string[]> {
  if (!task.trim()) return []
  const config = await loadConfig(ctx.root)
  const route = routeTask(task, ctx.situation, config)
  ctx.lastTask = task
  const lines = [
    theme.bold('Route suggestion'),
    `  backend: ${theme.mango(route.backend)} (${route.confidence})`,
    `  mode: ${theme.accent(route.mode)}`,
    ...route.reasons.map((r) => `  → ${r}`),
    '',
    theme.dim(`Launch: ${theme.key('Ctrl+G')} or ${theme.slash('/run')} · refine: ${theme.slash('/route')} ${task}`),
  ]
  if (route.backend !== ctx.selectedBackend) {
    ctx.onBackendSelect(route.backend)
    lines.push(theme.dim(`Backend set to ${route.backend}`))
  }
  return lines
}

async function cmdSense(ctx: SlashContext): Promise<SlashResult> {
  const situation = await buildSituation(ctx.root)
  ctx.onSituationUpdate(situation)
  return {
    type: 'lines',
    lines: formatSituationSummary(situation),
  }
}

async function cmdMode(ctx: SlashContext, name: string): Promise<SlashResult> {
  if (!name) {
    return {
      type: 'lines',
      lines: [
        `mode: ${theme.mango(ctx.situation.mode)} (suggested: ${ctx.situation.suggestedMode})`,
        ...ctx.situation.modeReasons.slice(0, 4).map((r) => `  → ${r}`),
        theme.dim(`Set: /mode ${MODES.join('|')}`),
      ],
    }
  }
  if (!isMode(name)) {
    return { type: 'lines', lines: [theme.fail(`Invalid mode. Choose: ${MODES.join(', ')}`)] }
  }
  const profile = await loadProfile(ctx.root)
  profile.mode = name as Mode
  await saveProfile(ctx.root, profile)
  const situation = await buildSituation(ctx.root)
  ctx.onSituationUpdate(situation)
  return { type: 'lines', lines: [theme.ok(`Mode set to ${name}`), ...formatSituationSummary(situation)] }
}

async function cmdTools(ctx: SlashContext): Promise<SlashResult> {
  const tools = await resolveTools(ctx.situation, ctx.root)
  if (!tools.length) return { type: 'lines', lines: [theme.dim('No tools for current mode/stack.')] }
  return {
    type: 'lines',
    lines: [
      theme.bold(`Tools (${ctx.situation.mode})`),
      ...tools.slice(0, 12).map((t) => `  [${t.category}] ${t.label}: ${theme.dim(t.command)}`),
    ],
  }
}

async function cmdRoute(ctx: SlashContext, task: string): Promise<SlashResult> {
  if (!task) return { type: 'lines', lines: [theme.fail('Usage: /route <task description>')] }
  ctx.lastTask = task
  const config = await loadConfig(ctx.root)
  const route = routeTask(task, ctx.situation, config)
  ctx.onBackendSelect(route.backend)
  return {
    type: 'lines',
    lines: [
      theme.bold('Route'),
      `  backend: ${route.backend} (${route.confidence})`,
      `  mode: ${route.mode}`,
      ...route.reasons.map((r) => `  → ${r}`),
      theme.dim(`Run: /run or Ctrl+G`),
    ],
  }
}

async function cmdRun(ctx: SlashContext, backendArg: string): Promise<SlashResult> {
  let backend = ctx.selectedBackend
  if (backendArg && isBackendId(backendArg)) backend = backendArg

  if (ctx.lastTask) {
    const config = await loadConfig(ctx.root)
    const route = routeTask(ctx.lastTask, ctx.situation, config)
    if (route.mode !== ctx.situation.mode) {
      const profile = await loadProfile(ctx.root)
      profile.mode = route.mode
      await saveProfile(ctx.root, profile)
      ctx.onSituationUpdate(await buildSituation(ctx.root))
    }
    backend = route.backend
  }

  return { type: 'launch', backend, task: ctx.lastTask }
}

async function cmdWrap(ctx: SlashContext, backendArg: string): Promise<SlashResult> {
  const backend =
    backendArg && isBackendId(backendArg) ? backendArg
    : ctx.selectedBackend
  return { type: 'launch', backend }
}

async function cmdVerify(ctx: SlashContext): Promise<SlashResult> {
  const steps = await resolveVerificationSteps(ctx.situation, ctx.root)
  if (!steps.length) return { type: 'lines', lines: [theme.dim('No verification steps for this stack.')] }
  const result = await runVerification(ctx.root, steps)
  return {
    type: 'lines',
    lines: [
      theme.bold(result.ok ? 'Verify passed' : 'Verify failed'),
      ...result.steps.map((s) => `  ${s.ok ? theme.ok('✓') : theme.fail('✗')} ${s.step.label}`),
    ],
  }
}

async function cmdPack(ctx: SlashContext): Promise<SlashResult> {
  const config = await loadConfig(ctx.root)
  const { packMdPath, memory } = await writeContextPackFiles(ctx.root, ctx.situation, config)
  const lines = [theme.ok(`Wrote ${packMdPath.replace(/\.md$/, '')}.{md,json}`)]
  if (memory.agentdrive) {
    lines.push(theme.dim(`  AgentDrive recall: ${memory.agentdrive.swarmId ?? 'default'}`))
  }
  return { type: 'lines', lines }
}

async function cmdMission(ctx: SlashContext, rest: string[]): Promise<SlashResult> {
  const sub = rest[0]?.toLowerCase()
  if (!sub || sub === 'show') {
    const path = join(ctx.root, '.openmangos', 'mission', 'plan.md')
    try {
      const md = await readFile(path, 'utf8')
      return { type: 'overlay', kind: 'missions', lines: md.split('\n').slice(0, 40) }
    } catch {
      return { type: 'lines', lines: [theme.dim('No mission plan. /mission plan <goal>')] }
    }
  }
  if (sub === 'plan') {
    const goal = rest.slice(1).join(' ')
    if (!goal) return { type: 'lines', lines: [theme.fail('Usage: /mission plan <goal>')] }
    const plan = buildMissionPlan(goal, ctx.situation)
    const path = await saveMissionPlan(ctx.root, plan)
    return {
      type: 'lines',
      lines: [theme.ok(`Mission plan: ${path}`), `Mode: ${plan.mode} · Phases: ${plan.phases.length}`],
    }
  }
  if (sub === 'run') {
    const results = await runMissionPhases(ctx.root, { autoVerify: true })
    return {
      type: 'lines',
      lines: results.map((r) => `${r.verifyOk ? '✓' : '✗'} ${r.phase}: ${r.verifySummary}`),
    }
  }
  return { type: 'lines', lines: [theme.dim('Usage: /mission plan <goal> | show | run')] }
}

async function cmdSessions(ctx: SlashContext): Promise<SlashResult> {
  const sessions = await listSessions(ctx.root)
  if (!sessions.length) {
    return { type: 'overlay', kind: 'sessions', lines: [theme.dim('No sessions yet. Run /wrap or /run.')] }
  }
  return {
    type: 'overlay',
    kind: 'sessions',
    lines: sessions.slice(0, 20).map((s) => `${s.id}  ${s.backend}  ${s.mode}  ${s.startedAt}`),
  }
}

async function cmdRecall(ctx: SlashContext): Promise<SlashResult> {
  const local = await recallLocal(ctx.root, 8)
  if (!local.length) return { type: 'lines', lines: [theme.dim('No local memory snapshots.')] }
  return {
    type: 'lines',
    lines: [theme.bold('Local memory'), ...local.map((m) => `  ${m.id}  ${m.summary}`)],
  }
}

async function cmdDoctor(args = ''): Promise<SlashResult> {
  const fix = args.trim() === 'fix' || args.trim() === '--fix'
  const report = await runDoctor(process.cwd(), { fix })
  const title = fix ? 'Heal' : 'Doctor'
  const lines: string[] = [theme.bold(title)]
  for (const line of report.lines) {
    const text = `  ${line}`
    if (line.startsWith('✓') || line.startsWith('↻')) lines.push(theme.ok(text))
    else if (line.startsWith('✗') || line.startsWith('⚠') || line.startsWith('🩹')) lines.push(theme.fail(text))
    else lines.push(theme.dim(text))
  }
  if (fix) {
    lines.push(report.healthy ? theme.ok('  ✓ healed') : theme.fail('  ⚠ remaining issues'))
  }
  return { type: 'lines', lines }
}

function cmdBackend(ctx: SlashContext, name: string): SlashResult {
  if (name && isBackendId(name)) {
    ctx.onBackendSelect(name)
    return { type: 'lines', lines: [theme.ok(`Backend: ${name}`)] }
  }
  const avail = ctx.situation.backends.available
  return {
    type: 'lines',
    lines: [
      theme.bold('Backends'),
      `  selected: ${ctx.selectedBackend}`,
      `  available: ${avail.length ? avail.join(', ') : 'none on PATH'}`,
      theme.dim('Shift+Tab to cycle · /backend <name>'),
    ],
  }
}

function formatSituationSummary(s: SituationGraph): string[] {
  return [
    theme.bold('Situation'),
    `  mode: ${s.mode} (suggested ${s.suggestedMode})`,
    `  stack: ${s.stack.join(', ') || '—'}`,
    `  infra: ${s.infra.join(', ') || '—'}`,
    `  backends: ${s.backends.available.join(', ') || 'none'}`,
  ]
}

export async function launchFromTui(root: string, backend: BackendId, situation: SituationGraph): Promise<void> {
  await wrapAndLaunch(root, backend, { situation })
}