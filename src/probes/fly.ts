import { join } from 'node:path'
import type { ProbeResult } from '../types.js'
import { firstExisting, readText } from './util.js'

function parseFlyToml(text: string): { app?: string; primaryRegion?: string } {
  const appMatch = /^app\s*=\s*["']?([^"'\n]+)["']?\s*$/m.exec(text)
  const regionMatch = /^primary_region\s*=\s*["']?([^"'\n]+)["']?\s*$/m.exec(text)
  return { app: appMatch?.[1]?.trim(), primaryRegion: regionMatch?.[1]?.trim() }
}

export async function probeFly(root: string): Promise<ProbeResult> {
  const signals: ProbeResult['signals'] = []
  const modeHints: ProbeResult['modeHints'] = {}

  const flyToml = await firstExisting(root, ['fly.toml'])
  if (!flyToml) {
    return { probe: 'fly', signals, modeHints }
  }

  signals.push({ source: 'fly', kind: 'infra', label: 'deploy_target', value: 'fly.io' })
  signals.push({ source: 'fly', kind: 'infra', label: 'config', value: flyToml })
  modeHints.ship = ['fly.toml detected']
  modeHints.infra = ['fly.io app config present']

  const text = await readText(join(root, flyToml))
  if (text) {
    const { app, primaryRegion } = parseFlyToml(text)
    if (app) {
      signals.push({ source: 'fly', kind: 'infra', label: 'app', value: app })
    }
    if (primaryRegion) {
      signals.push({ source: 'fly', kind: 'infra', label: 'region', value: primaryRegion })
    }
  }

  return { probe: 'fly', signals, modeHints }
}