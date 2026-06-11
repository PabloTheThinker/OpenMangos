import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { realpath } from 'node:fs/promises'
import { runCommand } from '../../probes/util.js'

export function omPackageRoot(): string | null {
  const entry = process.argv[1]
  if (!entry) return null

  const candidates = [entry]
  try {
    candidates.push(realpathSync(entry))
  } catch {
    /* ignore */
  }

  for (const path of candidates) {
    if (path.endsWith('/dist/cli.js')) return resolve(dirname(path), '..')
    if (path.includes('openmangos')) return resolve(dirname(path), '..')
  }

  return null
}

export async function healOmLink(cwd: string): Promise<string[]> {
  const which = await runCommand('which', ['om'], cwd, 2000)
  if (which.ok) return []

  const root = omPackageRoot()
  if (!root) return []

  const link = await runCommand('npm', ['link'], root, 30_000)
  if (link.ok) return ['linked om to PATH via npm link']
  return [`om link failed: ${link.stderr || link.stdout || 'unknown error'}`]
}

export async function detectOmIssues(cwd: string): Promise<Array<{ id: string; message: string }>> {
  const issues: Array<{ id: string; message: string }> = []
  const which = await runCommand('which', ['om'], cwd, 2000)
  if (!which.ok) {
    issues.push({ id: 'om-missing', message: 'om not on PATH (npm link?)' })
    return issues
  }

  const pkgRoot = omPackageRoot()
  if (!pkgRoot) return issues

  try {
    const omPath = which.stdout.split('\n')[0]?.trim()
    if (!omPath) return issues
    const resolved = await realpath(omPath)
    const expected = resolve(pkgRoot, 'dist/cli.js')
    if (!resolved.includes('openmangos') && resolved !== expected) {
      issues.push({
        id: 'om-stale-link',
        message: `om may be stale (${resolved}) — run npm link in OpenMangos repo`,
      })
    }
  } catch {
    /* ignore */
  }

  return issues
}