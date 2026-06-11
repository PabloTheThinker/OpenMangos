import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { probeAgentDriveInstalled } from '../core/install/agentdrive.js'
import { runInstallChecks } from '../core/install/checks.js'
import { resolveAgentDriveBin } from '../integrations/agentdrive.js'

describe('AgentDrive install integration', () => {
  it('marks agentdrive check as fixable', async () => {
    const checks = await runInstallChecks(process.cwd())
    const ad = checks.find((c) => c.id === 'agentdrive')
    assert.ok(ad)
    assert.equal(ad.fixable, true)
  })

  it('includes python3 prerequisite check', async () => {
    const checks = await runInstallChecks(process.cwd())
    const py = checks.find((c) => c.id === 'python')
    assert.ok(py)
  })

  it('detects agentdrive via AGENTDRIVE_BIN', async () => {
    const prev = process.env.AGENTDRIVE_BIN
    const dir = await mkdtemp(join(tmpdir(), 'om-ad-'))
    const fakeBin = join(dir, 'agentdrive')
    await writeFile(fakeBin, '#!/bin/sh\necho agentdrive 0.0.0\n', { mode: 0o755 })

    process.env.AGENTDRIVE_BIN = fakeBin
    try {
      assert.equal(await resolveAgentDriveBin({}), fakeBin)
      assert.equal(await probeAgentDriveInstalled(), true)
    } finally {
      process.env.AGENTDRIVE_BIN = prev
      await rm(dir, { recursive: true, force: true })
    }
  })

})