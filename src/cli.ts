import { Command } from 'commander'
import { isBackendId } from './core/backends.js'
import { registerCommands } from './commands/register.js'

const program = new Command()

program
  .name('om')
  .description('OpenMangos — adaptive terminal framework')
  .version('0.6.2')

registerCommands(program)

const args = process.argv.slice(2)

async function main(): Promise<void> {
  if (args.length === 0) {
    const { runBootstrap } = await import('./core/bootstrap.js')
    await runBootstrap({ directory: process.cwd() })
    return
  }

  // om opencode · om grok — shorthand for om boot <backend>
  if (args.length >= 1 && isBackendId(args[0]!) && !args[0]!.startsWith('-')) {
    const { runBootstrap } = await import('./core/bootstrap.js')
    await runBootstrap({
      directory: process.cwd(),
      backend: args[0] as import('./types.js').BackendId,
      yes: args.includes('--yes') || args.includes('-y'),
      dryRun: args.includes('--dry-run'),
      pick: args.includes('--pick'),
      verifyOnExit: args.includes('--verify-on-exit'),
    })
    return
  }

  await program.parseAsync(process.argv)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})