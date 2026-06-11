import { readFile, realpath } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { runCommand } from '../../probes/util.js'
import { omPackageRoot } from '../heal/om.js'
import { loadInstallState, type InstallMethod } from './state.js'

export type OmInstallTarget = {
  method: InstallMethod | 'unknown'
  omPath?: string
  packageRoot?: string
  globalInstall: boolean
}

export async function readPackageVersion(root: string): Promise<string> {
  try {
    const raw = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { version?: string }
    return raw.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export async function resolveOmInstallTarget(cwd = process.cwd()): Promise<OmInstallTarget> {
  const state = await loadInstallState()
  const pkgRoot = omPackageRoot()
  const which = await runCommand('which', ['om'], cwd, 2000)
  const omPath = which.ok ? which.stdout.split('\n')[0]?.trim() : undefined

  let method: InstallMethod | 'unknown' = state.install_method ?? 'unknown'
  let globalInstall = false

  if (omPath) {
    try {
      const resolved = await realpath(omPath)
      if (resolved.includes('/node_modules/openmangos/') || resolved.includes('/.npm-global/')) {
        method = 'npm-global'
        globalInstall = true
      } else if (resolved.includes('openmangos')) {
        method = method === 'unknown' ? 'npm-link' : method
      }
    } catch {
      /* ignore */
    }
  }

  if (method === 'unknown' && pkgRoot) method = 'npm-link'

  return {
    method,
    omPath,
    packageRoot: pkgRoot ?? undefined,
    globalInstall,
  }
}

export async function fetchPublishedVersion(): Promise<string | undefined> {
  const view = await runCommand('npm', ['view', 'openmangos', 'version'], process.cwd(), 10_000)
  if (!view.ok) return undefined
  return view.stdout.trim() || undefined
}