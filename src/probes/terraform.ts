import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProbeResult } from '../types.js'
import { firstExisting, runCommand } from './util.js'

async function hasTerraformFiles(root: string): Promise<boolean> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  if (entries.some((e) => e.isFile() && e.name.endsWith('.tf'))) return true

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const nested = await readdir(join(root, entry.name)).catch(() => [])
    if (nested.some((name) => name.endsWith('.tf'))) return true
  }
  return false
}

export async function probeTerraform(root: string): Promise<ProbeResult> {
  const signals: ProbeResult['signals'] = []
  const modeHints: ProbeResult['modeHints'] = {}

  const hasTf = await hasTerraformFiles(root)
  if (!hasTf) return { probe: 'terraform', signals, modeHints }

  signals.push({ source: 'terraform', kind: 'infra', label: 'iac', value: 'terraform' })
  modeHints.infra = ['terraform files detected']

  if (await firstExisting(root, ['.terraform.lock.hcl'])) {
    signals.push({ source: 'terraform', kind: 'infra', label: 'lockfile', value: 'present' })
  }

  const version = await runCommand('terraform', ['version', '-json'], root, 3000)
  if (version.ok) {
    signals.push({ source: 'terraform', kind: 'infra', label: 'cli', value: 'available' })
  }

  return { probe: 'terraform', signals, modeHints }
}