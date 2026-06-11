import type { BackendId, LearningEvent, MangoSkillMeta, Mode, SituationGraph } from '../types.js'
import type { VerificationResult } from '../verify/types.js'
import { listLearningEvents } from './events.js'
import {
  buildSkillBody,
  getSkill,
  writeSkillDocument,
  type ParsedSkill,
} from './skills.js'

export type SkillKind = 'operator' | 'recovery' | 'infra' | 'verification' | 'specialized' | 'fork'

export interface DerivedSkillProposal {
  slug: string
  description: string
  kind: SkillKind
  parentSlug: string
  situation: SituationGraph
  backend: BackendId
  learnedFrom: string
  bodySuffix?: string
  modeOverride?: Mode
}

function slugifyToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function infraToken(infra: string): string {
  if (infra.includes('compose') || infra.includes('docker')) return 'docker'
  if (infra.includes('terraform')) return 'terraform'
  if (infra.includes('kubernetes') || infra.includes('k8s')) return 'k8s'
  if (infra.includes('vercel')) return 'vercel'
  if (infra.includes('fly')) return 'fly'
  return slugifyToken(infra)
}

function noteSlug(note: string): string {
  const words = note
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 4)
  return slugifyToken(words.join('-')) || 'note'
}

function withMode(situation: SituationGraph, mode: Mode): SituationGraph {
  return { ...situation, mode, suggestedMode: mode }
}

function extractLearnedLines(body: string, limit = 8): string[] {
  const section = body.split('## Learned From')[1]
  if (!section) return []
  return section
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .slice(-limit)
}

export function proposeDerivedSkills(input: {
  situation: SituationGraph
  backend: BackendId
  parentSlug: string
  parentSkill?: ParsedSkill | null
  verification?: VerificationResult
  outcome: LearningEvent['outcome']
  note?: string
}): DerivedSkillProposal[] {
  const proposals: DerivedSkillProposal[] = []
  const parent = input.parentSkill
  const parentTags = new Set(parent?.meta.openmangos.tags ?? [])
  const successCount = parent?.meta.openmangos.success_count ?? 0

  for (const infra of input.situation.infra) {
    const token = infraToken(infra)
    if (parentTags.has(token)) continue
    proposals.push({
      slug: `${input.parentSlug}-infra-${token}`,
      kind: 'infra',
      parentSlug: input.parentSlug,
      situation: input.situation,
      backend: input.backend,
      description: `Infra specialization (${infra}) derived from ${input.parentSlug}`,
      learnedFrom: `derived from ${input.parentSlug} · infra ${infra}`,
      bodySuffix: [
        '',
        '## Infra Focus',
        '',
        `Auto-derived: **${infra}** was sensed but not yet in the parent skill.`,
        '',
        '1. `om sense` — confirm infra probes',
        '2. Switch to infra/debug mode when health is warn/fail',
        `3. Inspect: ${infra}`,
      ].join('\n'),
    })
  }

  if (input.outcome === 'failure') {
    const failedSteps =
      input.verification?.steps.filter((s) => !s.ok && !s.skipped).map((s) => s.step.label) ?? []
    proposals.push({
      slug: `${input.parentSlug}-recovery`,
      kind: 'recovery',
      parentSlug: input.parentSlug,
      situation: input.situation,
      backend: input.backend,
      description: `Recovery after failed session on ${input.parentSlug}`,
      learnedFrom: `derived from failure · parent ${input.parentSlug}`,
      bodySuffix: [
        '',
        '## Pitfalls',
        '',
        ...(failedSteps.length ?
          failedSteps.map((s) => `- Failed: ${s}`)
        : ['- Non-zero exit — run `om doctor --fix` before retry']),
        '',
        '## Recovery',
        '',
        '1. `om sense`',
        '2. `om heal`',
        '3. `om verify`',
      ].join('\n'),
    })
  }

  if (input.verification?.ok && input.verification.steps.length) {
    const passed = input.verification.steps.filter((s) => s.ok).map((s) => s.step.label)
    if (passed.length) {
      proposals.push({
        slug: `${input.parentSlug}-verified`,
        kind: 'verification',
        parentSlug: input.parentSlug,
        situation: input.situation,
        backend: input.backend,
        description: `Verified workflow derived from ${input.parentSlug}`,
        learnedFrom: `derived after verify pass · parent ${input.parentSlug}`,
        bodySuffix: [
          '',
          '## Verified Steps',
          '',
          ...passed.map((p) => `- ${p}`),
        ].join('\n'),
      })
    }
  }

  if (
    input.situation.suggestedMode !== input.situation.mode &&
    input.situation.suggestedModeReasons.length
  ) {
    proposals.push({
      slug: `${input.parentSlug}-mode-${input.situation.suggestedMode}`,
      kind: 'specialized',
      parentSlug: input.parentSlug,
      situation: withMode(input.situation, input.situation.suggestedMode),
      backend: input.backend,
      modeOverride: input.situation.suggestedMode,
      description: `Mode ${input.situation.suggestedMode} specialization from ${input.parentSlug}`,
      learnedFrom: `derived from mode drift · ${input.situation.suggestedModeReasons.join('; ')}`,
      bodySuffix: [
        '',
        '## Mode Drift',
        '',
        `Probes suggested **${input.situation.suggestedMode}** while running **${input.situation.mode}**.`,
        ...input.situation.suggestedModeReasons.map((r) => `- ${r}`),
      ].join('\n'),
    })
  }

  if (input.note && input.note.split(/\s+/).length >= 3) {
    proposals.push({
      slug: `${input.parentSlug}-${noteSlug(input.note)}`,
      kind: 'fork',
      parentSlug: input.parentSlug,
      situation: input.situation,
      backend: input.backend,
      description: `Fork: ${input.note.slice(0, 120)}`,
      learnedFrom: `derived from nudge · ${input.note}`,
      bodySuffix: ['', '## Operator Note', '', input.note].join('\n'),
    })
  }

  if (successCount >= 3 && parent) {
    const learned = extractLearnedLines(parent.body)
    if (learned.length >= 2) {
      proposals.push({
        slug: `${input.parentSlug}-playbook`,
        kind: 'specialized',
        parentSlug: input.parentSlug,
        situation: input.situation,
        backend: input.backend,
        description: `Playbook distilled from ${successCount} successes on ${input.parentSlug}`,
        learnedFrom: `derived at success_count=${successCount}`,
        bodySuffix: ['', '## Playbook', '', ...learned].join('\n'),
      })
    }
  }

  const seen = new Set<string>()
  return proposals.filter((p) => {
    if (p.slug === input.parentSlug || seen.has(p.slug)) return false
    seen.add(p.slug)
    return true
  })
}

function buildDerivedMeta(
  proposal: DerivedSkillProposal,
  verificationCommands: string[],
): MangoSkillMeta {
  const situation =
    proposal.modeOverride ? withMode(proposal.situation, proposal.modeOverride) : proposal.situation
  const now = new Date().toISOString()
  return {
    name: proposal.slug,
    description: proposal.description,
    version: '1.0.0',
    openmangos: {
      tags: [
        ...new Set([
          proposal.kind,
          proposal.parentSlug,
          situation.mode,
          proposal.backend,
          ...situation.stack.map((s) => s.toLowerCase()),
          ...situation.infra.map(infraToken),
        ]),
      ],
      category: proposal.kind,
      mode: situation.mode,
      backend: proposal.backend,
      stack: situation.stack,
      success_count: 0,
      parent_skill: proposal.parentSlug,
      derived_from: proposal.learnedFrom,
      created_at: now,
      updated_at: now,
    },
  }
}

export async function createDerivedSkill(
  root: string,
  proposal: DerivedSkillProposal,
  verificationCommands: string[],
): Promise<{ slug: string; created: boolean }> {
  const existing = await getSkill(root, proposal.slug)
  if (existing) return { slug: proposal.slug, created: false }

  const situation =
    proposal.modeOverride ? withMode(proposal.situation, proposal.modeOverride) : proposal.situation
  const base = buildSkillBody(
    situation,
    proposal.backend,
    verificationCommands,
    proposal.learnedFrom,
  )
  const body = `${base}${proposal.bodySuffix ?? ''}`
  const meta = buildDerivedMeta(proposal, verificationCommands)
  await writeSkillDocument(root, meta, body)
  return { slug: proposal.slug, created: true }
}

export async function developSkillsFromSession(
  root: string,
  input: {
    situation: SituationGraph
    backend: BackendId
    parentSlug: string
    verification?: VerificationResult
    outcome: LearningEvent['outcome']
    note?: string
    verificationCommands: string[]
  },
): Promise<string[]> {
  const parentSkill = await getSkill(root, input.parentSlug)
  const proposals = proposeDerivedSkills({ ...input, parentSkill })
  const created: string[] = []

  for (const proposal of proposals) {
    const result = await createDerivedSkill(root, proposal, input.verificationCommands)
    if (result.created) created.push(result.slug)
  }

  return created
}

export async function developSkillsFromRecentEvents(
  root: string,
  limit = 10,
): Promise<{ derived: string[]; scanned: number }> {
  const events = await listLearningEvents(root, limit)
  const derived: string[] = []
  let scanned = 0

  for (const event of events) {
    if (!event.skillSlug) continue
    scanned += 1
    const parent = await getSkill(root, event.skillSlug)
    if (!parent) continue

    const slugs = await developSkillsFromSession(root, {
      situation: {
        workspace: event.workspace,
        root,
        generatedAt: new Date().toISOString(),
        stack: event.stack,
        infra: parent.meta.openmangos.tags.filter((t) =>
          ['docker', 'terraform', 'k8s', 'vercel', 'fly', 'infra'].includes(t),
        ),
        workflow: {},
        health: {},
        runtime: {},
        signals: [],
        mode: event.mode,
        modeReasons: [],
        suggestedMode: event.mode,
        suggestedModeReasons: [],
        constraints: [],
        backends: { preferred: event.backend, available: [event.backend] },
      },
      backend: event.backend,
      parentSlug: event.skillSlug,
      outcome: event.outcome,
      note: event.note,
      verificationCommands: [],
    })
    derived.push(...slugs)
  }

  return { derived: [...new Set(derived)], scanned }
}