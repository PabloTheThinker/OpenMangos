import type { BackendId, Mode, RouteResult, SituationGraph } from '../types.js'
import type { OpenMangosConfig } from '../types.js'

const RESEARCH = /\b(research|explain|investigate|analyze|understand|why|how does)\b/i
const REFACTOR = /\b(refactor|architect|redesign|restructure|migrate|overhaul)\b/i
const REVIEW = /\b(review|audit|pr|pull request|diff|security)\b/i
const OPS = /\b(deploy|infra|terraform|kubernetes|k8s|docker|ecs|cloudwatch|502|504|outage|incident)\b/i
const QUICK = /\b(fix|patch|typo|quick|small|one-liner|rename)\b/i
const TEST = /\b(test|pytest|jest|vitest|coverage|failing)\b/i

export function routeTask(
  task: string,
  situation: SituationGraph,
  config: OpenMangosConfig = {},
): RouteResult {
  const reasons: string[] = []
  const routing = config.backends?.routing ?? {}
  let backend: BackendId = situation.backends.preferred
  let mode: Mode = situation.suggestedMode
  let confidence: RouteResult['confidence'] = 'medium'

  if (OPS.test(task) || situation.suggestedMode === 'infra') {
    backend = routing.ops ?? 'grok'
    mode = 'infra'
    reasons.push('ops/infra keywords or infra mode suggested')
    confidence = 'high'
  } else if (REVIEW.test(task)) {
    backend = routing.review ?? 'claude'
    mode = 'review'
    reasons.push('review/audit keywords')
    confidence = 'high'
  } else if (REFACTOR.test(task)) {
    backend = routing.refactor ?? 'claude'
    mode = 'build'
    reasons.push('refactor/architecture keywords')
    confidence = 'high'
  } else if (RESEARCH.test(task)) {
    backend = routing.research ?? 'grok'
    mode = situation.mode
    reasons.push('research/explain keywords')
    confidence = 'high'
  } else if (TEST.test(task) || situation.suggestedMode === 'debug') {
    backend = situation.backends.preferred
    mode = 'debug'
    reasons.push('test/debug keywords or debug mode suggested')
    confidence = 'medium'
  } else if (QUICK.test(task)) {
    backend = routing.quick ?? 'codex'
    mode = 'build'
    reasons.push('quick fix keywords')
    confidence = 'medium'
  } else {
    reasons.push(`default: preferred backend ${backend}, mode ${mode}`)
    confidence = 'low'
  }

  if (!situation.backends.available.includes(backend)) {
    const fallback = situation.backends.available[0]
    if (fallback) {
      reasons.push(`backend ${backend} not on PATH, fallback → ${fallback}`)
      backend = fallback
    }
  }

  return { backend, mode, reasons, confidence }
}