import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BackendId, MangoSkillMeta, Mode, SituationGraph } from '../types.js'
import { indexPath, skillDir, skillFile, skillsRoot } from './paths.js'

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/

export interface ParsedSkill {
  meta: MangoSkillMeta
  body: string
  path: string
}

function slugify(parts: string[]): string {
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function skillSlugForSituation(
  situation: SituationGraph,
  backend: BackendId,
): string {
  const stack = situation.stack.slice(0, 3).map((s) => s.toLowerCase())
  return slugify([situation.mode, ...stack, backend])
}

function parseFrontmatter(text: string): { meta: Record<string, unknown>; body: string } {
  const match = text.match(FRONTMATTER_RE)
  if (!match) return { meta: {}, body: text.trim() }
  const raw = match[1]
  const body = match[2].trim()
  const meta: Record<string, unknown> = {}
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value: unknown = line.slice(idx + 1).trim()
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
    } else if (value === 'true' || value === 'false') {
      value = value === 'true'
    } else if (typeof value === 'string' && /^\d+$/.test(value)) {
      value = Number(value)
    }
    meta[key] = value
  }
  return { meta, body }
}

export function serializeFrontmatter(meta: MangoSkillMeta): string {
  const om = meta.openmangos
  const lines = [
    '---',
    `name: ${meta.name}`,
    `description: ${meta.description}`,
    `version: ${meta.version}`,
    `category: ${om.category}`,
    `mode: ${om.mode}`,
    `backend: ${om.backend}`,
    `stack: [${om.stack.join(', ')}]`,
    `tags: [${om.tags.join(', ')}]`,
    `success_count: ${om.success_count}`,
    ...(om.parent_skill ? [`parent_skill: ${om.parent_skill}`] : []),
    ...(om.derived_from ? [`derived_from: ${om.derived_from}`] : []),
    `created_at: ${om.created_at}`,
    `updated_at: ${om.updated_at}`,
    '---',
    '',
  ]
  return lines.join('\n')
}

export async function writeSkillDocument(
  root: string,
  meta: MangoSkillMeta,
  body: string,
): Promise<void> {
  const slug = meta.name
  await mkdir(skillDir(root, slug), { recursive: true })
  await writeFile(skillFile(root, slug), `${serializeFrontmatter(meta)}${body.trim()}\n`, 'utf8')

  const index = await readSkillIndex(root)
  const without = index.filter((s) => s.name !== slug)
  without.push(meta)
  without.sort((a, b) => b.openmangos.success_count - a.openmangos.success_count)
  await writeSkillIndex(root, without)
}

export function buildSkillBody(
  situation: SituationGraph,
  backend: BackendId,
  verificationCommands: string[],
  learnedFrom: string,
): string {
  const stack = situation.stack.join(', ') || 'unknown'
  const infra = situation.infra.join(', ') || 'none'
  const verify =
    verificationCommands.length ?
      verificationCommands.map((c) => `- \`${c}\``).join('\n')
    : '- Run `om verify` after substantive changes'

  return [
    `# ${situation.mode} · ${stack} · ${backend}`,
    '',
    '## When to Use',
    '',
    `Workspace stack includes **${stack}** in **${situation.mode}** mode with **${backend}** backend.`,
    situation.infra.length ? `Infra signals: ${infra}.` : '',
    '',
    '## Procedure',
    '',
    '1. Run `om sense` to refresh the situation graph',
    `2. Preferred backend: **${backend}**`,
    '3. Let OpenMangos pack Mangos Drive recall before launch',
    '4. Complete work; run verification before ending the session',
    '',
    '## Verification',
    '',
    verify,
    '',
    '## Learned From',
    '',
    `- ${learnedFrom}`,
    '',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

export async function readSkillIndex(root: string): Promise<MangoSkillMeta[]> {
  try {
    const text = await readFile(indexPath(root), 'utf8')
    const parsed = JSON.parse(text) as { skills?: MangoSkillMeta[] }
    return parsed.skills ?? []
  } catch {
    return []
  }
}

async function writeSkillIndex(root: string, skills: MangoSkillMeta[]): Promise<void> {
  await mkdir(join(root, '.openmangos', 'learning'), { recursive: true })
  await writeFile(indexPath(root), JSON.stringify({ skills, updatedAt: new Date().toISOString() }, null, 2), 'utf8')
}

export async function parseSkillFile(path: string): Promise<ParsedSkill | null> {
  try {
    const text = await readFile(path, 'utf8')
    const { meta: raw, body } = parseFrontmatter(text)
    if (!raw.name || !raw.description || !raw.mode || !raw.backend) return null
    const stack = Array.isArray(raw.stack) ? (raw.stack as string[]) : []
    const tags = Array.isArray(raw.tags) ? (raw.tags as string[]) : []
    return {
      meta: {
        name: String(raw.name),
        description: String(raw.description),
        version: String(raw.version ?? '1.0.0'),
        openmangos: {
          tags,
          category: String(raw.category ?? 'operator'),
          mode: raw.mode as MangoSkillMeta['openmangos']['mode'],
          backend: raw.backend as MangoSkillMeta['openmangos']['backend'],
          stack,
          success_count: Number(raw.success_count ?? 0),
          parent_skill: raw.parent_skill ? String(raw.parent_skill) : undefined,
          derived_from: raw.derived_from ? String(raw.derived_from) : undefined,
          created_at: String(raw.created_at ?? ''),
          updated_at: String(raw.updated_at ?? ''),
        },
      },
      body,
      path,
    }
  } catch {
    return null
  }
}

export async function listSkills(root: string): Promise<ParsedSkill[]> {
  const dir = skillsRoot(root)
  let entries: string[] = []
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }

  const skills: ParsedSkill[] = []
  for (const entry of entries) {
    const parsed = await parseSkillFile(skillFile(root, entry))
    if (parsed) skills.push(parsed)
  }
  return skills.sort((a, b) => b.meta.openmangos.success_count - a.meta.openmangos.success_count)
}

export async function getSkill(root: string, slug: string): Promise<ParsedSkill | null> {
  return parseSkillFile(skillFile(root, slug))
}

export async function upsertSkill(
  root: string,
  situation: SituationGraph,
  backend: BackendId,
  options: {
    learnedFrom: string
    verificationCommands: string[]
    incrementSuccess?: boolean
  },
): Promise<{ slug: string; created: boolean; meta: MangoSkillMeta }> {
  const slug = skillSlugForSituation(situation, backend)
  const existing = await getSkill(root, slug)
  const now = new Date().toISOString()
  const tags = [...new Set([situation.mode, backend, ...situation.stack.map((s) => s.toLowerCase())])]

  let meta: MangoSkillMeta
  let body: string

  if (existing) {
    meta = {
      ...existing.meta,
      description: existing.meta.description,
      version: bumpPatch(existing.meta.version),
      openmangos: {
        ...existing.meta.openmangos,
        success_count:
          options.incrementSuccess ?
            existing.meta.openmangos.success_count + 1
          : existing.meta.openmangos.success_count,
        updated_at: now,
      },
    }
    const learnedSection = `## Learned From\n\n- ${options.learnedFrom}`
    body =
      existing.body.includes('## Learned From') ?
        `${existing.body.trim()}\n- ${options.learnedFrom}\n`
      : `${existing.body.trim()}\n\n${learnedSection}\n`
  } else {
    meta = {
      name: slug,
      description: `Operator skill for ${situation.mode} on ${situation.stack.join('+') || 'unknown'} via ${backend}`,
      version: '1.0.0',
      openmangos: {
        tags,
        category: 'operator',
        mode: situation.mode,
        backend,
        stack: situation.stack,
        success_count: options.incrementSuccess ? 1 : 0,
        created_at: now,
        updated_at: now,
      },
    }
    body = buildSkillBody(situation, backend, options.verificationCommands, options.learnedFrom)
  }

  await writeSkillDocument(root, meta, body)
  return { slug, created: !existing, meta }
}

function bumpPatch(version: string): string {
  const parts = version.split('.').map((p) => Number(p))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return '1.0.1'
  parts[2] += 1
  return parts.join('.')
}

export function scoreSkillForSituation(
  skill: MangoSkillMeta,
  situation: SituationGraph,
  backend?: BackendId,
): number {
  let score = 0
  const om = skill.openmangos
  if (om.mode === situation.mode) score += 3
  if (backend && om.backend === backend) score += 2
  for (const stackItem of situation.stack) {
    if (om.stack.includes(stackItem)) score += 2
    if (om.tags.includes(stackItem.toLowerCase())) score += 1
  }
  score += Math.min(om.success_count, 5) * 0.5
  if (om.parent_skill && situation.stack.some((s) => om.tags.includes(s.toLowerCase()))) {
    score += 1
  }
  for (const infra of situation.infra) {
    if (om.tags.includes(infraToken(infra))) score += 2
  }
  return score
}

function infraToken(infra: string): string {
  if (infra.includes('compose') || infra.includes('docker')) return 'docker'
  if (infra.includes('terraform')) return 'terraform'
  if (infra.includes('kubernetes') || infra.includes('k8s')) return 'k8s'
  return infra.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export async function searchSkills(
  root: string,
  situation: SituationGraph,
  options: { backend?: BackendId; limit?: number; minScore?: number } = {},
): Promise<Array<{ skill: ParsedSkill; score: number }>> {
  const skills = await listSkills(root)
  const limit = options.limit ?? 5
  const minScore = options.minScore ?? 2

  return skills
    .map((skill) => ({
      skill,
      score: scoreSkillForSituation(skill.meta, situation, options.backend),
    }))
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}