import { runCommand } from '../../probes/util.js'
import { resolveAgentDriveBin } from '../../integrations/agentdrive.js'
import { omPackageRoot } from '../heal/om.js'
import type { BackendId } from '../../types.js'

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'skip'

export type InstallCheck = {
  id: string
  label: string
  status: CheckStatus
  detail: string
  fixable: boolean
}

const BACKENDS: BackendId[] = ['opencode', 'grok', 'claude', 'codex', 'cursor']

export async function runInstallChecks(cwd: string): Promise<InstallCheck[]> {
  const checks: InstallCheck[] = []

  const node = await runCommand('node', ['--version'], cwd, 3000)
  if (node.ok) {
    const major = Number.parseInt(node.stdout.replace('v', '').split('.')[0] ?? '0', 10)
    checks.push({
      id: 'node',
      label: 'Node.js',
      status: major >= 20 ? 'ok' : 'warn',
      detail: node.stdout.trim(),
      fixable: false,
    })
  } else {
    checks.push({
      id: 'node',
      label: 'Node.js',
      status: 'fail',
      detail: 'not found (requires Node 20+)',
      fixable: false,
    })
  }

  const om = await runCommand('which', ['om'], cwd, 2000)
  checks.push({
    id: 'om',
    label: 'om CLI',
    status: om.ok ? 'ok' : 'warn',
    detail: om.ok ? om.stdout.trim() : 'not on PATH',
    fixable: true,
  })

  const pkgRoot = omPackageRoot()
  if (pkgRoot) {
    checks.push({
      id: 'om-package',
      label: 'OpenMangos package',
      status: 'ok',
      detail: pkgRoot,
      fixable: false,
    })
  }

  const installedBackends: BackendId[] = []
  for (const backend of BACKENDS) {
    const cmd = backend === 'cursor' ? 'agent' : backend
    const found = await runCommand('which', [cmd], cwd, 2000)
    if (found.ok) installedBackends.push(backend)
  }

  checks.push({
    id: 'backends',
    label: 'Agent backends',
    status: installedBackends.length ? 'ok' : 'warn',
    detail: installedBackends.length ? installedBackends.join(', ') : 'none on PATH',
    fixable: true,
  })

  const python = await runCommand('python3', ['--version'], cwd, 3000)
  checks.push({
    id: 'python',
    label: 'Python 3',
    status: python.ok ? 'ok' : 'warn',
    detail: python.ok ? python.stdout.trim() : 'not found (required for AgentDrive install)',
    fixable: false,
  })

  const adBin = await resolveAgentDriveBin({})
  checks.push({
    id: 'agentdrive',
    label: 'AgentDrive CLI',
    status: adBin ? 'ok' : 'warn',
    detail: adBin ?? 'not found (Mangos Drive recall/remember disabled)',
    fixable: true,
  })

  return checks
}

export function checkGlyph(status: CheckStatus): string {
  if (status === 'ok') return '✓'
  if (status === 'warn') return '⚠'
  if (status === 'fail') return '✗'
  return '○'
}