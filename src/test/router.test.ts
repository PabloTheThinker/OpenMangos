import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { routeTask } from '../core/router.js'
import type { SituationGraph } from '../types.js'

const base: SituationGraph = {
  workspace: 'x',
  root: '/x',
  generatedAt: '',
  stack: ['node'],
  infra: [],
  workflow: {},
  health: {},
  runtime: {},
  signals: [],
  mode: 'build',
  modeReasons: [],
  suggestedMode: 'build',
  suggestedModeReasons: [],
  constraints: [],
  backends: { preferred: 'opencode', available: ['opencode', 'grok'] },
}

describe('router', () => {
  it('routes review tasks to review mode', () => {
    const r = routeTask('review this PR', base, {})
    assert.equal(r.mode, 'review')
    assert.equal(r.confidence, 'high')
  })

  it('falls back to opencode when configured backend missing', () => {
    const s: SituationGraph = { ...base, backends: { preferred: 'claude', available: ['opencode'] } }
    const r = routeTask('random task', s, { backends: { routing: { review: 'claude' } } })
    assert.equal(r.backend, 'opencode')
  })
})