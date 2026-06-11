import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { shouldShowBackendPicker, sortAvailableBackends } from '../core/backend-select.js'

describe('backend-select', () => {
  it('sorts installed backends in product order', () => {
    assert.deepEqual(sortAvailableBackends(['grok', 'opencode', 'codex']), [
      'opencode',
      'grok',
      'codex',
    ])
  })

  it('shows picker when multiple backends and no explicit choice', () => {
    assert.equal(
      shouldShowBackendPicker({ available: ['opencode', 'grok'] }),
      false, // no TTY in test
    )
    assert.equal(
      shouldShowBackendPicker({ available: ['opencode', 'grok'], yes: true }),
      false,
    )
    assert.equal(
      shouldShowBackendPicker({ available: ['opencode', 'grok'], explicit: 'grok' }),
      false,
    )
    assert.equal(
      shouldShowBackendPicker({ available: ['opencode'], pick: true }),
      false,
    )
  })
})