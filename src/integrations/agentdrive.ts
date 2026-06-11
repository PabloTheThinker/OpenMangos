import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { runCommand } from '../probes/util.js'
import type { AgentDriveConfig, SituationGraph } from '../types.js'

const DEFAULT_BIN =
  '/home/pablothethinker/Vektra Industries/Software/AgentDrive/.venv/bin/agentdrive'

export async function resolveAgentDriveBin(config: AgentDriveConfig = {}): Promise<string | null> {
  const candidates = [
    config.bin,
    process.env.AGENTDRIVE_BIN,
    DEFAULT_BIN,
    'agentdrive',
  ].filter(Boolean) as string[]

  for (const bin of candidates) {
    if (bin.includes('/')) {
      try {
        await access(bin)
        return bin
      } catch {
        continue
      }
    }
    const found = await runCommand('which', [bin], process.cwd(), 2000)
    if (found.ok && found.stdout) return found.stdout.split('\n')[0]
  }
  return null
}

export async function fetchAgentDriveContextPack(
  config: AgentDriveConfig = {},
  swarmId?: string,
): Promise<{ ok: boolean; text: string; source: string; swarmId?: string }> {
  if (config.enabled === false) {
    return { ok: false, text: '', source: 'disabled' }
  }

  const bin = await resolveAgentDriveBin(config)
  if (!bin) {
    return { ok: false, text: '', source: 'not_installed' }
  }

  const args = ['experience', 'context-pack', '--json']
  const targetSwarm = swarmId ?? config.swarm_id
  if (targetSwarm) args.push('--swarm-id', targetSwarm)

  const result = await runCommand(bin, args, process.cwd(), 15000)
  if (!result.ok) {
    return { ok: false, text: result.stderr || result.stdout, source: 'error' }
  }

  try {
    const parsed = JSON.parse(result.stdout) as {
      context_pack?: { summary?: string; briefing?: string; narrative?: string; text?: string }
    }
    const pack = parsed.context_pack ?? parsed
    const text =
      (typeof pack === 'object' && pack !== null ?
        (pack as Record<string, string>).summary ??
        (pack as Record<string, string>).briefing ??
        (pack as Record<string, string>).narrative ??
        (pack as Record<string, string>).text
      : null) ?? result.stdout
    return { ok: true, text, source: 'agentdrive', swarmId: targetSwarm }
  } catch {
    return { ok: true, text: result.stdout, source: 'agentdrive_raw', swarmId: targetSwarm }
  }
}

export async function recordToAgentDrive(
  root: string,
  situation: SituationGraph,
  config: AgentDriveConfig = {},
  swarmId?: string,
): Promise<{ ok: boolean; message: string }> {
  if (config.enabled === false) {
    return { ok: false, message: 'AgentDrive disabled in config' }
  }

  const bin = await resolveAgentDriveBin(config)
  if (!bin) {
    return { ok: false, message: 'agentdrive not found on PATH' }
  }

  const summary = `OpenMangos ${situation.workspace}: mode=${situation.mode} stack=${situation.stack.join(',')} @ ${situation.root}`
  const args = ['experience', 'record', '--summary', summary, '--json']
  const targetSwarm = swarmId ?? config.swarm_id
  if (targetSwarm) args.push('--swarm-id', targetSwarm)

  const reasoningFile = join(root, '.openmangos', 'context-pack.json')
  try {
    await access(reasoningFile)
    args.push('--reasoning-file', reasoningFile)
  } catch {
    /* optional */
  }

  const result = await runCommand(bin, args, root, 15000)
  if (!result.ok) {
    return { ok: false, message: result.stderr || result.stdout || 'record failed' }
  }
  return { ok: true, message: 'recorded to AgentDrive Experience Graph' }
}