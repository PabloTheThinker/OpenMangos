import pc from 'picocolors'
import type { SituationGraph } from '../types.js'

function statusColor(status: string): (s: string) => string {
  if (status === 'ok') return pc.green
  if (status === 'fail') return pc.red
  if (status === 'warn') return pc.yellow
  return pc.dim
}

export function printSituationReport(situation: SituationGraph): void {
  console.log('')
  console.log(pc.bold(pc.cyan('🥭 OpenMangos — Situation Report')))
  console.log(pc.dim(`   ${situation.root}`))
  console.log('')

  console.log(pc.bold('Workspace'), situation.workspace)
  console.log(pc.bold('Mode'), `${pc.yellow(situation.mode)}`, pc.dim(`(suggested: ${situation.suggestedMode})`))
  console.log('')

  console.log(pc.bold('Stack'))
  if (situation.stack.length) {
    for (const item of situation.stack) console.log(`  • ${item}`)
  } else {
    console.log(pc.dim('  none detected'))
  }
  console.log('')

  console.log(pc.bold('Infra'))
  if (situation.infra.length) {
    for (const item of situation.infra) console.log(`  • ${item}`)
  } else {
    console.log(pc.dim('  none detected'))
  }
  console.log('')

  console.log(pc.bold('Workflow'))
  const workflowEntries = Object.entries(situation.workflow)
  if (workflowEntries.length) {
    for (const [key, value] of workflowEntries) console.log(`  • ${key}: ${value}`)
  } else {
    console.log(pc.dim('  none detected'))
  }
  console.log('')

  console.log(pc.bold('Runtime'))
  const runtimeEntries = Object.entries(situation.runtime)
  if (runtimeEntries.length) {
    for (const [key, value] of runtimeEntries) console.log(`  • ${key}: ${value}`)
  } else {
    console.log(pc.dim('  none detected'))
  }
  console.log('')

  console.log(pc.bold('Health'))
  const healthEntries = Object.entries(situation.health)
  if (healthEntries.length) {
    for (const [key, entry] of healthEntries) {
      const color = statusColor(entry.status)
      console.log(`  • ${key}: ${color(`${entry.status} — ${entry.detail}`)}`)
    }
  } else {
    console.log(pc.dim('  no health signals'))
  }
  console.log('')

  console.log(pc.bold('Mode reasoning'))
  for (const reason of situation.modeReasons.slice(0, 8)) {
    console.log(`  → ${reason}`)
  }
  if (situation.mode !== situation.suggestedMode) {
    console.log(pc.dim(`  (suggested ${situation.suggestedMode} because: ${situation.suggestedModeReasons[0] ?? 'signals'})`))
  }
  console.log('')

  console.log(pc.bold('Backends'))
  console.log(`  preferred: ${situation.backends.preferred}`)
  console.log(
    `  available: ${situation.backends.available.length ? situation.backends.available.join(', ') : pc.dim('none on PATH')}`,
  )
  console.log('')

  console.log(pc.dim('Tip: om pack · om mode debug · om wrap grok'))
  console.log('')
}