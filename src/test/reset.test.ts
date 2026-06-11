import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OPENMANGOS_SECTION_END, OPENMANGOS_SECTION_START } from '../core/agents-md.js'
import { resetOpenMangosData, stripAgentsMdSection } from '../core/reset.js'

describe('om reset', () => {
  it('strips OPENMANGOS section from AGENTS.md', async () => {
    const root = await mkdtemp(join(tmpdir(), 'om-reset-'))
    try {
      await writeFile(
        join(root, 'AGENTS.md'),
        `# Agent Instructions\n\n${OPENMANGOS_SECTION_START}\nold section\n${OPENMANGOS_SECTION_END}\n`,
        'utf8',
      )
      assert.equal(await stripAgentsMdSection(root), true)
      const content = await readFile(join(root, 'AGENTS.md'), 'utf8')
      assert.ok(!content.includes('OPENMANGOS:START'))
      assert.ok(content.includes('# Agent Instructions'))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('removes workspace .openmangos directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'om-reset-ws-'))
    try {
      await mkdir(join(root, '.openmangos'), { recursive: true })
      await writeFile(join(root, '.openmangos', 'profile.yaml'), 'mode: build\n', 'utf8')

      const result = await resetOpenMangosData(root, {
        global: false,
        workspace: true,
        mangosSwarms: false,
        agentsMd: false,
      })

      assert.ok(result.removed.some((p) => p.endsWith('.openmangos')))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})