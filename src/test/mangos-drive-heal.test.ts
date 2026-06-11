import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import YAML from 'yaml'
import { healMangosDrive, inspectMangosDrive } from '../core/heal/mangos-drive.js'
import { DEFAULT_CONFIG, saveConfig } from '../core/config.js'

describe('Mangos Drive heal', () => {
  it('provisions manifest when missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'om-mangos-heal-'))
    try {
      await mkdir(join(root, '.openmangos'), { recursive: true })
      await saveConfig(root, DEFAULT_CONFIG)

      const before = await inspectMangosDrive(root)
      assert.equal(before.provisioned, false)
      assert.ok(before.issues.some((i) => i.id === 'mangos-drive-missing'))

      const healed = await healMangosDrive(root)
      assert.ok(healed.some((h) => h.includes('Mangos Drive') || h.includes('mangos-drive')))

      const after = await inspectMangosDrive(root)
      assert.equal(after.provisioned, true)
      assert.ok(after.driveId?.startsWith('mangos-'))

      const manifest = YAML.parse(
        await readFile(join(root, '.openmangos', 'mangos-drive.yaml'), 'utf8'),
      ) as { drive_id: string; swarms: { workspace: string; personal: string } }
      assert.equal(manifest.drive_id, after.driveId)
      assert.ok(manifest.swarms.workspace.includes(manifest.drive_id))
      assert.ok(manifest.swarms.personal.endsWith('-personal'))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})