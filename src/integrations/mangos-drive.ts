import { homedir, userInfo } from 'node:os'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import YAML from 'yaml'
import { runCommand } from '../probes/util.js'
import { resolveAgentDriveBin } from './agentdrive.js'
import type { AgentDriveConfig, MangosDriveManifest, SituationGraph } from '../types.js'

const MANIFEST_FILE = 'mangos-drive.yaml'
const DEFAULT_DISPLAY_NAME = 'Mangos Drive'

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace'
}

export function defaultOwnerId(): string {
  return process.env.OPENMANGOS_USER ?? userInfo().username ?? 'user'
}

export function mangosDriveManifestPath(root: string): string {
  return join(root, '.openmangos', MANIFEST_FILE)
}

export function buildMangosDriveManifest(
  ownerId: string,
  workspaceSlug: string,
  displayName = DEFAULT_DISPLAY_NAME,
): MangosDriveManifest {
  const driveId = `mangos-${slugify(ownerId)}`
  return {
    drive_id: driveId,
    display_name: displayName,
    owner: ownerId,
    created_at: new Date().toISOString(),
    swarms: {
      personal: `${driveId}-personal`,
      workspace: `${driveId}-${workspaceSlug}`,
    },
    agentdrive_home: join(homedir(), '.agentdrive'),
  }
}

export async function loadMangosDriveManifest(root: string): Promise<MangosDriveManifest | null> {
  try {
    const text = await readFile(mangosDriveManifestPath(root), 'utf8')
    return (YAML.parse(text) as MangosDriveManifest) ?? null
  } catch {
    return null
  }
}

async function ensureSwarmDir(agentdriveHome: string, swarmId: string): Promise<void> {
  await mkdir(join(agentdriveHome, 'swarms', swarmId, 'drive'), { recursive: true })
}

async function setAgentDriveInstanceName(
  bin: string,
  displayName: string,
  cwd: string,
): Promise<void> {
  await runCommand(bin, ['config', 'set', 'agentdrive.instance_name', displayName], cwd, 5000)
}

export async function provisionMangosDrive(
  root: string,
  situation: Pick<SituationGraph, 'workspace'>,
  config: AgentDriveConfig = {},
): Promise<{ manifest: MangosDriveManifest; created: boolean; notes: string[] }> {
  const notes: string[] = []
  const existing = await loadMangosDriveManifest(root)
  if (existing) {
    await ensureSwarmDirs(existing)
    return { manifest: existing, created: false, notes }
  }

  const ownerId = defaultOwnerId()
  const workspaceSlug = slugify(situation.workspace)
  const manifest = buildMangosDriveManifest(ownerId, workspaceSlug, config.mangos_display_name)
  await mkdir(join(root, '.openmangos'), { recursive: true })
  await writeFile(mangosDriveManifestPath(root), YAML.stringify(manifest), 'utf8')
  notes.push(`created ${MANIFEST_FILE} (${manifest.display_name})`)

  await ensureSwarmDirs(manifest)
  notes.push(`swarms: ${manifest.swarms.workspace}, ${manifest.swarms.personal}`)

  const bin = await resolveAgentDriveBin(config)
  if (bin) {
    await setAgentDriveInstanceName(bin, manifest.display_name, root)
    notes.push(`AgentDrive instance_name → ${manifest.display_name}`)
  }

  return { manifest, created: true, notes }
}

async function ensureSwarmDirs(manifest: MangosDriveManifest): Promise<void> {
  const home = manifest.agentdrive_home ?? join(homedir(), '.agentdrive')
  await ensureSwarmDir(home, manifest.swarms.workspace)
  await ensureSwarmDir(home, manifest.swarms.personal)
}

export function resolveMangosSwarmIds(
  manifest: MangosDriveManifest | null,
  config: AgentDriveConfig,
  workspaceSlug: string,
): { workspaceSwarmId: string; personalSwarmId?: string; driveId?: string; displayName?: string } {
  if (manifest) {
    const workspace =
      config.swarm_id && config.swarm_id.startsWith(manifest.drive_id) ?
        config.swarm_id
      : manifest.swarms.workspace
    return {
      workspaceSwarmId: workspace,
      personalSwarmId: manifest.swarms.personal,
      driveId: manifest.drive_id,
      displayName: manifest.display_name,
    }
  }

  const ownerId = defaultOwnerId()
  const driveId = `mangos-${slugify(ownerId)}`
  return {
    workspaceSwarmId: config.swarm_id ?? `${driveId}-${workspaceSlug}`,
    personalSwarmId: `${driveId}-personal`,
    driveId,
    displayName: config.mangos_display_name ?? DEFAULT_DISPLAY_NAME,
  }
}

