import type { ProbeResult } from '../types.js'
import { runCommand } from './util.js'

const DEV_PORTS = new Set([3000, 3001, 4000, 4173, 5173, 5432, 6379, 8000, 8080, 9229])

function parseSsOutput(stdout: string): Array<{ port: number; process?: string }> {
  const results: Array<{ port: number; process?: string }> = []
  for (const line of stdout.split('\n')) {
    const match = /:(\d+)\s/.exec(line)
    if (!match) continue
    const port = Number(match[1])
    if (!DEV_PORTS.has(port)) continue
    const procMatch = /users:\(\("([^"]+)"/.exec(line)
    results.push({ port, process: procMatch?.[1] })
  }
  return results
}

export async function probePorts(root: string): Promise<ProbeResult> {
  const signals: ProbeResult['signals'] = []
  const modeHints: ProbeResult['modeHints'] = {}

  const ss = await runCommand('ss', ['-tlnp'], root, 3000)
  if (!ss.ok) {
    return { probe: 'ports', signals, modeHints, errors: ['ss unavailable'] }
  }

  const listeners = parseSsOutput(ss.stdout)
  for (const { port, process } of listeners) {
    signals.push({
      source: 'ports',
      kind: 'runtime',
      label: `port:${port}`,
      value: process ? `listening (${process})` : 'listening',
    })
    modeHints.build = [...(modeHints.build ?? []), `dev port ${port} active`]
  }

  return { probe: 'ports', signals, modeHints }
}