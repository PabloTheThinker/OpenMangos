import { watch } from 'node:fs'
import type { SituationGraph } from '../types.js'

export interface WatchOptions {
  intervalMs: number
  onUpdate: (situation: SituationGraph, changes: string[]) => void | Promise<void>
  build: () => Promise<SituationGraph>
}

function situationFingerprint(s: SituationGraph): string {
  return JSON.stringify({
    mode: s.mode,
    suggestedMode: s.suggestedMode,
    stack: s.stack,
    infra: s.infra,
    health: s.health,
    runtime: s.runtime,
    dirty: s.workflow.dirty_files,
  })
}

function diffSituations(prev: SituationGraph | null, next: SituationGraph): string[] {
  if (!prev) return ['initial sense']
  const changes: string[] = []
  if (prev.mode !== next.mode) changes.push(`mode: ${prev.mode} → ${next.mode}`)
  if (prev.suggestedMode !== next.suggestedMode) {
    changes.push(`suggested: ${prev.suggestedMode} → ${next.suggestedMode}`)
  }
  if (prev.stack.join() !== next.stack.join()) {
    changes.push(`stack: ${prev.stack.join(',')} → ${next.stack.join(',')}`)
  }
  if (JSON.stringify(prev.health) !== JSON.stringify(next.health)) changes.push('health changed')
  if (JSON.stringify(prev.runtime) !== JSON.stringify(next.runtime)) changes.push('runtime changed')
  if (prev.workflow.dirty_files !== next.workflow.dirty_files) {
    changes.push(`dirty files: ${prev.workflow.dirty_files ?? '?'} → ${next.workflow.dirty_files ?? '?'}`)
  }
  return changes
}

export function startWatch(root: string, options: WatchOptions): () => void {
  let prev: SituationGraph | null = null
  let fp = ''
  let running = false

  const tick = async () => {
    if (running) return
    running = true
    try {
      const situation = await options.build()
      const nextFp = situationFingerprint(situation)
      if (nextFp !== fp) {
        const changes = diffSituations(prev, situation)
        fp = nextFp
        prev = situation
        if (changes.length) await options.onUpdate(situation, changes)
      }
    } finally {
      running = false
    }
  }

  const interval = setInterval(() => void tick(), options.intervalMs)
  void tick()

  const watchers: ReturnType<typeof watch>[] = []
  const watchPaths = [
    'package.json',
    'Cargo.toml',
    'pyproject.toml',
    'docker-compose.yml',
    '.github/workflows',
    '.openmangos/profile.yaml',
  ]

  for (const rel of watchPaths) {
    try {
      const w = watch(`${root}/${rel}`, { recursive: rel.includes('/') }, () => void tick())
      watchers.push(w)
    } catch {
      /* path may not exist */
    }
  }

  return () => {
    clearInterval(interval)
    for (const w of watchers) w.close()
  }
}