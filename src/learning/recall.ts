import type { BackendId, MangoSkillMeta, SituationGraph } from '../types.js'
import { searchSkills, type ParsedSkill } from './skills.js'

export interface RecalledSkill {
  slug: string
  score: number
  meta: MangoSkillMeta
  excerpt: string
}

function excerptBody(body: string, maxLines = 12): string {
  const lines = body.split('\n').filter((line) => line.trim())
  return lines.slice(0, maxLines).join('\n')
}

export async function recallSkillsForSituation(
  root: string,
  situation: SituationGraph,
  backend?: BackendId,
  limit = 5,
): Promise<RecalledSkill[]> {
  const matches = await searchSkills(root, situation, { backend, limit })
  return matches.map(({ skill, score }) => ({
    slug: skill.meta.name,
    score,
    meta: skill.meta,
    excerpt: excerptBody(skill.body),
  }))
}

export function skillsToMarkdown(skills: RecalledSkill[]): string[] {
  if (!skills.length) return []
  const lines = [
    '## Procedural memory (Mangos skills)',
    '',
    'Hermes-style skills learned from past successful sessions on this Mangos Drive workspace.',
    'Load full skill with `om skills show <slug>`. Persist new procedures with `om learn nudge` after substantive work.',
    '',
  ]
  for (const skill of skills) {
    lines.push(
      `### ${skill.slug} (score ${skill.score.toFixed(1)}, successes ${skill.meta.openmangos.success_count})`,
      '',
      skill.meta.description,
      '',
      skill.excerpt,
      '',
    )
  }
  return lines
}

export function buildLearningNudge(skills: RecalledSkill[]): string {
  if (!skills.length) {
    return 'After completing non-trivial work (5+ tool steps), consider saving the procedure: `om learn nudge --note "what worked"`'
  }
  const names = skills.map((s) => s.slug).join(', ')
  return `Recalled Mangos skills: ${names}. Reuse these procedures; after successful work run \`om learn nudge\` to persist improvements.`
}

export function recalledSkillsToJson(skills: RecalledSkill[]): string {
  return JSON.stringify(
    skills.map((s) => ({
      slug: s.slug,
      score: s.score,
      description: s.meta.description,
      mode: s.meta.openmangos.mode,
      backend: s.meta.openmangos.backend,
      stack: s.meta.openmangos.stack,
      success_count: s.meta.openmangos.success_count,
    })),
    null,
    2,
  )
}

export type { ParsedSkill }