import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROFILE_DIR } from './profile.js'
import type { BackendId, Mode, SessionEntry } from '../types.js'

const SESSIONS_DIR = 'sessions'
const LOG_FILE = 'sessions.jsonl'

function sessionsLogPath(root: string): string {
  return join(root, PROFILE_DIR, SESSIONS_DIR, LOG_FILE)
}

function sessionId(): string {
  return `om-${Date.now().toString(36)}`
}

export async function recordSession(
  root: string,
  entry: Omit<SessionEntry, 'id' | 'startedAt'> & { id?: string; startedAt?: string },
): Promise<SessionEntry> {
  const dir = join(root, PROFILE_DIR, SESSIONS_DIR)
  await mkdir(dir, { recursive: true })

  const full: SessionEntry = {
    id: entry.id ?? sessionId(),
    startedAt: entry.startedAt ?? new Date().toISOString(),
    endedAt: entry.endedAt,
    backend: entry.backend,
    mode: entry.mode,
    workspace: entry.workspace,
    root: entry.root,
    event: entry.event,
    note: entry.note,
  }

  await appendFile(sessionsLogPath(root), `${JSON.stringify(full)}\n`, 'utf8')
  return full
}

export async function listSessions(root: string, limit = 20): Promise<SessionEntry[]> {
  try {
    const text = await readFile(sessionsLogPath(root), 'utf8')
    const lines = text.trim().split('\n').filter(Boolean)
    return lines
      .slice(-limit)
      .map((line) => JSON.parse(line) as SessionEntry)
      .reverse()
  } catch {
    return []
  }
}

export async function getSession(root: string, id: string): Promise<SessionEntry | null> {
  const sessions = await listSessions(root, 500)
  return sessions.find((s) => s.id === id) ?? null
}

export async function startSession(
  root: string,
  backend: BackendId,
  mode: Mode,
  workspace: string,
  note?: string,
): Promise<SessionEntry> {
  return recordSession(root, { backend, mode, workspace, root, event: 'start', note })
}

export async function endSession(
  root: string,
  sessionId: string,
  backend: BackendId,
  mode: Mode,
  workspace: string,
  note?: string,
): Promise<SessionEntry> {
  return recordSession(root, {
    id: sessionId,
    backend,
    mode,
    workspace,
    root,
    event: 'end',
    endedAt: new Date().toISOString(),
    note,
  })
}

export async function handoffSession(
  root: string,
  fromBackend: BackendId,
  toBackend: BackendId,
  mode: Mode,
  workspace: string,
): Promise<SessionEntry> {
  return recordSession(root, {
    backend: toBackend,
    mode,
    workspace,
    root,
    event: 'handoff',
    note: `handoff from ${fromBackend}`,
  })
}