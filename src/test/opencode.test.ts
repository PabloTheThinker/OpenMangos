import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  modeToOpenCodeAgent,
  openCodeLaunchArgs,
  scaffoldOpenCodeIntegration,
  syncOpenCodeConfig,
} from '../adapters/opencode.js'
import type { SituationGraph } from '../types.js'

function fakeSituation(mode: SituationGraph['mode']): SituationGraph {
  return {
    workspace: 'test',
    root: '/tmp/test',
    generatedAt: new Date().toISOString(),
    stack: ['node'],
    infra: [],
    workflow: {},
    health: {},
    runtime: {},
    signals: [],
    mode,
    modeReasons: [],
    suggestedMode: mode,
    suggestedModeReasons: [],
    constraints: [],
    backends: { preferred: 'opencode', available: ['opencode'] },
  }
}

describe('OpenCode adapter', () => {
  it('maps review/debug to plan agent', () => {
    assert.equal(modeToOpenCodeAgent('review'), 'plan')
    assert.equal(modeToOpenCodeAgent('debug'), 'plan')
    assert.equal(modeToOpenCodeAgent('build'), 'build')
    assert.equal(modeToOpenCodeAgent('infra'), 'build')
  })

  it('TUI launch uses opencode.json only (no run-only -f flag)', () => {
    const args = openCodeLaunchArgs(fakeSituation('debug'), '.openmangos/context-pack.md')
    assert.deepEqual(args, [])
  })

  it('syncs opencode.json with instructions and default_agent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'om-opencode-'))
    try {
      const situation = fakeSituation('review')
      const { configPath, agent } = await syncOpenCodeConfig(
        root,
        situation,
        join(root, '.openmangos/context-pack.md'),
      )
      assert.equal(agent, 'plan')
      const raw = JSON.parse(await readFile(configPath, 'utf8')) as {
        instructions: string[]
        default_agent: string
      }
      assert.ok(raw.instructions.includes('.openmangos/context-pack.md'))
      assert.ok(raw.instructions.includes('AGENTS.md'))
      assert.equal(raw.default_agent, 'plan')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('scaffolds opencode plugin and commands', async () => {
    const root = await mkdtemp(join(tmpdir(), 'om-scaffold-'))
    try {
      const paths = await scaffoldOpenCodeIntegration(root)
      assert.equal(paths.length, 3)
      for (const p of paths) {
        const content = await readFile(p, 'utf8')
        assert.ok(content.length > 10)
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})