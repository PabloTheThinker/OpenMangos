import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMangosDriveManifest,
  resolveMangosSwarmIds,
  slugify,
} from '../integrations/mangos-drive.js'

describe('Mangos Drive', () => {
  it('slugifies workspace names', () => {
    assert.equal(slugify('OpenMangos'), 'openmangos')
    assert.equal(slugify('Vektra Industries/Software'), 'vektra-industries-software')
    assert.equal(slugify('---'), 'workspace')
  })

  it('builds user-scoped drive manifest', () => {
    const manifest = buildMangosDriveManifest('pablothethinker', 'openmangos', 'Mangos Drive')
    assert.equal(manifest.drive_id, 'mangos-pablothethinker')
    assert.equal(manifest.display_name, 'Mangos Drive')
    assert.equal(manifest.swarms.personal, 'mangos-pablothethinker-personal')
    assert.equal(manifest.swarms.workspace, 'mangos-pablothethinker-openmangos')
  })

  it('resolves swarm ids from manifest', () => {
    const manifest = buildMangosDriveManifest('pablo', 'my-app')
    const ids = resolveMangosSwarmIds(manifest, {}, 'my-app')
    assert.equal(ids.workspaceSwarmId, 'mangos-pablo-my-app')
    assert.equal(ids.personalSwarmId, 'mangos-pablo-personal')
    assert.equal(ids.driveId, 'mangos-pablo')
  })

  it('falls back to inferred ids without manifest', () => {
    const ids = resolveMangosSwarmIds(null, {}, 'demo')
    assert.match(ids.workspaceSwarmId, /^mangos-.+-demo$/)
    assert.match(ids.personalSwarmId ?? '', /^mangos-.+-personal$/)
    assert.equal(ids.displayName, 'Mangos Drive')
  })

  it('honors explicit swarm_id override in config', () => {
    const manifest = buildMangosDriveManifest('pablo', 'my-app')
    const ids = resolveMangosSwarmIds(manifest, { swarm_id: 'legacy-swarm' }, 'my-app')
    assert.equal(ids.workspaceSwarmId, 'mangos-pablo-my-app')
  })
})