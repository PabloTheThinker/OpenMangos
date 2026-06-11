import type { BackendId } from '../../types.js'

/** OSS-first backend preference — shared by bootstrap, heal, and profile repair. */
export const OSS_FIRST: BackendId[] = ['opencode', 'codex', 'grok', 'claude', 'cursor']

export function pickInstalledBackend(
  preferred: BackendId | undefined,
  available: BackendId[],
): BackendId | null {
  if (preferred && available.includes(preferred)) return preferred
  for (const id of OSS_FIRST) {
    if (available.includes(id)) return id
  }
  return available[0] ?? null
}