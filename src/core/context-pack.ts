import type { ContextPackMemory, MemorySnapshot, OpenMangosConfig, SituationGraph } from '../types.js'
import { resolveAgentDriveSwarms } from '../integrations/agentdrive-swarm.js'
import { fetchAgentDriveContextPack } from '../integrations/agentdrive.js'
import {
  parseAgentDriveContextPack,
  agentDriveContextToMarkdown,
} from '../integrations/agentdrive-format.js'
import { loadMangosDriveManifest } from '../integrations/mangos-drive.js'
import { gatherLearnedSkills } from '../learning/loop.js'
import { skillsToMarkdown } from '../learning/recall.js'
import { recallLocal } from './memory.js'
import { situationToJson, situationToMarkdown } from './pack.js'

const LOCAL_RECALL_LIMIT = 5

export function localMemoryToMarkdown(snapshots: MemorySnapshot[]): string[] {
  const lines: string[] = ['## Cross-session memory (local)', '']
  for (const snap of snapshots) {
    lines.push(`- **${snap.id}** (${snap.recordedAt}) — ${snap.summary}`)
  }
  lines.push('')
  return lines
}

export function mangosDriveToMarkdown(memory: ContextPackMemory): string[] {
  const manifest = memory.mangos_drive
  if (!manifest) return []
  const lines = [
    `## ${manifest.display_name}`,
    '',
    `- **Drive ID:** ${manifest.drive_id}`,
    `- **Owner:** ${manifest.owner}`,
    `- **Workspace swarm:** ${manifest.swarms.workspace}`,
    `- **Personal swarm:** ${manifest.swarms.personal}`,
    '',
    'OpenMangos routes project memory through this drive. Direct AgentDrive usage shares the same substrate underneath.',
    '',
  ]
  return lines
}

async function fetchSwarmContext(
  config: OpenMangosConfig['agentdrive'],
  swarmId: string,
): Promise<ContextPackMemory['agentdrive'] | undefined> {
  const fetched = await fetchAgentDriveContextPack(config ?? {}, swarmId)
  if (!fetched.ok) return undefined
  const parsed = parseAgentDriveContextPack(fetched.text)
  if (parsed) {
    parsed.swarmId = swarmId
    return parsed
  }
  return { source: fetched.source, swarmId, compactSummary: fetched.text.slice(0, 2000) }
}

export async function gatherContextPackMemory(
  root: string,
  situation: SituationGraph,
  config: OpenMangosConfig = {},
): Promise<ContextPackMemory> {
  const memory: ContextPackMemory = {
    local: await recallLocal(root, LOCAL_RECALL_LIMIT),
  }

  const adConfig = config.agentdrive ?? {}
  if (adConfig.enabled === false || adConfig.auto_recall === false) {
    return memory
  }

  const swarms = await resolveAgentDriveSwarms(root, situation, adConfig)
  memory.mangos_drive = (await loadMangosDriveManifest(root)) ?? undefined

  memory.agentdrive = await fetchSwarmContext(adConfig, swarms.workspaceSwarmId)
  if (adConfig.recall_personal !== false && swarms.personalSwarmId) {
    memory.agentdrive_personal = await fetchSwarmContext(adConfig, swarms.personalSwarmId)
  }

  const recalled = await gatherLearnedSkills(root, situation, situation.backends.preferred)
  if (recalled.length) {
    memory.skills = recalled.map((s) => ({
      slug: s.slug,
      score: s.score,
      description: s.meta.description,
      mode: s.meta.openmangos.mode,
      backend: s.meta.openmangos.backend,
      stack: s.meta.openmangos.stack,
      success_count: s.meta.openmangos.success_count,
      excerpt: s.excerpt,
    }))
  }

  return memory
}

export function buildContextPackMarkdown(
  situation: SituationGraph,
  memory?: ContextPackMemory,
): string {
  const sections = [situationToMarkdown(situation)]
  if (memory?.mangos_drive) sections.push(mangosDriveToMarkdown(memory).join('\n'))
  if (memory?.local?.length) sections.push(localMemoryToMarkdown(memory.local).join('\n'))
  if (memory?.agentdrive) {
    sections.push(
      agentDriveContextToMarkdown(memory.agentdrive, 'Workspace memory (Mangos Drive)').join('\n'),
    )
  }
  if (memory?.agentdrive_personal) {
    sections.push(
      agentDriveContextToMarkdown(
        memory.agentdrive_personal,
        'Personal memory (Mangos Drive)',
      ).join('\n'),
    )
  }
  if (memory?.skills?.length) {
    sections.push(
      skillsToMarkdown(
        memory.skills.map((s) => ({
          slug: s.slug,
          score: s.score,
          meta: {
            name: s.slug,
            description: s.description,
            version: '1.0.0',
            openmangos: {
              tags: [],
              category: 'operator',
              mode: s.mode,
              backend: s.backend,
              stack: s.stack,
              success_count: s.success_count,
              created_at: '',
              updated_at: '',
            },
          },
          excerpt: s.excerpt ?? s.description,
        })),
      ).join('\n'),
    )
  }
  return sections.join('\n')
}

export function buildContextPackJson(
  situation: SituationGraph,
  memory?: ContextPackMemory,
): string {
  const hasMemory =
    memory &&
    (memory.local?.length ||
      memory.agentdrive ||
      memory.agentdrive_personal ||
      memory.mangos_drive ||
      memory.skills?.length)
  if (!hasMemory) return situationToJson(situation)
  return JSON.stringify({ situation, memory }, null, 2)
}

export async function writeContextPackFiles(
  root: string,
  situation: SituationGraph,
  config: OpenMangosConfig = {},
): Promise<{
  packMdPath: string
  packJsonPath: string
  memory: ContextPackMemory
  swarmIds?: { workspace: string; personal?: string }
  provisionNotes: string[]
}> {
  const { mkdir, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const { PROFILE_DIR } = await import('./profile.js')

  const dir = join(root, PROFILE_DIR)
  await mkdir(dir, { recursive: true })

  const swarms = await resolveAgentDriveSwarms(root, situation, config.agentdrive ?? {})
  const memory = await gatherContextPackMemory(root, situation, config)
  const packMdPath = join(dir, 'context-pack.md')
  const packJsonPath = join(dir, 'context-pack.json')

  await writeFile(packMdPath, buildContextPackMarkdown(situation, memory), 'utf8')
  await writeFile(packJsonPath, buildContextPackJson(situation, memory), 'utf8')

  return {
    packMdPath,
    packJsonPath,
    memory,
    swarmIds: { workspace: swarms.workspaceSwarmId, personal: swarms.personalSwarmId },
    provisionNotes: swarms.provisionNotes,
  }
}