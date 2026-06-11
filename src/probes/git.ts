import type { ProbeResult } from '../types.js'
import { runCommand } from './util.js'

export async function probeGit(root: string): Promise<ProbeResult> {
  const signals: ProbeResult['signals'] = []
  const modeHints: ProbeResult['modeHints'] = {}
  const errors: string[] = []

  const inside = await runCommand('git', ['rev-parse', '--is-inside-work-tree'], root)
  if (!inside.ok || inside.stdout !== 'true') {
    return { probe: 'git', signals, modeHints, errors: ['not a git repository'] }
  }

  const branch = await runCommand('git', ['branch', '--show-current'], root)
  if (branch.ok && branch.stdout) {
    signals.push({
      source: 'git',
      kind: 'workflow',
      label: 'branch',
      value: branch.stdout,
    })
  }

  const status = await runCommand('git', ['status', '--porcelain'], root)
  if (status.ok) {
    const dirtyCount = status.stdout ? status.stdout.split('\n').filter(Boolean).length : 0
    signals.push({
      source: 'git',
      kind: 'workflow',
      label: 'dirty_files',
      value: String(dirtyCount),
    })
    if (dirtyCount > 0) {
      modeHints.review = [`${dirtyCount} uncommitted change(s)`]
    }
  } else {
    errors.push('git status failed')
  }

  const lastCommit = await runCommand('git', ['log', '-1', '--pretty=%h %s (%cr)'], root)
  if (lastCommit.ok && lastCommit.stdout) {
    signals.push({
      source: 'git',
      kind: 'workflow',
      label: 'last_commit',
      value: lastCommit.stdout,
    })
  }

  return { probe: 'git', signals, modeHints, errors: errors.length ? errors : undefined }
}