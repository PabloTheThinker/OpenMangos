import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runOnboardingWizard } from '../core/onboarding/wizard.js'

describe('onboarding wizard', () => {
  it('runs non-interactive with --yes defaults', async () => {
    const prevHome = process.env.HOME
    const home = await mkdtemp(join(tmpdir(), 'om-onboard-'))
    const root = await mkdtemp(join(tmpdir(), 'om-ws-'))
    process.env.HOME = home
    process.env.OPENMANGOS_SKIP_ONBOARD = '1'

    try {
      await mkdir(join(root, '.openmangos'), { recursive: true })

      const result = await runOnboardingWizard({
        directory: root,
        yes: true,
        install: false,
      })

      assert.equal(result.completed, true)
      assert.ok(result.statePath.includes('install.yaml'))
      assert.ok(result.preferredBackend)
    } finally {
      process.env.HOME = prevHome
      delete process.env.OPENMANGOS_SKIP_ONBOARD
      await rm(home, { recursive: true, force: true })
      await rm(root, { recursive: true, force: true })
    }
  })
})