import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveBootstrapBackend } from '../core/bootstrap.js'
import { detectTerminalHost } from '../core/host.js'
import type { SituationGraph } from '../types.js'

function situation(available: SituationGraph['backends']['available'], preferred: SituationGraph['backends']['preferred']): SituationGraph {
  return {
    workspace: 'x',
    root: '/x',
    generatedAt: '',
    stack: [],
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
    backends: { preferred, available },
  }
}

describe('bootstrap', () => {
  it('prefers explicit backend when available', () => {
    const s = situation(['opencode', 'grok'], 'opencode')
    assert.equal(resolveBootstrapBackend(s, 'grok'), 'grok')
  })

  it('falls back OSS chain when preferred missing', () => {
    const s = situation(['codex', 'grok'], 'opencode')
    assert.equal(resolveBootstrapBackend(s), 'codex')
  })

  it('detects warp host env', () => {
    const info = detectTerminalHost({ WARP_IS_LOCAL_SHELL_SESSION: '1' })
    assert.equal(info.host, 'warp')
  })
})