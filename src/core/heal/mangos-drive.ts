import { homedir } from 'node:os'
import { join } from 'node:path'
import { resolveAgentDriveBin } from '../../integrations/agentdrive.js'
import {
  loadMangosDriveManifest,
  mangosDriveManifestPath,
  provisionMangosDrive,
} from '../../integrations/mangos-drive.js'
import { pathExists } from '../../probes/util.js'
import { loadConfig } from '../config.js'
import { buildSituation } from '../situation.js'

export type MangosDriveIssue = {
  id: string
  message: string
  fixable: boolean
}

export type MangosDriveStatus = {
  enabled: boolean
  autoProvision: boolean
  provisioned: boolean
  manifestPath?: string
  displayName?: string
  driveId?: string
  workspaceSwarm?: string
  personalSwarm?: string
  agentdriveHome?: string
  agentdriveBin: string | null
  swarmDirsOk: boolean
  issues: MangosDriveIssue[]
}

async function swarmDirExists(home: string, swarmId: string): Promise<boolean> {
  return pathExists(join(home, 'swarms', swarmId, 'drive'))
}

export async function inspectMangosDrive(root: string): Promise<MangosDriveStatus> {
  const config = await loadConfig(root)
  const adConfig = config.agentdrive ?? {}
  const enabled = adConfig.enabled !== false
  const autoProvision = adConfig.auto_provision !== false
  const issues: MangosDriveIssue[] = []

  if (!enabled) {
    return {
      enabled: false,
      autoProvision,
      provisioned: false,
      agentdriveBin: null,
      swarmDirsOk: true,
      issues,
    }
  }

  const manifest = await loadMangosDriveManifest(root)
  const bin = await resolveAgentDriveBin(adConfig)
  const manifestPath = mangosDriveManifestPath(root)

  if (!bin) {
    issues.push({
      id: 'agentdrive-missing',
      message: 'agentdrive CLI not found (Mangos Drive recall/remember disabled)',
      fixable: false,
    })
  }

  if (!manifest && autoProvision) {
    issues.push({
      id: 'mangos-drive-missing',
      message: 'Mangos Drive not provisioned (.openmangos/mangos-drive.yaml)',
      fixable: true,
    })
  }

  let swarmDirsOk = true
  if (manifest) {
    const home = manifest.agentdrive_home ?? join(homedir(), '.agentdrive')
    const workspaceOk = await swarmDirExists(home, manifest.swarms.workspace)
    const personalOk = await swarmDirExists(home, manifest.swarms.personal)
    swarmDirsOk = workspaceOk && personalOk
    if (!workspaceOk) {
      issues.push({
        id: 'mangos-swarm-workspace-missing',
        message: `workspace swarm dir missing: ${manifest.swarms.workspace}`,
        fixable: true,
      })
    }
    if (!personalOk) {
      issues.push({
        id: 'mangos-swarm-personal-missing',
        message: `personal swarm dir missing: ${manifest.swarms.personal}`,
        fixable: true,
      })
    }
  }

  return {
    enabled,
    autoProvision,
    provisioned: Boolean(manifest),
    manifestPath: manifest ? manifestPath : undefined,
    displayName: manifest?.display_name ?? adConfig.mangos_display_name,
    driveId: manifest?.drive_id,
    workspaceSwarm: manifest?.swarms.workspace,
    personalSwarm: manifest?.swarms.personal,
    agentdriveHome: manifest?.agentdrive_home,
    agentdriveBin: bin,
    swarmDirsOk,
    issues,
  }
}

export async function detectMangosDriveIssues(root: string): Promise<MangosDriveIssue[]> {
  const status = await inspectMangosDrive(root)
  return status.issues
}

export function mangosDriveStatusLines(status: MangosDriveStatus): string[] {
  const lines: string[] = []
  if (!status.enabled) {
    lines.push('○ Mangos Drive (disabled in config)')
    return lines
  }

  if (!status.provisioned) {
    lines.push('⚠ Mangos Drive not provisioned')
    return lines
  }

  const label = status.displayName ?? 'Mangos Drive'
  const swarmNote = status.swarmDirsOk ? '' : ' · swarm dirs incomplete'
  lines.push(`✓ ${label} (${status.driveId})${swarmNote}`)
  if (status.workspaceSwarm) lines.push(`  workspace swarm: ${status.workspaceSwarm}`)
  if (status.personalSwarm) lines.push(`  personal swarm: ${status.personalSwarm}`)
  if (!status.agentdriveBin) lines.push('  ○ agentdrive CLI not found')
  return lines
}

export async function healMangosDrive(root: string): Promise<string[]> {
  const config = await loadConfig(root)
  const adConfig = config.agentdrive ?? {}
  if (adConfig.enabled === false || adConfig.auto_provision === false) return []

  const before = await inspectMangosDrive(root)
  if (!before.issues.some((issue) => issue.fixable)) return []

  const situation = await buildSituation(root)
  const { manifest, created, notes } = await provisionMangosDrive(root, situation, adConfig)
  const healed: string[] = []

  if (created) {
    healed.push(`provisioned Mangos Drive (${manifest.display_name})`)
  } else if (!before.swarmDirsOk) {
    healed.push(`ensured Mangos Drive swarm dirs (${manifest.drive_id})`)
  }

  for (const note of notes) {
    if (!healed.some((h) => h.includes(note))) healed.push(note)
  }

  return healed
}