import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { readFile, writeFile, access } from 'node:fs/promises'
import { scaffoldOpenCodeIntegration } from '../../adapters/opencode.js'
import { runCommand } from '../../probes/util.js'

export type OpenCodeHealth = {
  installed: boolean
  version: string | null
  latest: string | null
  paths: string[]
  pathVersions: Array<{ path: string; version: string | null }>
  outdated: boolean
  conflictingPaths: boolean
}

export async function probeOpenCodeHealth(cwd = process.cwd()): Promise<OpenCodeHealth> {
  const which = await runCommand('which', ['-a', 'opencode'], cwd, 2000)
  const paths = [...new Set(which.ok ? which.stdout.split('\n').filter(Boolean) : [])]
  const pathVersions = await Promise.all(
    paths.map(async (path) => {
      const result = await runCommand(path, ['--version'], cwd, 5000)
      return {
        path,
        version: result.ok ? result.stdout.split('\n')[0]?.trim() ?? null : null,
      }
    }),
  )
  const version = pathVersions[0]?.version ?? null
  const latestResult = await runCommand('npm', ['view', 'opencode-ai', 'version'], cwd, 8000)
  const latest = latestResult.ok ? latestResult.stdout.trim() || null : null
  const outdated = Boolean(version && latest && version !== latest)
  const uniqueVersions = new Set(pathVersions.map((entry) => entry.version).filter(Boolean))
  const conflictingPaths = paths.length > 1 && uniqueVersions.size > 1
  return {
    installed: paths.length > 0,
    version,
    latest,
    paths,
    pathVersions,
    outdated,
    conflictingPaths,
  }
}

export function npmPrefixFromBin(binPath: string): string {
  return resolve(dirname(binPath), '..')
}

export function resolvePrimaryNpmPrefix(paths: string[]): string {
  const preferred = paths.find((p) => p.includes('/.npm-global/bin/'))
  if (preferred) return npmPrefixFromBin(preferred)
  if (paths[0]) return npmPrefixFromBin(paths[0])
  return join(homedir(), '.npm-global')
}

async function patchAutoupdateDisabled(configPath: string): Promise<boolean> {
  try {
    const existing = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>
    if (existing.autoupdate === false) return false
    existing.autoupdate = false
    await writeFile(configPath, JSON.stringify(existing, null, 2) + '\n', 'utf8')
    return true
  } catch {
    return false
  }
}

export async function healOpenCodeAutoupdate(root: string): Promise<string[]> {
  const healed: string[] = []
  const projectConfig = join(root, 'opencode.json')
  if (await patchAutoupdateDisabled(projectConfig)) {
    healed.push(`set autoupdate: false in ${projectConfig}`)
  }

  const globalConfig = join(homedir(), '.config', 'opencode', 'opencode.json')
  if (await patchAutoupdateDisabled(globalConfig)) {
    healed.push(`set autoupdate: false in ${globalConfig}`)
  }

  const globalJsonc = join(homedir(), '.config', 'opencode', 'opencode.jsonc')
  if (await patchAutoupdateDisabled(globalJsonc)) {
    healed.push(`set autoupdate: false in ${globalJsonc}`)
  }

  return healed
}

export async function healOpenCodeBinaries(cwd: string, health: OpenCodeHealth): Promise<string[]> {
  const healed: string[] = []
  if (!health.installed) return healed
  if (!health.outdated && !health.conflictingPaths) return healed

  const primaryPrefix = resolvePrimaryNpmPrefix(health.paths)
  const targetVersion = health.latest ?? health.version ?? 'latest'
  const install = await runCommand(
    'npm',
    ['install', '-g', `opencode-ai@${targetVersion}`, '--prefix', primaryPrefix],
    cwd,
    120_000,
  )
  if (install.ok) {
    healed.push(`upgraded opencode to ${targetVersion} (${primaryPrefix})`)
  } else {
    healed.push(`upgrade failed: ${install.stderr || install.stdout || 'unknown error'}`)
    return healed
  }

  const target = health.latest ?? health.version
  for (const entry of health.pathVersions) {
    const prefix = npmPrefixFromBin(entry.path)
    if (prefix === primaryPrefix) continue
    if (!entry.version || !target || entry.version === target) continue
    const uninstall = await runCommand(
      'npm',
      ['uninstall', '-g', 'opencode-ai', '--prefix', prefix],
      cwd,
      60_000,
    )
    if (uninstall.ok) healed.push(`removed stale opencode at ${prefix} (${entry.version})`)
  }

  return healed
}

export async function healOpenCodeScaffold(root: string): Promise<string[]> {
  const pluginPath = join(root, '.opencode', 'plugins', 'openmangos.ts')
  try {
    await access(pluginPath)
    return []
  } catch {
    const written = await scaffoldOpenCodeIntegration(root)
    return written.map((p) => `scaffolded ${p}`)
  }
}

export function openCodeHealthLines(health: OpenCodeHealth): string[] {
  if (!health.installed) return []
  const lines: string[] = []
  if (health.version) {
    const label = health.outdated
      ? `⚠ opencode ${health.version} (latest: ${health.latest})`
      : `✓ opencode ${health.version}`
    lines.push(label)
  }
  if (health.conflictingPaths) {
    lines.push(
      `⚠ conflicting opencode versions: ${health.pathVersions.map((entry) => `${entry.path} (${entry.version ?? '?'})`).join(', ')}`,
    )
    lines.push('  Heal: om heal')
  }
  if (health.outdated) lines.push('  Heal: om heal')
  return lines
}

export async function detectAutoupdateIssue(root: string): Promise<{
  id: string
  message: string
} | null> {
  const configPath = join(root, 'opencode.json')
  try {
    const raw = JSON.parse(await readFile(configPath, 'utf8')) as { autoupdate?: boolean | string }
    if (raw.autoupdate === false) return null
    return {
      id: 'opencode-autoupdate',
      message: 'opencode autoupdate enabled (can hang npm installs on startup)',
    }
  } catch {
    return null
  }
}