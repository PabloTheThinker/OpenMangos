import type { Mode, ProbeResult } from '../types.js'

const MODE_ORDER: Mode[] = ['debug', 'infra', 'review', 'ship', 'build']

const MODE_PRIORITY: Record<Mode, number> = {
  debug: 50,
  infra: 40,
  review: 30,
  ship: 20,
  build: 10,
}

export function resolveMode(
  probeResults: ProbeResult[],
  userMode?: Mode,
): { mode: Mode; suggestedMode: Mode; suggestedReasons: string[]; activeReasons: string[] } {
  const scores = new Map<Mode, { score: number; reasons: string[] }>()

  for (const mode of MODE_ORDER) {
    scores.set(mode, { score: 0, reasons: [] })
  }

  for (const result of probeResults) {
    for (const [mode, reasons] of Object.entries(result.modeHints) as Array<[Mode, string[]]>) {
      const entry = scores.get(mode)
      if (!entry || !reasons?.length) continue
      entry.score += MODE_PRIORITY[mode] + reasons.length
      entry.reasons.push(...reasons.map((r) => `${result.probe}: ${r}`))
    }
  }

  for (const result of probeResults) {
    for (const signal of result.signals) {
      if (signal.kind !== 'health') continue
      if (signal.value === 'unhealthy' || signal.value === 'fail') {
        const debug = scores.get('debug')!
        debug.score += 20
        debug.reasons.push(`${signal.source}: ${signal.label} is ${signal.value}`)
      }
    }
  }

  let suggestedMode: Mode = 'build'
  let best = -1
  for (const mode of MODE_ORDER) {
    const entry = scores.get(mode)!
    if (entry.score > best) {
      best = entry.score
      suggestedMode = mode
    }
  }

  const suggestedReasons = scores.get(suggestedMode)?.reasons ?? ['default: no strong signals']
  const activeMode = userMode ?? suggestedMode
  const activeReasons =
    userMode ?
      [`user override: ${userMode}`, ...suggestedReasons.slice(0, 3)]
    : suggestedReasons

  return {
    mode: activeMode,
    suggestedMode,
    suggestedReasons,
    activeReasons,
  }
}

export const MODES: Mode[] = ['build', 'debug', 'infra', 'review', 'ship']

export function isMode(value: string): value is Mode {
  return MODES.includes(value as Mode)
}