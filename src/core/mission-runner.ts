import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROFILE_DIR } from './profile.js'
import type { MissionPlan, MissionPhase } from '../types.js'
import { resolveVerificationSteps } from '../verify/registry.js'
import { runVerification } from '../verify/runner.js'
import { buildSituation } from './situation.js'

export interface PhaseRunResult {
  phase: string
  tasks: string[]
  verifyOk: boolean
  verifySummary: string
}

export async function loadMissionPlan(root: string): Promise<MissionPlan | null> {
  try {
    const text = await readFile(join(root, PROFILE_DIR, 'mission', 'plan.json'), 'utf8')
    return JSON.parse(text) as MissionPlan
  } catch {
    return null
  }
}

export async function runMissionPhases(
  root: string,
  options: { autoVerify?: boolean; phases?: string[] } = {},
): Promise<PhaseRunResult[]> {
  const plan = await loadMissionPlan(root)
  if (!plan) throw new Error('No mission plan. Run: om mission plan "your goal"')

  const situation = await buildSituation(root)
  const steps = await resolveVerificationSteps(situation, root)

  const targetPhases: MissionPhase[] =
    options.phases?.length ?
      plan.phases.filter((p) => options.phases!.some((n) => p.name.toLowerCase().includes(n.toLowerCase())))
    : plan.phases

  const results: PhaseRunResult[] = []

  for (const phase of targetPhases) {
    let verifyOk = true
    let verifySummary = 'skipped'

    if (options.autoVerify !== false && steps.length > 0) {
      const verify = await runVerification(root, steps)
      verifyOk = verify.ok
      verifySummary = `${verify.passed} passed, ${verify.failed} failed`
    }

    results.push({
      phase: phase.name,
      tasks: phase.tasks,
      verifyOk,
      verifySummary,
    })

    if (!verifyOk) break
  }

  return results
}