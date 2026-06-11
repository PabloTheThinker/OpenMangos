import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import pc from 'picocolors'
import { getUpdateInfo, runUpdate } from '../core/install/update.js'
import { uninstallOpenMangos } from '../core/install/uninstall.js'
import { promptYesNo } from '../ui/prompt.js'

export function registerLifecycleCommands(program: Command): void {
  program
    .command('update')
    .description('Update OpenMangos (rebuild + relink, or npm global upgrade)')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--global', 'force npm install -g openmangos@latest')
    .option('--no-pull', 'skip git pull when updating from local repo')
    .option('--check', 'show version info only')
    .option('--json', 'JSON output')
    .action(
      async (opts: {
        directory: string
        global?: boolean
        pull?: boolean
        check?: boolean
        json?: boolean
      }) => {
        const root = resolve(opts.directory)
        const info = await getUpdateInfo(root)

        if (opts.check) {
          if (opts.json) {
            console.log(JSON.stringify(info, null, 2))
            return
          }
          console.error('')
          console.error(pc.bold(pc.yellow('🥭 OpenMangos — update check')))
          console.error('')
          console.error(`  current:  ${info.currentVersion}`)
          console.error(`  method:   ${info.method}`)
          if (info.latestVersion) {
            console.error(`  published: ${info.latestVersion}`)
            console.error(
              info.updateAvailable ?
                pc.yellow('  status:   update available (om update)')
              : pc.green('  status:   up to date'),
            )
          } else {
            console.error(pc.dim('  published: (not checked — local / npm-link install)'))
            console.error(pc.dim('  run om update to rebuild from repo'))
          }
          console.error('')
          return
        }

        console.error('')
        console.error(pc.bold(pc.yellow('🥭 OpenMangos — update')))
        console.error(pc.dim(`  ${info.currentVersion} → rebuilding…`))
        console.error('')

        const result = await runUpdate(root, {
          global: opts.global,
          pull: opts.pull,
        })

        if (opts.json) {
          console.log(JSON.stringify({ info, result }, null, 2))
          return
        }

        for (const action of result.actions) console.error(pc.green(`↻ ${action}`))
        for (const err of result.errors) console.error(pc.red(`✗ ${err}`))

        console.error('')
        console.error(
          result.beforeVersion === result.afterVersion ?
            pc.green(`✓ updated (v${result.afterVersion})`)
          : pc.green(`✓ updated ${result.beforeVersion} → ${result.afterVersion}`),
        )
        console.error('')

        if (result.errors.length) process.exit(1)
      },
    )

  program
    .command('uninstall')
    .description('Remove om from PATH; optionally purge all local data')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--keep-data', 'keep ~/.openmangos, workspace data, and Mangos Drive swarms')
    .option('--purge', 'remove all OpenMangos data (same as reset + uninstall)')
    .option('-y, --yes', 'skip confirmation')
    .option('--json', 'JSON output')
    .action(
      async (opts: {
        directory: string
        keepData?: boolean
        purge?: boolean
        yes?: boolean
        json?: boolean
      }) => {
        const root = resolve(opts.directory)
        let keepData = true
        if (opts.purge) keepData = false
        else if (opts.keepData) keepData = true

        if (!opts.yes && !opts.json) {
          if (!opts.purge && !opts.keepData) {
            keepData = await promptYesNo('Keep Mangos Drive data and workspace configs?', true)
          }
          console.error('')
          console.error(pc.bold(pc.yellow('🥭 OpenMangos — uninstall')))
          console.error('')
          console.error('Always removes:')
          console.error(`  • ${pc.cyan('om')} CLI from PATH (npm unlink / uninstall)`)
          console.error('')
          if (keepData) {
            console.error('Keeps:')
            console.error(`  • ${pc.cyan('~/.openmangos/')} install state`)
            console.error(`  • ${pc.cyan(join(root, '.openmangos/'))} workspace data`)
            console.error(`  • ${pc.cyan('~/.agentdrive/swarms/mangos-*')} Mangos Drive swarms`)
            console.error('')
            console.error(pc.dim('Use --purge to remove everything.'))
          } else {
            console.error('Also removes (--purge):')
            console.error(`  • ${pc.cyan('~/.openmangos/')}`)
            console.error(`  • ${pc.cyan(join(root, '.openmangos/'))}`)
            console.error(`  • ${pc.cyan('~/.agentdrive/swarms/mangos-*')}`)
            console.error('  • AGENTS.md OPENMANGOS section')
          }
          console.error('')
          const ok = await promptYesNo('Uninstall OpenMangos?', false)
          if (!ok) {
            console.error(pc.dim('Cancelled.'))
            return
          }
        }

        const result = await uninstallOpenMangos(root, { keepData })

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2))
          return
        }

        for (const action of result.actions) console.error(pc.green(`✓ ${action}`))
        for (const path of result.dataRemoved) console.error(pc.yellow(`✓ removed ${path}`))
        for (const err of result.errors) console.error(pc.red(`✗ ${err}`))

        console.error('')
        console.error(
          keepData ?
            pc.dim('Data kept. Reinstall: om install · om onboard')
          : pc.dim('Fully removed. Reinstall: ./scripts/install.sh'),
        )
        console.error('')

        if (result.errors.some((e) => !e.includes('still on PATH'))) process.exit(1)
      },
    )
}