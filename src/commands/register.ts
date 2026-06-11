import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import YAML from 'yaml'
import { BACKEND_ADAPTERS } from '../adapters/backends/index.js'
import { wrapAndLaunch } from '../adapters/wrap.js'
import { runBootstrap } from '../core/bootstrap.js'
import { runDoctor } from '../core/doctor.js'
import { isBackendId } from '../core/backends.js'
import { loadConfig } from '../core/config.js'
import { initWorkspace } from '../core/init.js'
import { buildMissionPlan, saveMissionPlan } from '../core/mission.js'
import { runMissionPhases } from '../core/mission-runner.js'
import { recallLocal, rememberSituation } from '../core/memory.js'
import { resolveRoleBackends } from '../core/roles.js'
import { startWatch } from '../core/watch.js'
import { fetchAgentDriveContextPack, recordToAgentDrive } from '../integrations/agentdrive.js'
import { resolveAgentDriveSwarms } from '../integrations/agentdrive-swarm.js'
import { probeVektraBridge, pushSituationToVektra } from '../integrations/vektra-bridge.js'
import { isMode, MODES } from '../core/modes.js'
import {
  buildContextPackJson,
  buildContextPackMarkdown,
  gatherContextPackMemory,
  writeContextPackFiles,
} from '../core/context-pack.js'
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
import { registerLearnCommands } from './learn.js'
import { registerDriveCommands } from './drive.js'
import { registerInstallCommands } from './install.js'
import { registerResetCommand } from './reset.js'
import { registerLifecycleCommands } from './lifecycle.js'


export function registerCommands(program: Command): void {
  registerLearnCommands(program)
  registerDriveCommands(program)
  registerInstallCommands(program)
  registerLifecycleCommands(program)
  registerResetCommand(program)
  program
    .command('boot [backend]')
    .description('Adaptive bootstrap: sense + pack + launch agent (default when no args)')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--task <text>', 'route mode/backend from task before launch')
    .option('--dry-run', 'show bootstrap plan without launching')
    .option('--pick', 'always show backend picker when multiple installed')
    .option('-y, --yes', 'skip picker; use OSS-first / preferred default')
    .option('--verify-on-exit', 'run om verify when backend exits')
    .option('--no-heal', 'skip pre-bootstrap auto-heal')
    .action(async (backendArg: string | undefined, opts: { directory: string; task?: string; dryRun?: boolean; pick?: boolean; yes?: boolean; verifyOnExit?: boolean; noHeal?: boolean }) => {
      const root = resolve(opts.directory)
      const backend = backendArg && isBackendId(backendArg) ? backendArg : undefined
      await runBootstrap({
        directory: root,
        backend,
        task: opts.task,
        dryRun: opts.dryRun,
        pick: opts.pick,
        yes: opts.yes,
        verifyOnExit: opts.verifyOnExit,
        noHeal: opts.noHeal,
      })
    })

  program
    .command('backends')
    .description('List installed agent backends and set preferred')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--set <backend>', 'save preferred backend to profile')
    .action(async (opts: { directory: string; set?: string }) => {
      const root = resolve(opts.directory)
      const situation = await buildSituation(root)
      if (opts.set) {
        if (!isBackendId(opts.set)) {
          console.error('Unknown backend')
          process.exit(1)
        }
        if (!situation.backends.available.includes(opts.set)) {
          console.error(`${opts.set} not on PATH`)
          process.exit(1)
        }
        const { loadProfile, saveProfile } = await import('../core/profile.js')
        const profile = await loadProfile(root)
        profile.backends = { ...profile.backends, preferred: opts.set }
        const path = await saveProfile(root, profile)
        console.log(`preferred backend: ${opts.set}`)
        console.log(`profile: ${path}`)
        return
      }
      console.log('\nInstalled backends:\n')
      for (const b of ['opencode', 'grok', 'claude', 'codex', 'cursor'] as const) {
        const on = situation.backends.available.includes(b)
        const mark = situation.backends.preferred === b ? ' ← preferred' : ''
        console.log(`  ${on ? '✓' : '○'} ${b}${mark}`)
      }
      console.log('\nSet: om backends --set opencode')
      console.log('Launch: om opencode · om grok · om (picker)\n')
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
      const config = await loadConfig(root)
      if (opts.write) {
        const { packMdPath, memory } = await writeContextPackFiles(root, situation, config)
        console.log(`Wrote ${packMdPath.replace(/\.md$/, '')}.{md,json}`)
        if (memory.mangos_drive) {
          console.log(`  Mangos Drive: ${memory.mangos_drive.display_name} (${memory.mangos_drive.drive_id})`)
        }
        if (memory.agentdrive) {
          console.log(`  workspace swarm: ${memory.agentdrive.swarmId ?? 'default'}`)
        }
        if (memory.agentdrive_personal) {
          console.log(`  personal swarm: ${memory.agentdrive_personal.swarmId ?? 'default'}`)
        }
        return
      }
      const memory = await gatherContextPackMemory(root, situation, config)
      console.log(
        opts.json ?
          buildContextPackJson(situation, memory)
        : buildContextPackMarkdown(situation, memory),
      )
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
      if (result.mangosDrive) {
        const tag = result.mangosDrive.created ? 'created' : 'ready'
        console.log(`  mangos drive: ${result.mangosDrive.displayName} (${result.mangosDrive.driveId}) — ${tag}`)
      }
      console.log('\nNext: om · om sense · om run opencode')
    })

  program
    .command('doctor')
    .description('Diagnose OpenMangos and backend health')
    .option('--fix', 'Heal fixable issues (upgrade backends, sync config)')
    .option('--json', 'JSON report')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { fix?: boolean; json?: boolean; directory: string }) => {
      const root = resolve(opts.directory)
      const report = await runDoctor(root, { fix: opts.fix })
      if (opts.json) {
        console.log(JSON.stringify(report, null, 2))
        return
      }
      for (const line of report.lines) console.log(line)
      if (opts.fix && report.healed.length) {
        console.log(report.healthy ? '\n✓ healed' : '\n⚠ healed with remaining issues')
      }
    })

  program
    .command('heal')
    .description('Heal fixable OpenMangos and backend issues (alias for om doctor --fix)')
    .option('--json', 'JSON report')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { json?: boolean; directory: string }) => {
      const root = resolve(opts.directory)
      const report = await runDoctor(root, { fix: true })
      if (opts.json) {
        console.log(JSON.stringify(report, null, 2))
        return
      }
      for (const line of report.lines) console.log(line)
      console.log(report.healthy ? '\n✓ healed' : '\n⚠ healed with remaining issues')
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
      const situation = await buildSituation(root)
      const config = await loadConfig(root)
      const output: Record<string, unknown> = {}

      if (!opts.agentdrive) {
        output.local = await recallLocal(root, Number(opts.limit))
      }
      if (!opts.local) {
        const swarms = await resolveAgentDriveSwarms(root, situation, config.agentdrive ?? {})
        output.mangos_drive = swarms.displayName
        output.workspace_swarm = swarms.workspaceSwarmId
        output.personal_swarm = swarms.personalSwarmId
        output.agentdrive = await fetchAgentDriveContextPack(
          config.agentdrive ?? {},
          swarms.workspaceSwarmId,
        )
        if (config.agentdrive?.recall_personal !== false && swarms.personalSwarmId) {
          output.agentdrive_personal = await fetchAgentDriveContextPack(
            config.agentdrive ?? {},
            swarms.personalSwarmId,
          )
        }
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
      if (output.mangos_drive) {
        console.log(`\nMangos Drive: ${output.mangos_drive}`)
        console.log(`  workspace swarm: ${output.workspace_swarm}`)
        if (output.personal_swarm) console.log(`  personal swarm: ${output.personal_swarm}`)
      }
      const ad = output.agentdrive as { ok: boolean; text: string; source: string } | undefined
      if (ad?.ok && ad.text) {
        console.log('\n## Workspace memory (Mangos Drive)\n')
        console.log(ad.text.slice(0, 3000))
      } else if (ad && !opts.local) {
        console.log(`\nAgentDrive: ${ad.source}`)
      }
      const adPersonal = output.agentdrive_personal as
        | { ok: boolean; text: string; source: string }
        | undefined
      if (adPersonal?.ok && adPersonal.text) {
        console.log('\n## Personal memory (Mangos Drive)\n')
        console.log(adPersonal.text.slice(0, 2000))
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
      const swarms = await resolveAgentDriveSwarms(root, situation, config.agentdrive ?? {})
      if (swarms.displayName) {
        console.log(`mangos drive: ${swarms.displayName} (${swarms.driveId ?? 'unknown'})`)
      }
      const ad = await recordToAgentDrive(
        root,
        situation,
        config.agentdrive ?? {},
        swarms.workspaceSwarmId,
      )
      console.log(
        ad.ok ?
          `agentdrive: ${ad.message} → swarm ${swarms.workspaceSwarmId}`
        : `agentdrive: ${ad.message}`,
      )
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