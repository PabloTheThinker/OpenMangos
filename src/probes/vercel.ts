import { join } from 'node:path'
import type { ProbeResult } from '../types.js'
import { firstExisting, readJson } from './util.js'

interface VercelJson {
  framework?: string
  buildCommand?: string
  outputDirectory?: string
  regions?: string[]
}

interface VercelProjectJson {
  projectId?: string
  orgId?: string
}

export async function probeVercel(root: string): Promise<ProbeResult> {
  const signals: ProbeResult['signals'] = []
  const modeHints: ProbeResult['modeHints'] = {}

  const vercelJsonPath = await firstExisting(root, ['vercel.json'])
  const projectJsonPath = await firstExisting(root, ['.vercel/project.json'])

  if (!vercelJsonPath && !projectJsonPath) {
    return { probe: 'vercel', signals, modeHints }
  }

  signals.push({ source: 'vercel', kind: 'infra', label: 'deploy_target', value: 'vercel' })
  modeHints.ship = ['vercel deployment config detected']

  if (vercelJsonPath) {
    const config = await readJson<VercelJson>(join(root, vercelJsonPath))
    if (config) {
      if (config.framework) {
        signals.push({ source: 'vercel', kind: 'stack', label: 'framework', value: config.framework })
      }
      if (config.buildCommand) {
        signals.push({ source: 'vercel', kind: 'workflow', label: 'build_command', value: config.buildCommand })
      }
      if (config.outputDirectory) {
        signals.push({ source: 'vercel', kind: 'workflow', label: 'output', value: config.outputDirectory })
      }
      if (config.regions?.length) {
        signals.push({
          source: 'vercel',
          kind: 'infra',
          label: 'regions',
          value: config.regions.slice(0, 6).join(', '),
        })
      }
    }
    signals.push({ source: 'vercel', kind: 'infra', label: 'config', value: vercelJsonPath })
  }

  if (projectJsonPath) {
    const project = await readJson<VercelProjectJson>(join(root, projectJsonPath))
    if (project?.projectId) {
      signals.push({ source: 'vercel', kind: 'infra', label: 'project_id', value: project.projectId })
    }
    signals.push({ source: 'vercel', kind: 'infra', label: 'linked', value: 'present' })
  }

  return { probe: 'vercel', signals, modeHints }
}