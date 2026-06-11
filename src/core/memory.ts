import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROFILE_DIR } from './profile.js'
import type { MemorySnapshot, SituationGraph } from '../types.js'

const MEMORY_DIR = 'memory'
const SNAPSHOTS_FILE = 'snapshots.jsonl'

function snapshotsPath(root: string): string {
  return join(root, PROFILE_DIR, MEMORY_DIR, SNAPSHOTS_FILE)
}

function snapshotId(): string {
  return `mem-${Date.now().toString(36)}`
}

export function situationSummary(situation: SituationGraph): string {
  const parts = [
    `mode=${situation.mode}`,
    `stack=${situation.stack.join('+') || 'unknown'}`,
    situation.infra.length ? `infra=${situation.infra.slice(0, 3).join(',')}` : null,
    situation.workflow.branch ? `branch=${situation.workflow.branch}` : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

export async function rememberSituation(root: string, situation: SituationGraph): Promise<MemorySnapshot> {
  const dir = join(root, PROFILE_DIR, MEMORY_DIR)
  await mkdir(dir, { recursive: true })

  const snapshot: MemorySnapshot = {
    id: snapshotId(),
    recordedAt: new Date().toISOString(),
    workspace: situation.workspace,
    mode: situation.mode,
    stack: situation.stack,
    summary: situationSummary(situation),
    situationPath: join(root, PROFILE_DIR, 'context-pack.json'),
  }

  await appendFile(snapshotsPath(root), `${JSON.stringify(snapshot)}\n`, 'utf8')
  return snapshot
}

export async function recallLocal(root: string, limit = 10): Promise<MemorySnapshot[]> {
  try {
    const text = await readFile(snapshotsPath(root), 'utf8')
    return text
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as MemorySnapshot)
      .slice(-limit)
      .reverse()
  } catch {
    return []
  }
}