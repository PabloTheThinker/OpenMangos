import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readPackageVersion } from '../core/install/detect.js'

describe('om lifecycle', () => {
  it('reads package version from package.json', async () => {
    const root = await mkdtemp(join(tmpdir(), 'om-ver-'))
    try {
      await writeFile(join(root, 'package.json'), JSON.stringify({ version: '1.2.3' }), 'utf8')
      assert.equal(await readPackageVersion(root), '1.2.3')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('defaults missing package version to 0.0.0', async () => {
    const root = await mkdtemp(join(tmpdir(), 'om-ver-missing-'))
    try {
      await mkdir(root, { recursive: true })
      assert.equal(await readPackageVersion(root), '0.0.0')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})