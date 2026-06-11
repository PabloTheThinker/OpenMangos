import { detectTerminalHost } from '../host.js'
import { runCommand } from '../../probes/util.js'
import { backendAuthLines, probeBackendAuth } from './backends.js'
import { detectOmIssues } from './om.js'
import {
  detectAutoupdateIssue,
  openCodeHealthLines,
  probeOpenCodeHealth,
} from './opencode.js'
import { detectProfileDrift } from './profile.js'
import { mangosDriveStatusLines, inspectMangosDrive } from './mangos-drive.js'
import { detectWorkspaceIssues } from './workspace.js'
export type DoctorSeverity = 'ok' | 'warn' | 'error' | 'info'

export type DoctorIssue = {
  id: string
  severity: DoctorSeverity
  message: string
  fixable: boolean
}

function issue(
  id: string,
  severity: DoctorSeverity,
  message: string,
  fixable: boolean,
): DoctorIssue {
  return { id, severity, message, fixable }
}

export async function detectAllIssues(cwd: string): Promise<{ lines: string[]; issues: DoctorIssue[] }> {
  const lines: string[] = []
  const issues: DoctorIssue[] = []

  for (const omIssue of await detectOmIssues(cwd)) {
    if (omIssue.id === 'om-missing') {
      lines.push(`✗ ${omIssue.message}`)
      issues.push(issue(omIssue.id, 'error', omIssue.message, true))
    } else {
      lines.push(`⚠ ${omIssue.message}`)
      issues.push(issue(omIssue.id, 'warn', omIssue.message, true))
    }
  }
  if (!issues.some((i) => i.id === 'om-missing')) lines.push('✓ om on PATH')

  for (const backend of ['grok', 'claude', 'opencode', 'codex', 'agent'] as const) {
    if (backend === 'opencode') continue
    const found = await runCommand('which', [backend], cwd, 2000)
    const label = backend === 'agent' ? 'cursor (agent)' : backend
    lines.push(found.ok ? `✓ ${label}` : `○ ${label} (not installed)`)
  }

  const openCode = await probeOpenCodeHealth(cwd)
  if (openCode.installed) {
    lines.push(...openCodeHealthLines(openCode))
    const autoupdate = await detectAutoupdateIssue(cwd)
    if (autoupdate) {
      lines.push(`⚠ ${autoupdate.message}`)
      issues.push(issue(autoupdate.id, 'warn', autoupdate.message, true))
    }
    if (openCode.outdated) {
      issues.push(
        issue(
          'opencode-outdated',
          'warn',
          `opencode ${openCode.version} (latest ${openCode.latest})`,
          true,
        ),
      )
    }
    if (openCode.conflictingPaths) {
      issues.push(
        issue('opencode-conflict', 'warn', 'conflicting opencode binaries on PATH', true),
      )
    }
  } else {
    lines.push('○ opencode (not installed)')
    issues.push(issue('opencode-missing', 'info', 'opencode not installed', false))
  }

  const authStatuses = await probeBackendAuth()
  lines.push(...backendAuthLines(authStatuses))
  for (const status of authStatuses) {
    if (!status.installed || status.authenticated) continue
    issues.push(
      issue(
        `${status.backend}-auth`,
        'warn',
        `${status.backend} not authenticated`,
        false,
      ),
    )
  }

  for (const ws of await detectWorkspaceIssues(cwd)) {
    lines.push(`⚠ ${ws.message}`)
    issues.push(issue(ws.id, 'warn', ws.message, true))
  }

  const drift = await detectProfileDrift(cwd)
  if (drift) {
    lines.push(`⚠ ${drift.message}`)
    issues.push(issue(drift.id, 'warn', drift.message, true))
  }

  const mangosStatus = await inspectMangosDrive(cwd)
  if (mangosStatus.enabled) {
    lines.push(...mangosDriveStatusLines(mangosStatus))
    for (const md of mangosStatus.issues) {
      if (md.id === 'agentdrive-missing') {
        lines.push(`○ ${md.message}`)
        issues.push(issue(md.id, 'info', md.message, false))
      } else {
        lines.push(`⚠ ${md.message}`)
        issues.push(issue(md.id, 'warn', md.message, md.fixable))
      }
    }
  }

  const node = await runCommand('node', ['--version'], cwd, 2000)
  if (node.ok) lines.push(`✓ node ${node.stdout}`)
  else {
    lines.push('✗ node missing')
    issues.push(issue('node-missing', 'error', 'node missing', false))
  }

  const host = detectTerminalHost()
  lines.push(host.host === 'warp' ? '✓ Warp terminal host' : `○ host: ${host.host}`)

  return { lines, issues }
}