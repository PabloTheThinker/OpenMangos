import { detectAllIssues } from './heal/detect.js'
import type { DoctorIssue } from './heal/detect.js'
import { runHealPass } from './heal/index.js'

export type { DoctorIssue, DoctorSeverity } from './heal/detect.js'

export type DoctorReport = {
  healthy: boolean
  lines: string[]
  issues: DoctorIssue[]
  healed: string[]
}

export async function runDoctor(
  cwd = process.cwd(),
  opts: { fix?: boolean } = {},
): Promise<DoctorReport> {
  const { lines, issues } = await detectAllIssues(cwd)

  let healed: string[] = []
  if (opts.fix) {
    lines.push('')
    lines.push('🩹 healing…')
    healed = await runHealPass(cwd)
    if (healed.length) {
      for (const action of healed) lines.push(`  ↻ ${action}`)
    } else {
      lines.push('  ○ nothing to heal')
    }

    lines.push('')
    lines.push('Re-check:')
    const after = await detectAllIssues(cwd)
    lines.push(...after.lines.map((line) => `  ${line}`))
    issues.length = 0
    issues.push(...after.issues)
  }

  const healthy = !issues.some((issue) => issue.severity === 'error' || issue.severity === 'warn')
  return { healthy, lines, issues, healed }
}

/** @deprecated use runDoctor */
export async function collectDoctorLines(cwd = process.cwd()): Promise<string[]> {
  return (await runDoctor(cwd)).lines
}