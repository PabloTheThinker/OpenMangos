import { resolve } from 'node:path'
import type { Command } from 'commander'
import pc from 'picocolors'
import { checkGlyph, runInstallChecks } from '../core/install/checks.js'
import { runInstallActions } from '../core/install/run.js'
import { loadInstallState, saveInstallState } from '../core/install/state.js'
import { runOnboardingWizard } from '../core/onboarding/wizard.js'

export function registerInstallCommands(program: Command): void {
  program
    .command('install')
    .description('Install / link OpenMangos and check prerequisites')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--global', 'npm install -g openmangos (when published)')
    .option('--with-opencode', 'install OpenCode if missing')
    .option('--with-agentdrive', 'install AgentDrive if missing (Mangos Drive memory)')
    .option('--no-build', 'skip npm run build')
    .option('--check', 'prerequisite checks only')
    .option('--json', 'JSON output')
    .action(
      async (opts: {
        directory: string
        global?: boolean
        withOpencode?: boolean
        withAgentdrive?: boolean
        noBuild?: boolean
        check?: boolean
        json?: boolean
      }) => {
        const root = resolve(opts.directory)
        const checks = await runInstallChecks(root)

        if (opts.json) {
          const payload = opts.check ?
            { checks }
          : {
              checks,
              result: await runInstallActions(root, {
                global: opts.global,
                withOpencode: opts.withOpencode,
                withAgentdrive: opts.withAgentdrive,
                build: !opts.noBuild,
              }),
            }
          console.log(JSON.stringify(payload, null, 2))
          return
        }

        console.error('')
        console.error(pc.bold(pc.yellow('🥭 OpenMangos — install')))
        console.error('')

        for (const check of checks) {
          const glyph = checkGlyph(check.status)
          const color =
            check.status === 'ok' ? pc.green
            : check.status === 'fail' ? pc.red
            : pc.yellow
          console.error(`  ${color(glyph)} ${check.label}: ${pc.dim(check.detail)}`)
        }
        console.error('')

        if (opts.check) {
          console.error(pc.dim('Checks only. Run om install to apply fixes.'))
          return
        }

        const result = await runInstallActions(root, {
          global: opts.global,
          withOpencode: opts.withOpencode,
          withAgentdrive: opts.withAgentdrive,
          build: !opts.noBuild,
        })

        for (const action of result.actions) console.error(pc.green(`↻ ${action}`))
        for (const err of result.errors) console.error(pc.red(`✗ ${err}`))

        const state = await loadInstallState()
        state.installed_at = state.installed_at ?? new Date().toISOString()
        if (result.method) state.install_method = result.method
        const path = await saveInstallState(state)
        console.error('')
        console.error(pc.dim(`install state: ${path}`))
        console.error(pc.dim('Next: om onboard'))
        console.error('')

        if (result.errors.length) process.exit(1)
      },
    )

  program
    .command('onboard')
    .description('Interactive first-run setup wizard')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('-y, --yes', 'accept defaults (non-interactive friendly)')
    .option('--install', 'run om install before workspace setup')
    .option('--with-opencode', 'install OpenCode during install step')
    .option('--with-agentdrive', 'install AgentDrive during prerequisites step')
    .option('--reset', 'clear onboarding completion and rerun')
    .option('--json', 'JSON result')
    .action(
      async (opts: {
        directory: string
        yes?: boolean
        install?: boolean
        withOpencode?: boolean
        withAgentdrive?: boolean
        reset?: boolean
        json?: boolean
      }) => {
        const root = resolve(opts.directory)

        if (opts.reset) {
          const state = await loadInstallState()
          delete state.onboarding_completed_at
          await saveInstallState(state)
          if (!opts.json) console.error(pc.dim('Onboarding reset — rerunning wizard\n'))
        }

        const result = await runOnboardingWizard({
          directory: root,
          yes: opts.yes,
          install: opts.install,
          withOpencode: opts.withOpencode,
          withAgentdrive: opts.withAgentdrive,
        })

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2))
          return
        }

        if (!result.completed) process.exit(1)
      },
    )
}