import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProbeResult } from '../types.js'
import { firstExisting, pathExists } from './util.js'

async function listWorkflows(root: string): Promise<string[]> {
  const workflowsDir = join(root, '.github', 'workflows')
  if (!(await pathExists(workflowsDir))) return []
  const entries = await readdir(workflowsDir).catch(() => [])
  return entries.filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
}

function extractWorkflowName(content: string, filename: string): string {
  const match = /^name:\s*(.+)$/m.exec(content)
  return match?.[1]?.trim() ?? filename.replace(/\.ya?ml$/, '')
}

export async function probeCi(root: string): Promise<ProbeResult> {
  const signals: ProbeResult['signals'] = []
  const modeHints: ProbeResult['modeHints'] = {}

  const workflows = await listWorkflows(root)
  if (workflows.length === 0) {
    const alt = await firstExisting(root, ['.gitlab-ci.yml', 'Jenkinsfile', '.circleci/config.yml'])
    if (alt) {
      signals.push({ source: 'ci', kind: 'workflow', label: 'ci_config', value: alt })
      modeHints.ship = [`CI config: ${alt}`]
    }
    return { probe: 'ci', signals, modeHints }
  }

  signals.push({ source: 'ci', kind: 'workflow', label: 'ci_provider', value: 'github-actions' })
  modeHints.ship = ['github actions workflows detected']

  for (const file of workflows.slice(0, 8)) {
    const path = join(root, '.github', 'workflows', file)
    const content = await readFile(path, 'utf8').catch(() => '')
    const name = extractWorkflowName(content, file)
    signals.push({ source: 'ci', kind: 'workflow', label: 'workflow', value: name })
  }

  return { probe: 'ci', signals, modeHints }
}