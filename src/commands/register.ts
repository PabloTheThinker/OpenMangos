import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import { launchBackend, prepareWrapContext } from '../adapters/wrap.js'
import { isBackendId } from '../core/backends.js'
import { loadConfig } from '../core/config.js'
import { initWorkspace } from '../core/init.js'
import { buildMissionPlan, missionToMarkdown, saveMissionPlan } from '../core/mission.js'
import { isMode, MODES } from '../core/modes.js'
import { situationToJson, situationToMarkdown } from '../core/pack.js'
import { loadProfile, saveProfile } from '../core/profile.js'
import { routeTask } from '../core/router.js'
import { handoffSession, listSessions, getSession } from '../core/session.js'
import { buildSituation } from '../core/situation.js'
import { resolveTools } from '../core/tools.js'
import { getModeDefinition } from '../modes/definitions.js'
import { printSituationReport } from '../ui/report.js'
import type { BackendId, Mode } from '../types.js'
import { resolveVerificationSteps } from '../verify/registry.js'
import { printVerificationReport, runVerification } from '../verify/runner.js'
import { runCommand } from '../probes/util.js'

export function registerCommands(program: Command): void {
  program
    .command('sense')
    .description('Probe the workspace and print a situation report')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--json', 'output JSON')
    .option('--save', 'write .openmangos/profile.yaml')
    .action(async (opts: { directory: string; json?: boolean; save?: boolean }) => {
      const root = resolve(opts.directory)
      const situation = await buildSituation(root)
      if (opts.save) {
        const { saveSituationProfile } = await import('../core/profile.js')
        const path = await saveSituationProfile(root, situation)
        if (!opts.json) console.error(`Profile saved: ${path}`)
      }
      if (opts.json) {
        console.log(situationToJson(situation))
        return
      }
      printSituationReport(situation)
    })

  program
    .command('suggest')
    .description('Show suggested mode and reasoning')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { directory: string }) => {
      const situation = await buildSituation(resolve(opts.directory))
      console.log(`suggested mode: ${situation.suggestedMode}`)
      console.log(`active mode: ${situation.mode}`)
      for (const r of situation.suggestedModeReasons) console.log(`  → ${r}`)
      const def = getModeDefinition(situation.suggestedMode)
      console.log(`\n${def.label}: ${def.description}`)
    })

  program
    .command('mode [name]')
    .description('Show or set active mode')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--suggest', 'show suggested mode only')
    .action(async (name: string | undefined, opts: { directory: string; suggest?: boolean }) => {
      const root = resolve(opts.directory)
      const situation = await buildSituation(root)
      if (opts.suggest) {
        console.log(`suggested: ${situation.suggestedMode}`)
        for (const r of situation.suggestedModeReasons) console.log(`  → ${r}`)
        return
      }
      if (!name) {
        console.log(`mode: ${situation.mode}`)
        for (const r of situation.modeReasons.slice(0, 5)) console.log(`  → ${r}`)
        return
      }
      if (!isMode(name)) {
        console.error(`Invalid mode. Choose: ${MODES.join(', ')}`)
        process.exit(1)
      }
      const profile = await loadProfile(root)
      profile.mode = name as Mode
      console.log(`mode set to ${name}`)
      console.log(`profile: ${await saveProfile(root, profile)}`)
    })

  program
    .command('pack')
    .description('Export AI context pack')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--json', 'output JSON')
    .option('--write', 'write to .openmangos/')
    .action(async (opts: { directory: string; json?: boolean; write?: boolean }) => {
      const root = resolve(opts.directory)
      const situation = await buildSituation(root)
      if (opts.write) {
        const dir = join(root, '.openmangos')
        await mkdir(dir, { recursive: true })
        await writeFile(join(dir, 'context-pack.md'), situationToMarkdown(situation), 'utf8')
        await writeFile(join(dir, 'context-pack.json'), situationToJson(situation), 'utf8')
        console.log(`Wrote ${dir}/context-pack.{md,json}`)
        return
      }
      console.log(opts.json ? situationToJson(situation) : situationToMarkdown(situation))
    })

  program
    .command('verify')
    .description('Run stack-appropriate verification')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--json', 'JSON output')
    .option('--dry-run', 'list steps only')
    .action(async (opts: { directory: string; json?: boolean; dryRun?: boolean }) => {
      const root = resolve(opts.directory)
      const situation = await buildSituation(root)
      const steps = await resolveVerificationSteps(situation, root)
      if (opts.dryRun) {
        console.log(opts.json ? JSON.stringify({ steps }, null, 2) : steps.map((s) => `• ${s.label}`).join('\n') || '(none)')
        return
      }
      const result = await runVerification(root, steps)
      if (opts.json) console.log(JSON.stringify(result, null, 2))
      else printVerificationReport(result)
      if (!result.ok) process.exit(1)
    })

  program
    .command('tools')
    .description('List adaptive tools for current mode and stack')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--json', 'JSON output')
    .action(async (opts: { directory: string; json?: boolean }) => {
      const root = resolve(opts.directory)
      const situation = await buildSituation(root)
      const tools = await resolveTools(situation, root)
      if (opts.json) {
        console.log(JSON.stringify({ mode: situation.mode, tools }, null, 2))
        return
      }
      console.log(`\nTools for mode: ${situation.mode}\n`)
      for (const t of tools) {
        console.log(`  [${t.category}] ${t.label}`)
        console.log(`    ${t.command}`)
        console.log(`    → ${t.reason}\n`)
      }
    })

  program
    .command('init')
    .description('Initialize OpenMangos in this workspace')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { directory: string }) => {
      const root = resolve(opts.directory)
      const result = await initWorkspace(root)
      console.log('OpenMangos initialized')
      console.log(`  profile: ${result.profilePath}`)
      console.log(`  config:  ${result.configPath}`)
      if (result.gitignoreUpdated) console.log('  .gitignore updated')
      console.log('\nNext: om sense · om run grok')
    })

  program
    .command('doctor')
    .description('Check OpenMangos and backend health')
    .action(async () => {
      const om = await runCommand('which', ['om'], process.cwd(), 2000)
      console.log(om.ok ? '✓ om on PATH' : '✗ om not on PATH (npm link?)')
      for (const backend of ['grok', 'claude', 'opencode', 'codex', 'agent'] as const) {
        const found = await runCommand('which', [backend], process.cwd(), 2000)
        const label = backend === 'agent' ? 'cursor (agent)' : backend
        console.log(found.ok ? `✓ ${label}` : `○ ${label} (not installed)`)
      }
      const node = await runCommand('node', ['--version'], process.cwd(), 2000)
      console.log(node.ok ? `✓ node ${node.stdout}` : '✗ node missing')
    })

  program
    .command('route <task>')
    .description('Suggest backend and mode for a task')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--json', 'JSON output')
    .action(async (task: string, opts: { directory: string; json?: boolean }) => {
      const root = resolve(opts.directory)
      const situation = await buildSituation(root)
      const config = await loadConfig(root)
      const route = routeTask(task, situation, config)
      if (opts.json) {
        console.log(JSON.stringify(route, null, 2))
        return
      }
      console.log(`backend: ${route.backend} (${route.confidence} confidence)`)
      console.log(`mode: ${route.mode}`)
      for (const r of route.reasons) console.log(`  → ${r}`)
      console.log(`\nRun: om run ${route.backend}`)
    })

  program
    .command('run [backend]')
    .description('Sense + pack + wrap in one command')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--task <text>', 'route backend from task description')
    .action(async (backendArg: string | undefined, opts: { directory: string; task?: string }) => {
      const root = resolve(opts.directory)
      let situation = await buildSituation(root)
      let backend: BackendId = situation.backends.preferred

      if (opts.task) {
        const config = await loadConfig(root)
        const route = routeTask(opts.task, situation, config)
        backend = route.backend
        if (route.mode !== situation.mode) {
          const profile = await loadProfile(root)
          profile.mode = route.mode
          await saveProfile(root, profile)
          situation = await buildSituation(root)
        }
        console.error(`routed: ${backend} / ${route.mode} — ${route.reasons[0]}`)
      } else if (backendArg && isBackendId(backendArg)) {
        backend = backendArg
      }

      const { packPath, env } = await prepareWrapContext(root, situation, backend)
      console.error(`OpenMangos run → ${backend}`)
      console.error(`context: ${packPath}`)
      launchBackend(backend, env, root)
    })

  program
    .command('wrap [backend]')
    .description('Launch AI backend with OpenMangos context')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (backendArg: string | undefined, opts: { directory: string }) => {
      const root = resolve(opts.directory)
      const situation = await buildSituation(root)
      const backendInput = backendArg ?? situation.backends.preferred
      if (!isBackendId(backendInput)) {
        console.error('Unknown backend')
        process.exit(1)
      }
      const { packPath, env } = await prepareWrapContext(root, situation, backendInput)
      console.error(`OpenMangos wrap → ${backendInput}`)
      console.error(`context: ${packPath}`)
      launchBackend(backendInput, env, root)
    })

  program
    .command('handoff')
    .description('Hand off to another backend (logs session, re-wraps)')
    .requiredOption('--to <backend>', 'target backend')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { directory: string; to: string }) => {
      const root = resolve(opts.directory)
      if (!isBackendId(opts.to)) {
        console.error('Unknown backend')
        process.exit(1)
      }
      const situation = await buildSituation(root)
      await handoffSession(root, situation.backends.preferred, opts.to, situation.mode, situation.workspace)
      const { packPath, env } = await prepareWrapContext(root, situation, opts.to)
      console.error(`handoff → ${opts.to}`)
      console.error(`context: ${packPath}`)
      launchBackend(opts.to, env, root)
    })

  const sessionCmd = program.command('session').description('Session history')

  sessionCmd
    .command('ls')
    .description('List recent sessions')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { directory: string }) => {
      const sessions = await listSessions(resolve(opts.directory))
      if (!sessions.length) {
        console.log('No sessions yet. Run om wrap or om run.')
        return
      }
      for (const s of sessions) {
        console.log(`${s.id}  ${s.event}  ${s.backend}  ${s.mode}  ${s.startedAt}`)
      }
    })

  sessionCmd
    .command('show <id>')
    .description('Show session details')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (id: string, opts: { directory: string }) => {
      const s = await getSession(resolve(opts.directory), id)
      console.log(s ? JSON.stringify(s, null, 2) : 'Session not found')
    })

  const missionCmd = program.command('mission').description('Mission planning')

  missionCmd
    .command('plan <goal...>')
    .description('Generate a mission plan from a goal')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (goalParts: string[], opts: { directory: string }) => {
      const root = resolve(opts.directory)
      const goal = goalParts.join(' ')
      const situation = await buildSituation(root)
      const plan = buildMissionPlan(goal, situation)
      const path = await saveMissionPlan(root, plan)
      console.log(`Mission plan: ${path}`)
      console.log(`Mode: ${plan.mode} · Phases: ${plan.phases.length}`)
    })

  missionCmd
    .command('show')
    .description('Show current mission plan')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { directory: string }) => {
      const { readFile } = await import('node:fs/promises')
      const path = join(resolve(opts.directory), '.openmangos', 'mission', 'plan.md')
      try {
        console.log(await readFile(path, 'utf8'))
      } catch {
        console.error('No mission plan. Run: om mission plan "your goal"')
        process.exit(1)
      }
    })
}