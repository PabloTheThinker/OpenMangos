import { Command } from 'commander'
import { registerCommands } from './commands/register.js'

const program = new Command()

program
  .name('om')
  .description('OpenMangos — adaptive terminal framework')
  .version('0.6.0')

registerCommands(program)

const args = process.argv.slice(2)
const isDefaultLaunch = args.length === 0

async function main(): Promise<void> {
  if (isDefaultLaunch) {
    const { runBootstrap } = await import('./core/bootstrap.js')
    await runBootstrap({ directory: process.cwd() })
    return
  }
  await program.parseAsync(process.argv)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})