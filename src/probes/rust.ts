import { join } from 'node:path'
import type { ProbeResult } from '../types.js'
import { firstExisting, readText } from './util.js'

function parseCargoToml(text: string): { edition?: string; binaries: string[] } {
  const editionMatch = /edition\s*=\s*["']([^"']+)["']/.exec(text)
  const binaries: string[] = []

  for (const match of text.matchAll(/\[\[bin\]\][\s\S]*?name\s*=\s*["']([^"']+)["']/g)) {
    binaries.push(match[1])
  }

  return { edition: editionMatch?.[1], binaries }
}

export async function probeRust(root: string): Promise<ProbeResult> {
  const signals: ProbeResult['signals'] = []
  const modeHints: ProbeResult['modeHints'] = {}

  const cargoToml = await firstExisting(root, ['Cargo.toml'])
  if (!cargoToml) {
    return { probe: 'rust', signals, modeHints }
  }

  signals.push({ source: 'rust', kind: 'runtime', label: 'runtime', value: 'rust' })
  signals.push({ source: 'rust', kind: 'stack', label: 'manifest', value: cargoToml })
  modeHints.build = ['Cargo.toml detected']

  const text = await readText(join(root, cargoToml))
  if (text) {
    const { edition, binaries } = parseCargoToml(text)
    if (edition) {
      signals.push({ source: 'rust', kind: 'stack', label: 'edition', value: edition })
    }
    for (const binary of binaries.slice(0, 8)) {
      signals.push({ source: 'rust', kind: 'stack', label: 'binary', value: binary })
    }
  }

  if (await firstExisting(root, ['Cargo.lock'])) {
    signals.push({ source: 'rust', kind: 'stack', label: 'lockfile', value: 'Cargo.lock' })
  }

  return { probe: 'rust', signals, modeHints }
}