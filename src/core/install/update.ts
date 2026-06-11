import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { runCommand } from '../../probes/util.js'
import { omPackageRoot } from '../heal/om.js'
import {
  fetchPublishedVersion,
  readPackageVersion,
  resolveOmInstallTarget,
} from './detect.js'
import { buildOpenMangosPackage, installOmNpmGlobal, linkOpenMangosGlobally } from './run.js'

export type UpdateInfo = {
  currentVersion: string
  latestVersion?: string
  updateAvailable: boolean
  method: string
  packageRoot?: string
}

export type UpdateResult = {
  actions: string[]
  errors: string[]
  beforeVersion: string
  afterVersion: string
}

export async function getUpdateInfo(cwd = process.cwd()): Promise<UpdateInfo> {
  const target = await resolveOmInstallTarget(cwd)
  const pkgRoot = target.packageRoot ?? omPackageRoot() ?? cwd
  const currentVersion = await readPackageVersion(pkgRoot)
  const published = target.method === 'npm-global' ? await fetchPublishedVersion() : undefined
  const updateAvailable = published ? published !== currentVersion : false

  return {
    currentVersion,
    latestVersion: published,
    updateAvailable,
    method: target.method,
    packageRoot: pkgRoot,
  }
}

async function gitPull(root: string): Promise<string[]> {
  const gitDir = join(root, '.git')
  try {
    await access(gitDir)
  } catch {
    return []
  }

  const pull = await runCommand('git', ['pull', '--ff-only'], root, 120_000)
  if (pull.ok) return pull.stdout.trim() ? [`git pull: ${pull.stdout.trim()}`] : ['git pull: up to date']
  return [`git pull skipped: ${pull.stderr || pull.stdout || 'failed'}`]
}

async function npmInstallDeps(root: string): Promise<string[]> {
  const install = await runCommand('npm', ['install'], root, 180_000)
  if (install.ok) return ['npm install']
  return [`npm install failed: ${install.stderr || install.stdout || 'unknown'}`]
}

export async function runUpdate(
  cwd = process.cwd(),
  opts: { global?: boolean; pull?: boolean; check?: boolean } = {},
): Promise<UpdateResult> {
  const info = await getUpdateInfo(cwd)
  const target = await resolveOmInstallTarget(cwd)
  const pkgRoot = target.packageRoot ?? omPackageRoot() ?? cwd
  const actions: string[] = []
  const errors: string[] = []
  const beforeVersion = info.currentVersion

  if (opts.check) {
    return { actions, errors, beforeVersion, afterVersion: beforeVersion }
  }

  const useGlobal = opts.global ?? target.method === 'npm-global'

  if (useGlobal) {
    const result = await installOmNpmGlobal(cwd)
    for (const line of result) {
      if (line.includes('failed')) errors.push(line)
      else actions.push(line)
    }
  } else {
    if (opts.pull !== false) {
      for (const line of await gitPull(pkgRoot)) {
        if (line.includes('failed') || line.includes('skipped')) actions.push(line)
        else actions.push(line)
      }
    }

    for (const line of await npmInstallDeps(pkgRoot)) {
      if (line.includes('failed')) errors.push(line)
      else actions.push(line)
    }

    for (const line of await buildOpenMangosPackage(pkgRoot)) {
      if (line.startsWith('build failed')) errors.push(line)
      else actions.push(line)
    }

    for (const line of await linkOpenMangosGlobally(cwd)) {
      if (line.includes('failed')) errors.push(line)
      else actions.push(line)
    }
    if (!actions.some((a) => a.includes('linked'))) actions.push('relinked om to PATH')
  }

  const afterVersion = await readPackageVersion(pkgRoot)
  return { actions, errors, beforeVersion, afterVersion }
}