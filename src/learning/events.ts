import { appendFile, mkdir, readFile } from 'node:fs/promises'
import type { LearningEvent } from '../types.js'
import { eventsPath, learningRoot } from './paths.js'

function eventId(): string {
  return `learn-${Date.now().toString(36)}`
}

export async function appendLearningEvent(
  root: string,
  partial: Omit<LearningEvent, 'id' | 'recordedAt'>,
): Promise<LearningEvent> {
  await mkdir(learningRoot(root), { recursive: true })
  const event: LearningEvent = {
    id: eventId(),
    recordedAt: new Date().toISOString(),
    ...partial,
  }
  await appendFile(eventsPath(root), `${JSON.stringify(event)}\n`, 'utf8')
  return event
}

export async function listLearningEvents(root: string, limit = 20): Promise<LearningEvent[]> {
  try {
    const text = await readFile(eventsPath(root), 'utf8')
    return text
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LearningEvent)
      .slice(-limit)
      .reverse()
  } catch {
    return []
  }
}