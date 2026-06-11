import pc from 'picocolors'
import { runCommand } from '../probes/util.js'
import type { VerificationResult, VerificationStep, VerificationStepResult } from './types.js'

export async function runVerification(
  root: string,
  steps: VerificationStep[],
): Promise<VerificationResult> {
  const startedAt = Date.now()
  const results: VerificationStepResult[] = []

  for (const step of steps) {
    const stepStartedAt = Date.now()
    const { stdout, stderr, ok } = await runCommand(
      step.command,
      step.args,
      root,
      step.timeoutMs ?? 5_000,
    )

    results.push({
      step,
      ok,
      stdout,
      stderr,
      durationMs: Date.now() - stepStartedAt,
    })
  }

  const passed = results.filter((r) => r.ok && !r.skipped).length
  const failed = results.filter((r) => !r.ok && !r.skipped).length
  const skipped = results.filter((r) => r.skipped).length

  return {
    root,
    steps: results,
    passed,
    failed,
    skipped,
    ok: failed === 0,
    durationMs: Date.now() - startedAt,
  }
}

function formatStepStatus(result: VerificationStepResult): string {
  if (result.skipped) return pc.dim('skip')
  return result.ok ? pc.green('pass') : pc.red('fail')
}

export function printVerificationReport(result: VerificationResult): void {
  console.log('')
  console.log(pc.bold(pc.cyan('🥭 OpenMangos — Verification')))
  console.log(pc.dim(`   ${result.root}`))
  console.log('')

  if (result.steps.length === 0) {
    console.log(pc.dim('  no verification steps matched this workspace'))
    console.log('')
    return
  }

  for (const stepResult of result.steps) {
    const status = formatStepStatus(stepResult)
    const duration = pc.dim(`(${stepResult.durationMs}ms)`)
    console.log(`  ${status}  ${stepResult.step.label}  ${duration}`)

    if (!stepResult.ok && !stepResult.skipped) {
      const detail = stepResult.stderr || stepResult.stdout
      if (detail) {
        const preview = detail.split('\n').slice(0, 3).join('\n')
        for (const line of preview.split('\n')) {
          console.log(pc.dim(`         ${line}`))
        }
      }
    }
  }

  console.log('')
  const summaryColor = result.ok ? pc.green : pc.red
  console.log(
    summaryColor(
      `  ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped  (${result.durationMs}ms)`,
    ),
  )
  console.log('')
}