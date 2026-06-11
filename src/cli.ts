import { Command } from 'commander'
import { registerCommands } from './commands/register.js'

const program = new Command()

program
  .name('om')
  .description('OpenMangos — adaptive terminal framework')
  .version('0.3.0')

registerCommands(program)

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})