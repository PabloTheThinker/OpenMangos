import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runLearningLoopOnExit } from '../learning/loop.js'
import { listSkills, skillSlugForSituation, upsertSkill } from '../learning/skills.js'
import { recallSkillsForSituation } from '../learning/recall.js'
import { listLearningEvents } from '../learning/events.js'
import type { SituationGraph } from '../types.js'

function fakeSituation(root: string): SituationGraph {
  return {
    workspace: 'learning-test',
    root,
    generatedAt: new Date().toISOString(),
    stack: ['node', 'typescript'],
    infra: ['docker-compose'],
    workflow: {},
    health: {},
    runtime: {},
    signals: [],
    mode: 'build',
    modeReasons: [],
    suggestedMode: 'build',
    suggestedModeReasons: [],
    constraints: [],
    backends: { preferred: 'opencode', available: ['opencode'] },
  }
}

describe('Mangos learning loop', () => {
  let root = ''

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'om-learn-'))
  })

  after(async () => {
    if (root) await rm(root, { recursive: true, force: true })
  })

  it('creates and recalls skills for matching situations', async () => {
    const situation = fakeSituation(root)
    const slug = skillSlugForSituation(situation, 'opencode')
    assert.ok(slug.includes('build'))

    const created = await upsertSkill(root, situation, 'opencode', {
      learnedFrom: 'test session',
      verificationCommands: ['npm test'],
      incrementSuccess: true,
    })
    assert.equal(created.slug, slug)
    assert.equal(created.created, true)

    const skills = await listSkills(root)
    assert.equal(skills.length, 1)

    const recalled = await recallSkillsForSituation(root, situation, 'opencode')
    assert.ok(recalled.length >= 1)
    assert.equal(recalled[0].slug, slug)
  })

  it('records learning events on successful session exit', async () => {
    const situation = fakeSituation(root)
    const result = await runLearningLoopOnExit({
      root,
      sessionId: 'om-test',
      backend: 'opencode',
      situation,
      exitCode: 0,
    })
    assert.equal(result.event.outcome, 'success')
    assert.ok(result.skillSlug)

    const events = await listLearningEvents(root, 5)
    assert.ok(events.length >= 1)
  })
})