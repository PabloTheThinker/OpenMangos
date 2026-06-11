import { resolve } from 'node:path'
import type { Command } from 'commander'
import { healMangosDrive, inspectMangosDrive } from '../core/heal/mangos-drive.js'

export function registerDriveCommands(program: Command): void {
  const driveCmd = program.command('drive').description('Mangos Drive — user-scoped AgentDrive namespace')

  driveCmd
    .command('status')
    .description('Show Mangos Drive manifest, swarms, and AgentDrive linkage')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--json', 'JSON output')
    .action(async (opts: { directory: string; json?: boolean }) => {
      const root = resolve(opts.directory)
      const status = await inspectMangosDrive(root)

      if (opts.json) {
        console.log(JSON.stringify(status, null, 2))
        return
      }

      console.log('\nMangos Drive\n')
      if (!status.enabled) {
        console.log('  disabled (agentdrive.enabled: false)')
        return
      }

      if (!status.provisioned) {
        console.log('  not provisioned yet')
        console.log('  run: om init · om pack --write · om drive provision')
        if (status.issues.length) {
          for (const issue of status.issues) console.log(`  ⚠ ${issue.message}`)
        }
        return
      }

      console.log(`  name:      ${status.displayName}`)
      console.log(`  drive id:  ${status.driveId}`)
      if (status.manifestPath) console.log(`  manifest:  ${status.manifestPath}`)
      console.log(`  workspace: ${status.workspaceSwarm}`)
      console.log(`  personal:  ${status.personalSwarm}`)
      if (status.agentdriveHome) console.log(`  substrate: ${status.agentdriveHome}`)
      console.log(`  agentdrive: ${status.agentdriveBin ?? '(not found)'}`)

      if (status.issues.length) {
        console.log('\nIssues')
        for (const issue of status.issues) console.log(`  ⚠ ${issue.message}`)
      } else {
        console.log('\n✓ ready')
      }
    })

  driveCmd
    .command('provision')
    .description('Create or repair Mangos Drive manifest and swarm directories')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { directory: string }) => {
      const root = resolve(opts.directory)
      const healed = await healMangosDrive(root)
      if (!healed.length) {
        const status = await inspectMangosDrive(root)
        if (!status.enabled) {
          console.log('Mangos Drive disabled in config')
          return
        }
        console.log(status.provisioned ? 'Mangos Drive already provisioned' : 'nothing to provision')
        return
      }
      for (const action of healed) console.log(`↻ ${action}`)
    })
}