import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import pc from 'picocolors'
import { resetOpenMangosData } from '../core/reset.js'
import { promptYesNo } from '../ui/prompt.js'

export function registerResetCommand(program: Command): void {
  program
    .command('reset')
    .description('Clear local OpenMangos data and Mangos Drive swarms for a fresh start')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--keep-global', 'keep ~/.openmangos install state')
    .option('--keep-swarms', 'keep ~/.agentdrive/swarms/mangos-*')
    .option('--keep-agents-md', 'keep AGENTS.md OPENMANGOS section')
    .option('-y, --yes', 'skip confirmation')
    .option('--json', 'JSON output')
    .action(
      async (opts: {
        directory: string
        keepGlobal?: boolean
        keepSwarms?: boolean
        keepAgentsMd?: boolean
        yes?: boolean
        json?: boolean
      }) => {
        const root = resolve(opts.directory)

        if (!opts.yes && !opts.json) {
          console.error('')
          console.error(pc.bold(pc.yellow('🥭 OpenMangos reset')))
          console.error('')
          console.error('This removes:')
          if (!opts.keepGlobal) console.error(`  • ${pc.cyan('~/.openmangos/')} (install state + any home workspace data)`)
          console.error(`  • ${pc.cyan(join(root, '.openmangos/'))} (profile, memory, sessions, packs)`)
          if (!opts.keepSwarms) console.error(`  • ${pc.cyan('~/.agentdrive/swarms/mangos-*')} (Mangos Drive swarms)`)
          if (!opts.keepAgentsMd) console.error('  • AGENTS.md OPENMANGOS section')
          console.error('')
          const ok = await promptYesNo('Proceed?', false)
          if (!ok) {
            console.error(pc.dim('Cancelled.'))
            return
          }
        }

        const result = await resetOpenMangosData(root, {
          global: !opts.keepGlobal,
          workspace: true,
          mangosSwarms: !opts.keepSwarms,
          agentsMd: !opts.keepAgentsMd,
        })

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2))
          return
        }

        for (const path of result.removed) console.error(pc.green(`✓ removed ${path}`))
        for (const err of result.errors) console.error(pc.red(`✗ ${err}`))

        console.error('')
        console.error(pc.dim('Fresh start: om onboard'))
        console.error('')

        if (result.errors.length) process.exit(1)
      },
    )
}