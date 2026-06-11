import { runCommand } from '../../probes/util.js'
import { resetOpenMangosData } from '../reset.js'
import { resolveOmInstallTarget } from './detect.js'

export type UninstallResult = {
  actions: string[]
  errors: string[]
  dataRemoved: string[]
  keepData: boolean
}

async function removeOmFromPath(): Promise<{ actions: string[]; errors: string[] }> {
  const actions: string[] = []
  const errors: string[] = []

  const unlink = await runCommand('npm', ['unlink', '-g', 'openmangos'], process.cwd(), 30_000)
  if (unlink.ok) actions.push('removed global om link (npm unlink -g openmangos)')

  const uninstall = await runCommand('npm', ['uninstall', '-g', 'openmangos'], process.cwd(), 60_000)
  if (uninstall.ok) actions.push('uninstalled openmangos globally (npm uninstall -g)')

  if (!actions.length) {
    errors.push(
      unlink.stderr || uninstall.stderr || unlink.stdout || uninstall.stdout || 'could not remove om',
    )
  }

  return { actions, errors }
}

export async function uninstallOpenMangos(
  root: string,
  opts: { keepData: boolean } = { keepData: true },
): Promise<UninstallResult> {
  const target = await resolveOmInstallTarget(root)
  const actions: string[] = []
  const errors: string[] = []
  const dataRemoved: string[] = []

  const removed = await removeOmFromPath()
  actions.push(...removed.actions)
  errors.push(...removed.errors)

  const stillThere = await runCommand('which', ['om'], root, 2000)
  if (stillThere.ok) {
    errors.push(`om still on PATH: ${stillThere.stdout.trim()}`)
  } else {
    actions.push('om removed from PATH')
  }

  if (!opts.keepData) {
    const reset = await resetOpenMangosData(root, {
      global: true,
      workspace: true,
      mangosSwarms: true,
      agentsMd: true,
    })
    dataRemoved.push(...reset.removed)
    errors.push(...reset.errors)
  }

  return { actions, errors, dataRemoved, keepData: opts.keepData }
}