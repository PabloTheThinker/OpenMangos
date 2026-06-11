import { homedir } from 'node:os'
import { join } from 'node:path'
import { runCommand } from '../../probes/util.js'
import { healOmLink, omPackageRoot } from '../heal/om.js'
import { healOpenCodeBinaries, probeOpenCodeHealth } from '../heal/opencode.js'
import type { InstallMethod } from './state.js'

export type InstallRunResult = {
  actions: string[]
  errors: string[]
  method?: InstallMethod
}

export async function buildOpenMangosPackage(root: string): Promise<string[]> {
  const build = await runCommand('npm', ['run', 'build'], root, 120_000)
  if (build.ok) return ['built OpenMangos package']
  return [`build failed: ${build.stderr || build.stdout || 'unknown'}`]
}

export async function linkOpenMangosGlobally(cwd: string): Promise<string[]> {
  return healOmLink(cwd)
}

export async function installOmNpmGlobal(cwd: string): Promise<string[]> {
  const install = await runCommand('npm', ['install', '-g', 'openmangos'], cwd, 120_000)
  if (install.ok) return ['installed openmangos globally via npm']
  return [`npm install -g openmangos failed: ${install.stderr || install.stdout || 'unknown'}`]
}

export async function installOpenCodeAi(prefix?: string): Promise<string[]> {
  const targetPrefix = prefix ?? join(homedir(), '.npm-global')
  const install = await runCommand(
    'npm',
    ['install', '-g', 'opencode-ai@latest', '--prefix', targetPrefix],
    process.cwd(),
    180_000,
  )
  if (install.ok) return [`installed opencode-ai → ${targetPrefix}/bin/opencode`]
  return [`opencode install failed: ${install.stderr || install.stdout || 'unknown'}`]
}

export async function runInstallActions(
  cwd: string,
  opts: { global?: boolean; withOpencode?: boolean; build?: boolean } = {},
): Promise<InstallRunResult> {
  const actions: string[] = []
  const errors: string[] = []
  const pkgRoot = omPackageRoot() ?? cwd

  if (opts.build !== false) {
    const built = await buildOpenMangosPackage(pkgRoot)
    for (const line of built) {
      if (line.startsWith('build failed')) errors.push(line)
      else actions.push(line)
    }
  }

  if (opts.global) {
    const globalResult = await installOmNpmGlobal(cwd)
    for (const line of globalResult) {
      if (line.includes('failed')) errors.push(line)
      else actions.push(line)
    }
    return { actions, errors, method: 'npm-global' }
  }

  const linked = await linkOpenMangosGlobally(cwd)
  for (const line of linked) {
    if (line.includes('failed')) errors.push(line)
    else actions.push(line)
  }

  if (opts.withOpencode) {
    const health = await probeOpenCodeHealth(cwd)
    if (!health.installed) {
      const oc = await installOpenCodeAi()
      for (const line of oc) {
        if (line.includes('failed')) errors.push(line)
        else actions.push(line)
      }
    } else if (health.outdated) {
      const upgraded = await healOpenCodeBinaries(cwd, health)
      actions.push(...upgraded)
    }
  }

  return { actions, errors, method: 'npm-link' }
}