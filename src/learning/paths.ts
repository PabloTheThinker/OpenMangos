import { join } from 'node:path'
import { PROFILE_DIR } from '../core/profile.js'

export const LEARNING_DIR = 'learning'
export const SKILLS_DIR = 'skills'
export const EVENTS_FILE = 'events.jsonl'
export const INDEX_FILE = 'index.json'

export function learningRoot(root: string): string {
  return join(root, PROFILE_DIR, LEARNING_DIR)
}

export function skillsRoot(root: string): string {
  return join(learningRoot(root), SKILLS_DIR)
}

export function skillDir(root: string, slug: string): string {
  return join(skillsRoot(root), slug)
}

export function skillFile(root: string, slug: string): string {
  return join(skillDir(root, slug), 'SKILL.md')
}

export function eventsPath(root: string): string {
  return join(learningRoot(root), EVENTS_FILE)
}

export function indexPath(root: string): string {
  return join(learningRoot(root), INDEX_FILE)
}