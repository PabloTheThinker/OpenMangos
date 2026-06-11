import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  agentDriveContextToMarkdown,
  parseAgentDriveContextPack,
} from '../integrations/agentdrive-format.js'
import {
  buildContextPackMarkdown,
  localMemoryToMarkdown,
  mangosDriveToMarkdown,
} from '../core/context-pack.js'
import type { SituationGraph } from '../types.js'

const SAMPLE_AGENTDRIVE = JSON.stringify({
  success: true,
  context_pack: {
    swarm_id: 'stabilization-wave-20260531',
    fabric_coherence: 0.714,
    lookback_days: 7,
    reasoning_style: 'balanced',
    compact_graph_summary: '10 cycles, 35 cross edges',
    actionable_structural_recommendations: ['Record explicit fabric reasoning trace'],
    top_weak_clusters: [
      { cycle_id: 'meta-query-cycle', why_actionable: 'Low coherence cluster', coherence: 0.5 },
    ],
  },
})

function fakeSituation(): SituationGraph {
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
    mode: 'build',
    modeReasons: [],
    suggestedMode: 'build',
    suggestedModeReasons: [],
    constraints: [],
    backends: { preferred: 'opencode', available: ['opencode'] },
  }
}

describe('AgentDrive context format', () => {
  it('parses context pack JSON', () => {
    const parsed = parseAgentDriveContextPack(SAMPLE_AGENTDRIVE)
    assert.ok(parsed)
    assert.equal(parsed?.swarmId, 'stabilization-wave-20260531')
    assert.equal(parsed?.fabricCoherence, 0.714)
    assert.equal(parsed?.recommendations?.length, 1)
    assert.equal(parsed?.weakClusters?.[0]?.cycleId, 'meta-query-cycle')
  })

  it('renders markdown section', () => {
    const parsed = parseAgentDriveContextPack(SAMPLE_AGENTDRIVE)!
    const md = agentDriveContextToMarkdown(parsed).join('\n')
    assert.ok(md.includes('Cross-session memory (AgentDrive)'))
    assert.ok(md.includes('stabilization-wave-20260531'))
    assert.ok(md.includes('Record explicit fabric reasoning trace'))
  })
})

describe('context pack builder', () => {
  it('merges situation with Mangos Drive workspace memory', () => {
    const situation = fakeSituation()
    const memory = { agentdrive: parseAgentDriveContextPack(SAMPLE_AGENTDRIVE)! }
    const md = buildContextPackMarkdown(situation, memory)
    assert.ok(md.includes('# OpenMangos Context Pack'))
    assert.ok(md.includes('Workspace memory (Mangos Drive)'))
    assert.ok(md.includes('10 cycles, 35 cross edges'))
  })

  it('includes Mangos Drive manifest section', () => {
    const md = mangosDriveToMarkdown({
      mangos_drive: {
        drive_id: 'mangos-pablo',
        display_name: 'Mangos Drive',
        owner: 'pablo',
        created_at: '2026-06-11T00:00:00.000Z',
        swarms: { personal: 'mangos-pablo-personal', workspace: 'mangos-pablo-openmangos' },
      },
    }).join('\n')
    assert.ok(md.includes('## Mangos Drive'))
    assert.ok(md.includes('mangos-pablo-openmangos'))
    assert.ok(md.includes('mangos-pablo-personal'))
  })

  it('includes local snapshots when present', () => {
    const lines = localMemoryToMarkdown([
      {
        id: 'mem-abc',
        recordedAt: '2026-06-11T00:00:00.000Z',
        workspace: 'test',
        mode: 'build',
        stack: ['node'],
        summary: 'mode=build · stack=node',
      },
    ])
    assert.ok(lines.join('\n').includes('mem-abc'))
  })
})