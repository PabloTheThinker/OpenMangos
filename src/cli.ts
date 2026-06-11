import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Command } from 'commander'
import { launchBackend, prepareWrapContext } from './adapters/wrap.js'
import { isBackendId } from './core/backends.js'
import { isMode, MODES } from './core/modes.js'
import { situationToJson, situationToMarkdown } from './core/pack.js'
import { loadProfile, saveProfile } from './core/profile.js'
import { buildSituation } from './core/situation.js'
import { printSituationReport } from './ui/report.js'
import type { BackendId, Mode } from './types.js'
import { resolveVerificationSteps } from './verify/registry.js'
import { printVerificationReport, runVerification } from './verify/runner.js'

const program = new Command()

program
  .name('om')
  .description('OpenMangos — adaptive terminal framework')
  .version('0.2.0')

program
  .command('sense')
  .description('Probe the workspace and print a situation report')
  .option('-C, --directory <path>', 'workspace root', process.cwd())
  .option('--json', 'output JSON instead of human-readable report')
  .option('--save', 'write .openmangos/profile.yaml from detected situation')
  .action(async (opts: { directory: string; json?: boolean; save?: boolean }) => {
    const root = resolve(opts.directory)
    const situation = await buildSituation(root)

    if (opts.save) {
      const { saveSituationProfile } = await import('./core/profile.js')
      const path = await saveSituationProfile(root, situation)
      if (!opts.json) console.error(`Profile saved: ${path}`)
    }

    if (opts.json) {
      console.log(situationToJson(situation))
      return
    }

    printSituationReport(situation)
  })

const modeCmd = program
  .command('mode')
  .description('Show or set the active OpenMangos mode')
  .option('-C, --directory <path>', 'workspace root', process.cwd())
  .argument('[name]', `mode (${MODES.join('|')})`)
  .option('--suggest', 'show suggested mode and reasons without changing')
  .action(async (name: string | undefined, opts: { directory: string; suggest?: boolean }) => {
    const root = resolve(opts.directory)
    const situation = await buildSituation(root)

    if (opts.suggest) {
      console.log(`suggested: ${situation.suggestedMode}`)
      for (const reason of situation.suggestedModeReasons) console.log(`  → ${reason}`)
      return
    }

    if (!name) {
      console.log(`mode: ${situation.mode}`)
      if (situation.mode !== situation.suggestedMode) {
        console.log(`suggested: ${situation.suggestedMode}`)
      }
      for (const reason of situation.modeReasons.slice(0, 5)) console.log(`  → ${reason}`)
      return
    }

    if (!isMode(name)) {
      console.error(`Invalid mode "${name}". Choose: ${MODES.join(', ')}`)
      process.exit(1)
    }

    const profile = await loadProfile(root)
    profile.mode = name as Mode
    const path = await saveProfile(root, profile)
    console.log(`mode set to ${name}`)
    console.log(`profile: ${path}`)
  })

void modeCmd

program
  .command('pack')
  .description('Export an AI context pack for the current situation')
  .option('-C, --directory <path>', 'workspace root', process.cwd())
  .option('--json', 'output JSON')
  .option('--write', 'write pack to .openmangos/context-pack.{md,json}')
  .action(async (opts: { directory: string; json?: boolean; write?: boolean }) => {
    const root = resolve(opts.directory)
    const situation = await buildSituation(root)

    if (opts.write) {
      const md = situationToMarkdown(situation)
      const json = situationToJson(situation)
      const dir = join(root, '.openmangos')
      await mkdir(dir, { recursive: true })
      const mdPath = join(dir, 'context-pack.md')
      const jsonPath = join(dir, 'context-pack.json')
      await writeFile(mdPath, md, 'utf8')
      await writeFile(jsonPath, json, 'utf8')
      console.log(`Wrote ${mdPath}`)
      console.log(`Wrote ${jsonPath}`)
      return
    }

    console.log(opts.json ? situationToJson(situation) : situationToMarkdown(situation))
  })

program
  .command('verify')
  .description('Run stack-appropriate post-action verification checks')
  .option('-C, --directory <path>', 'workspace root', process.cwd())
  .option('--json', 'output JSON instead of human-readable report')
  .option('--dry-run', 'list verification steps without running them')
  .action(
    async (opts: { directory: string; json?: boolean; dryRun?: boolean }) => {
      const root = resolve(opts.directory)
      const situation = await buildSituation(root)
      const steps = await resolveVerificationSteps(situation, root)

      if (opts.dryRun) {
        if (opts.json) {
          console.log(JSON.stringify({ root, steps }, null, 2))
          return
        }

        console.log('')
        console.log('Verification steps (dry run):')
        if (steps.length === 0) {
          console.log('  (none)')
        } else {
          for (const step of steps) {
            console.log(`  • [${step.category}] ${step.label} — ${step.command} ${step.args.join(' ')}`)
          }
        }
        console.log('')
        return
      }

      const result = await runVerification(root, steps)

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        printVerificationReport(result)
      }

      if (!result.ok) process.exit(1)
    },
  )

program
  .command('wrap [backend]')
  .description('Launch an AI backend with OpenMangos context injected')
  .option('-C, --directory <path>', 'workspace root', process.cwd())
  .option('--backend <id>', 'backend id (grok|claude|opencode|codex|cursor)')
  .action(async (backendArg: string | undefined, opts: { directory: string; backend?: string }) => {
    const root = resolve(opts.directory)
    const situation = await buildSituation(root)
    const backendInput = opts.backend ?? backendArg ?? situation.backends.preferred

    if (!isBackendId(backendInput)) {
      console.error(`Unknown backend "${backendInput}". Choose: grok, claude, opencode, codex, cursor`)
      process.exit(1)
    }

    const backend = backendInput
    const { packPath, env } = await prepareWrapContext(root, situation)

    console.error(`OpenMangos wrap → ${backend}`)
    console.error(`mode: ${situation.mode}`)
    console.error(`context: ${packPath}`)
    console.error('')

    launchBackend(backend, env, root)
  })

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})