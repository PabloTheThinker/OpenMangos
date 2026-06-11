import type { Mode } from '../types.js'

export interface ModeDefinition {
  id: Mode
  label: string
  description: string
  affordances: string[]
  guardrails: string[]
  palette: string[]
}

export const MODE_DEFINITIONS: Record<Mode, ModeDefinition> = {
  build: {
    id: 'build',
    label: 'Build',
    description: 'Feature development and iteration',
    affordances: ['full write access', 'run dev/test scripts', 'format on change'],
    guardrails: ['standard sandbox'],
    palette: ['om tools', 'npm run dev', 'om verify --dry-run'],
  },
  debug: {
    id: 'debug',
    label: 'Debug',
    description: 'Investigate failures, logs, and unhealthy services',
    affordances: ['log tailing', 'repro commands', 'health checks', 'read-mostly on prod configs'],
    guardrails: ['avoid prod writes unless explicit'],
    palette: ['om verify', 'docker compose logs', 'pytest -x', 'om sense'],
  },
  infra: {
    id: 'infra',
    label: 'Infra',
    description: 'Infrastructure plan, diff, deploy',
    affordances: ['plan/diff first', 'deploy commands', 'service health checks'],
    guardrails: ['block destructive ops without confirmation'],
    palette: ['terraform plan', 'kubectl get pods', 'docker compose ps', 'fly status'],
  },
  review: {
    id: 'review',
    label: 'Review',
    description: 'Diff-centric pre-commit and PR review',
    affordances: ['diff-centric workflow', 'no writes without approval'],
    guardrails: ['writes blocked by default'],
    palette: ['git diff', 'om verify', 'git status'],
  },
  ship: {
    id: 'ship',
    label: 'Ship',
    description: 'Release, changelog, deploy pipeline',
    affordances: ['changelog + version bump', 'deploy pipeline', 'require verification pass'],
    guardrails: ['verification must pass before deploy'],
    palette: ['om verify', 'npm run build', 'vercel --prod', 'fly deploy'],
  },
}

export function getModeDefinition(mode: Mode): ModeDefinition {
  return MODE_DEFINITIONS[mode]
}