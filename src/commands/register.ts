import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import YAML from 'yaml'
import { BACKEND_ADAPTERS } from '../adapters/backends/index.js'
import { wrapAndLaunch } from '../adapters/wrap.js'
import { runBootstrap } from '../core/bootstrap.js'
import { detectTerminalHost } from '../core/host.js'
import { isBackendId } from '../core/backends.js'
import { loadConfig } from '../core/config.js'
import { initWorkspace } from '../core/init.js'
import { buildMissionPlan, saveMissionPlan } from '../core/mission.js'
import { runMissionPhases } from '../core/mission-runner.js'
import { recallLocal, rememberSituation } from '../core/memory.js'
import { resolveRoleBackends } from '../core/roles.js'
import { startWatch } from '../core/watch.js'
import { fetchAgentDriveContextPack, recordToAgentDrive } from '../integrations/agentdrive.js'
import { probeVektraBridge, pushSituationToVektra } from '../integrations/vektra-bridge.js'
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
    .command('boot [backend]')
    .description('Adaptive bootstrap: sense + pack + launch agent (default when no args)')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--task <text>', 'route mode/backend from task before launch')
    .option('--dry-run', 'show bootstrap plan without launching')
    .option('--verify-on-exit', 'run om verify when backend exits')
    .action(async (backendArg: string | undefined, opts: { directory: string; task?: string; dryRun?: boolean; verifyOnExit?: boolean }) => {
      const root = resolve(opts.directory)
      const backend = backendArg && isBackendId(backendArg) ? backendArg : undefined
      await runBootstrap({
        directory: root,
        backend,
        task: opts.task,
        dryRun: opts.dryRun,
        verifyOnExit: opts.verifyOnExit,
      })
    })

  program
    .command('tui')
    .description('Preview OpenMangos TUI (orchestrator shell — full Grok-style TUI later)')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { directory: string }) => {
      const { runTui } = await import('../tui/index.js')
      await runTui({ directory: resolve(opts.directory) })
    })

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
      for (const p of result.opencodeScaffold) console.log(`  opencode: ${p}`)
      console.log('\nNext: om · om sense · om run opencode')
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
      const host = detectTerminalHost()
      console.log(host.host === 'warp' ? '✓ Warp terminal host' : `○ host: ${host.host}`)
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
    .command('recall')
    .description('Recall cross-session memory (local + AgentDrive)')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--local', 'local snapshots only')
    .option('--agentdrive', 'AgentDrive context pack only')
    .option('--json', 'JSON output')
    .option('-n, --limit <n>', 'local snapshot limit', '8')
    .action(async (opts: { directory: string; local?: boolean; agentdrive?: boolean; json?: boolean; limit: string }) => {
      const root = resolve(opts.directory)
      const config = await loadConfig(root)
      const output: Record<string, unknown> = {}

      if (!opts.agentdrive) {
        output.local = await recallLocal(root, Number(opts.limit))
      }
      if (!opts.local) {
        output.agentdrive = await fetchAgentDriveContextPack(config.agentdrive ?? {})
      }

      if (opts.json) {
        console.log(JSON.stringify(output, null, 2))
        return
      }

      if (output.local) {
        console.log('\n## Local memory\n')
        for (const m of output.local as Array<{ id: string; recordedAt: string; summary: string }>) {
          console.log(`  ${m.id}  ${m.recordedAt}  ${m.summary}`)
        }
      }
      const ad = output.agentdrive as { ok: boolean; text: string; source: string } | undefined
      if (ad?.ok && ad.text) {
        console.log('\n## AgentDrive Experience Graph\n')
        console.log(ad.text.slice(0, 3000))
      } else if (ad && !opts.local) {
        console.log(`\nAgentDrive: ${ad.source}`)
      }
    })

  program
    .command('remember')
    .description('Persist current situation to local memory + AgentDrive')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { directory: string }) => {
      const root = resolve(opts.directory)
      const situation = await buildSituation(root)
      const config = await loadConfig(root)
      const snap = await rememberSituation(root, situation)
      console.log(`local memory: ${snap.id}`)
      const ad = await recordToAgentDrive(root, situation, config.agentdrive ?? {})
      console.log(ad.ok ? `agentdrive: ${ad.message}` : `agentdrive: ${ad.message}`)
    })

  program
    .command('roles')
    .description('Factory-style model routing by role')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--json', 'JSON output')
    .action(async (opts: { directory: string; json?: boolean }) => {
      const root = resolve(opts.directory)
      const situation = await buildSituation(root)
      const config = await loadConfig(root)
      const roles = resolveRoleBackends(situation.backends.available, config)
      if (opts.json) {
        console.log(JSON.stringify(roles, null, 2))
        return
      }
      console.log('\nRole routing (Factory Missions pattern)\n')
      for (const r of roles) {
        console.log(`  ${r.role.padEnd(14)} → ${r.backend}`)
        console.log(`    ${r.reason}`)
      }
      console.log('\nBackends:')
      for (const b of BACKEND_ADAPTERS) {
        if (situation.backends.available.includes(b.id)) {
          console.log(`  ${b.id}: ${b.strengths.join(', ')}`)
        }
      }
    })

  program
    .command('watch')
    .description('Live situation refresh on file/runtime changes')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('-i, --interval <sec>', 'poll interval seconds', '5')
    .action((opts: { directory: string; interval: string }) => {
      const root = resolve(opts.directory)
      console.error(`Watching ${root} (every ${opts.interval}s). Ctrl+C to stop.\n`)
      const stop = startWatch(root, {
        intervalMs: Number(opts.interval) * 1000,
        build: () => buildSituation(root),
        onUpdate: (situation, changes) => {
          console.log(`[${new Date().toISOString()}] ${changes.join(' · ')}`)
          console.log(`  mode=${situation.mode} stack=${situation.stack.join(',') || 'none'}\n`)
        },
      })
      process.on('SIGINT', () => {
        stop()
        process.exit(0)
      })
    })

  const bridgeCmd = program.command('bridge').description('Vektra engine terminal bridge')

  bridgeCmd
    .command('status')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { directory: string }) => {
      const status = await probeVektraBridge(resolve(opts.directory))
      console.log(JSON.stringify(status, null, 2))
    })

  bridgeCmd
    .command('push')
    .description('Push situation to vektra-engine WebSocket bridge')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { directory: string }) => {
      const root = resolve(opts.directory)
      const situation = await buildSituation(root)
      const status = await pushSituationToVektra(root, situation)
      console.log(status.message ?? JSON.stringify(status))
    })

  program
    .command('run [backend]')
    .description('Sense + pack + wrap in one command')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--task <text>', 'route backend from task description')
    .option('--verify-on-exit', 'run om verify when backend exits')
    .option('--no-verify-on-exit', 'skip exit verification')
    .action(async (backendArg: string | undefined, opts: { directory: string; task?: string; verifyOnExit?: boolean; noVerifyOnExit?: boolean }) => {
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

      console.error(`OpenMangos run → ${backend}`)
      await wrapAndLaunch(root, backend, {
        situation,
        verifyFlag: opts.noVerifyOnExit ? false : opts.verifyOnExit,
      })
    })

  program
    .command('wrap [backend]')
    .description('Launch AI backend with OpenMangos context')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--verify-on-exit', 'run om verify when backend exits')
    .option('--no-verify-on-exit', 'skip exit verification')
    .action(async (backendArg: string | undefined, opts: { directory: string; verifyOnExit?: boolean; noVerifyOnExit?: boolean }) => {
      const root = resolve(opts.directory)
      const situation = await buildSituation(root)
      const backendInput = backendArg ?? situation.backends.preferred
      if (!isBackendId(backendInput)) {
        console.error('Unknown backend')
        process.exit(1)
      }
      console.error(`OpenMangos wrap → ${backendInput}`)
      await wrapAndLaunch(root, backendInput, {
        situation,
        verifyFlag: opts.noVerifyOnExit ? false : opts.verifyOnExit,
      })
    })

  program
    .command('handoff')
    .description('Hand off to another backend (logs session, re-wraps)')
    .requiredOption('--to <backend>', 'target backend')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--verify-on-exit', 'run om verify when backend exits')
    .action(async (opts: { directory: string; to: string; verifyOnExit?: boolean }) => {
      const root = resolve(opts.directory)
      if (!isBackendId(opts.to)) {
        console.error('Unknown backend')
        process.exit(1)
      }
      const situation = await buildSituation(root)
      await handoffSession(root, situation.backends.preferred, opts.to, situation.mode, situation.workspace)
      console.error(`handoff → ${opts.to}`)
      await wrapAndLaunch(root, opts.to, { situation, verifyFlag: opts.verifyOnExit })
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

  missionCmd
    .command('run')
    .description('Run mission phases with verification gates')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--no-verify', 'skip verification between phases')
    .action(async (opts: { directory: string; noVerify?: boolean }) => {
      const root = resolve(opts.directory)
      const results = await runMissionPhases(root, { autoVerify: !opts.noVerify })
      console.log('\nMission run\n')
      for (const r of results) {
        const icon = r.verifyOk ? '✓' : '✗'
        console.log(`${icon} Phase: ${r.phase} (verify: ${r.verifySummary})`)
        for (const t of r.tasks) console.log(`    - ${t}`)
      }
      if (results.some((r) => !r.verifyOk)) process.exit(1)
    })

  const teamCmd = program.command('team').description('Team-shared OpenMangos config')

  teamCmd
    .command('export')
    .description('Export committable team config snippet')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { directory: string }) => {
      const root = resolve(opts.directory)
      const config = await loadConfig(root)
      const profile = await loadProfile(root)
      const teamYaml = {
        team: { name: config.team?.name ?? 'default', shared_profile: true },
        backends: config.backends,
        constraints: config.constraints ?? profile.constraints,
      }
      const path = join(root, '.openmangos', 'team.yaml')
      await writeFile(path, YAML.stringify(teamYaml), 'utf8')
      console.log(`Wrote ${path} — commit this for team-shared routing/constraints`)
    })
}