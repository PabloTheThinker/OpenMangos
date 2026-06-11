import type { ContextPackMemory, MemorySnapshot, OpenMangosConfig, SituationGraph } from '../types.js'
import { resolveAgentDriveSwarms } from '../integrations/agentdrive-swarm.js'
import { fetchAgentDriveContextPack } from '../integrations/agentdrive.js'
import {
  parseAgentDriveContextPack,
  agentDriveContextToMarkdown,
} from '../integrations/agentdrive-format.js'
import { loadMangosDriveManifest } from '../integrations/mangos-drive.js'
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
      memory.mangos_drive)
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