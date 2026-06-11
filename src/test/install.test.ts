import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import YAML from 'yaml'
import { checkGlyph } from '../core/install/checks.js'
import {
  globalOmDir,
  installStatePath,
  loadInstallState,
  needsOnboarding,
  saveInstallState,
} from '../core/install/state.js'

describe('install state', () => {
  it('tracks onboarding completion', async () => {
    const prevHome = process.env.HOME
    const home = await mkdtemp(join(tmpdir(), 'om-install-'))
    process.env.HOME = home
    try {
      assert.equal(needsOnboarding(await loadInstallState()), true)

      await saveInstallState({
        version: 1,
        onboarding_completed_at: new Date().toISOString(),
        user_id: 'test-user',
      })

      const state = await loadInstallState()
      assert.equal(needsOnboarding(state), false)
      assert.equal(state.user_id, 'test-user')

      const raw = YAML.parse(await readFile(installStatePath(), 'utf8')) as {
        onboarding_completed_at?: string
      }
      assert.ok(raw.onboarding_completed_at)
      assert.ok(installStatePath().startsWith(join(globalOmDir())))
    } finally {
      process.env.HOME = prevHome
      await rm(home, { recursive: true, force: true })
    }
  })
})

describe('install checks', () => {
  it('maps status to glyphs', () => {
    assert.equal(checkGlyph('ok'), '✓')
    assert.equal(checkGlyph('warn'), '⚠')
    assert.equal(checkGlyph('fail'), '✗')
    assert.equal(checkGlyph('skip'), '○')
  })
})