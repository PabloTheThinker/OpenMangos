import pc from 'picocolors'
import { userInfo } from 'node:os'
import { sortAvailableBackends } from '../backend-select.js'
import { initWorkspace } from '../init.js'
import { inspectMangosDrive } from '../heal/mangos-drive.js'
import { healMangosDrive } from '../heal/mangos-drive.js'
import { checkGlyph, runInstallChecks, type InstallCheck } from '../install/checks.js'
import { runInstallActions } from '../install/run.js'
import { loadInstallState, saveInstallState } from '../install/state.js'
import { loadProfile, saveProfile } from '../profile.js'
import { buildSituation } from '../situation.js'
import { promptSelect, promptYesNo, isInteractiveTerminal } from '../../ui/prompt.js'
import type { BackendId } from '../../types.js'

export type OnboardOptions = {
  directory: string
  yes?: boolean
  install?: boolean
  withOpencode?: boolean
}

export type OnboardResult = {
  completed: boolean
  statePath: string
  checks: InstallCheck[]
  actions: string[]
  preferredBackend?: BackendId
}

function printBanner(): void {
  console.error('')
  console.error(pc.bold(pc.yellow('🥭 OpenMangos — onboarding')))
  console.error(pc.dim('The terminal adapts to the problem. The model adapts to the terminal.'))
  console.error('')
}

function printStep(current: number, total: number, title: string): void {
  console.error(pc.bold(pc.cyan(`[${current}/${total}] ${title}`)))
  console.error('')
}

function printChecks(checks: InstallCheck[]): void {
  for (const check of checks) {
    const glyph = checkGlyph(check.status)
    const color =
      check.status === 'ok' ? pc.green
      : check.status === 'fail' ? pc.red
      : pc.yellow
    console.error(`  ${color(glyph)} ${check.label}: ${pc.dim(check.detail)}`)
  }
  console.error('')
}

function printSummary(root: string, backend: BackendId, driveName?: string): void {
  console.error(pc.bold(pc.green('✓ Onboarding complete')))
  console.error('')
  console.error(pc.dim('Your setup:'))
  console.error(`  workspace   ${root}`)
  if (driveName) console.error(`  mangos drive ${driveName}`)
  console.error(`  backend     ${backend}`)
  console.error('')
  console.error(pc.bold('Next steps'))
  console.error(`  ${pc.cyan('om')}              adaptive bootstrap → agent`)
  console.error(`  ${pc.cyan('om sense')}        probe this workspace`)
  console.error(`  ${pc.cyan('om drive status')}  Mangos Drive manifest`)
  console.error(`  ${pc.cyan('om tui')}          orchestrator shell`)
  console.error('')
}

export async function maybePromptOnboarding(root: string): Promise<boolean> {
  if (process.env.OPENMANGOS_SKIP_ONBOARD === '1') return false
  if (!isInteractiveTerminal()) return false

  const state = await loadInstallState()
  if (state.onboarding_completed_at) return false

  console.error('')
  console.error(pc.yellow('🥭 First time with OpenMangos?'))
  console.error(pc.dim('  Run the 2-minute setup wizard, or skip and launch now.'))
  console.error('')

  const start = await promptYesNo('Start onboarding now?', false)
  if (!start) return false

  await runOnboardingWizard({ directory: root })
  return true
}

export async function runOnboardingWizard(opts: OnboardOptions): Promise<OnboardResult> {
  const root = opts.directory
  const totalSteps = 6
  const actions: string[] = []
  let checks = await runInstallChecks(root)

  printBanner()

  // Step 1 — Welcome
  printStep(1, totalSteps, 'Welcome')
  if (!opts.yes) {
    console.error('OpenMangos senses your workspace, builds context, and launches any AI backend.')
    console.error('Memory flows through your personal Mangos Drive on AgentDrive.')
    console.error('')
    const cont = await promptYesNo('Continue setup?', true)
    if (!cont) {
      const state = await loadInstallState()
      return { completed: false, statePath: await saveInstallState(state), checks, actions }
    }
  }

  // Step 2 — Prerequisites
  printStep(2, totalSteps, 'Prerequisites')
  printChecks(checks)

  const omMissing = checks.find((c) => c.id === 'om' && c.status !== 'ok')
  const backendsMissing = checks.find((c) => c.id === 'backends' && c.status !== 'ok')
  const nodeFail = checks.find((c) => c.id === 'node' && c.status === 'fail')

  if (nodeFail) {
    console.error(pc.red('Node.js 20+ is required. Install Node, then re-run: om onboard'))
    const state = await loadInstallState()
    return { completed: false, statePath: await saveInstallState(state), checks, actions }
  }

  const shouldInstall =
    opts.install ?? (omMissing ? await promptYesNo('Install / link om to PATH now?', true) : false)

  if (shouldInstall) {
    const withOpencode =
      opts.withOpencode ??
      (backendsMissing ?
        opts.yes ? true
        : await promptYesNo('Install OpenCode (recommended OSS agent)?', true)
      : false)

    const result = await runInstallActions(root, { withOpencode, build: true })
    actions.push(...result.actions, ...result.errors)
    for (const action of result.actions) console.error(pc.green(`  ↻ ${action}`))
    for (const err of result.errors) console.error(pc.red(`  ✗ ${err}`))
    console.error('')
    checks = await runInstallChecks(root)
    printChecks(checks)
  }

  // Step 3 — Workspace
  printStep(3, totalSteps, 'Workspace setup')
  const situation = await buildSituation(root)
  const initResult = await initWorkspace(root)
  actions.push(`initialized workspace at ${root}`)
  console.error(pc.green(`  ✓ profile: ${initResult.profilePath}`))
  console.error(pc.green(`  ✓ config:  ${initResult.configPath}`))
  if (initResult.mangosDrive) {
    console.error(
      pc.green(
        `  ✓ mangos drive: ${initResult.mangosDrive.displayName} (${initResult.mangosDrive.driveId})`,
      ),
    )
  }
  console.error('')

  // Step 4 — Mangos Drive
  printStep(4, totalSteps, 'Mangos Drive')
  const healed = await healMangosDrive(root)
  actions.push(...healed)
  const drive = await inspectMangosDrive(root)
  if (drive.provisioned) {
    console.error(pc.green(`  ✓ ${drive.displayName} (${drive.driveId})`))
    console.error(pc.dim(`    workspace: ${drive.workspaceSwarm}`))
    console.error(pc.dim(`    personal:  ${drive.personalSwarm}`))
  } else if (drive.enabled) {
    console.error(pc.yellow('  ⚠ Mangos Drive not provisioned — run om drive provision'))
  } else {
    console.error(pc.dim('  ○ Mangos Drive disabled in config'))
  }
  console.error('')

  // Step 5 — Preferred backend
  printStep(5, totalSteps, 'Agent backend')
  const available = sortAvailableBackends(situation.backends.available)
  let preferred: BackendId = 'opencode'

  if (!available.length) {
    console.error(pc.yellow('  No agent backends on PATH yet.'))
    console.error(pc.dim('  Install one: npm install -g opencode-ai --prefix ~/.npm-global'))
    console.error('')
  } else if (opts.yes) {
    preferred = available.includes('opencode') ? 'opencode' : available[0]!
    console.error(pc.green(`  ✓ default backend: ${preferred}`))
  } else {
    preferred = await promptSelect(
      pc.bold('Pick your default agent backend:'),
      available.map((id) => ({ value: id, label: id })),
      Math.max(0, available.indexOf('opencode')),
    )
    console.error(pc.green(`  ✓ preferred: ${preferred}`))
  }

  const profile = await loadProfile(root)
  profile.backends = { ...profile.backends, preferred }
  await saveProfile(root, profile)
  console.error('')

  // Step 6 — Finish
  printStep(6, totalSteps, 'Ready')
  const displayName = drive.displayName ?? 'Mangos Drive'
  const state = await loadInstallState()
  const now = new Date().toISOString()
  state.user_id = process.env.OPENMANGOS_USER ?? userInfo().username
  state.installed_at = state.installed_at ?? now
  state.onboarding_completed_at = now
  state.preferred_backend = preferred
  state.mangos_display_name = displayName
  state.last_workspace = root
  if (!state.install_method) state.install_method = 'dev'

  const statePath = await saveInstallState(state)
  actions.push(`saved install state → ${statePath}`)

  printSummary(root, preferred, drive.provisioned ? displayName : undefined)

  return {
    completed: true,
    statePath,
    checks,
    actions,
    preferredBackend: preferred,
  }
}