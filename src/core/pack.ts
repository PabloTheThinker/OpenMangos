import type { Mode, SituationGraph } from '../types.js'

const MODE_AFFORDANCES: Record<Mode, string[]> = {
  build: ['full write access', 'run dev/test scripts', 'format on change'],
  debug: ['log tailing', 'repro commands', 'health checks', 'read-mostly on prod configs'],
  infra: ['plan/diff first', 'deploy commands', 'service health checks', 'confirm destructive ops'],
  review: ['diff-centric workflow', 'no writes without approval', 'pre-commit focus'],
  ship: ['changelog + version bump', 'deploy pipeline', 'require verification pass'],
}

const MODE_GUARDRAILS: Record<Mode, string[]> = {
  build: ['standard sandbox'],
  debug: ['avoid prod writes unless explicit'],
  infra: ['block destructive ops without confirmation'],
  review: ['writes blocked by default'],
  ship: ['verification must pass before deploy'],
}

export function situationToJson(situation: SituationGraph): string {
  return JSON.stringify(situation, null, 2)
}

export function situationToMarkdown(situation: SituationGraph): string {
  const lines: string[] = [
    '# OpenMangos Context Pack',
    '',
    `Generated: ${situation.generatedAt}`,
    `Workspace: ${situation.workspace}`,
    `Root: ${situation.root}`,
    '',
    '## Situation',
    '',
    `- **Mode:** ${situation.mode}`,
    `- **Suggested mode:** ${situation.suggestedMode}`,
    `- **Stack:** ${situation.stack.join(', ') || 'unknown'}`,
    `- **Infra:** ${situation.infra.join(', ') || 'none detected'}`,
    '',
    '### Mode reasoning',
    ...situation.modeReasons.map((r) => `- ${r}`),
    '',
    '## Workflow',
    ...Object.entries(situation.workflow).map(([k, v]) => `- **${k}:** ${v}`),
    '',
    '## Runtime',
    ...(
      Object.keys(situation.runtime).length ?
        Object.entries(situation.runtime).map(([k, v]) => `- **${k}:** ${v}`)
      : ['- none detected']
    ),
    '',
    '## Health',
    ...(
      Object.keys(situation.health).length ?
        Object.entries(situation.health).map(
          ([k, v]) => `- **${k}:** ${v.status} — ${v.detail}`,
        )
      : ['- no health signals']
    ),
    '',
    `## Active mode affordances (${situation.mode})`,
    ...MODE_AFFORDANCES[situation.mode].map((a) => `- ${a}`),
    '',
    '## Guardrails',
    ...MODE_GUARDRAILS[situation.mode].map((g) => `- ${g}`),
    '',
    '## Constraints',
    ...(situation.constraints.length ? situation.constraints.map((c) => `- ${c}`) : ['- none']),
    '',
    '## Backends',
    `- Preferred: ${situation.backends.preferred}`,
    `- Available: ${situation.backends.available.join(', ') || 'none detected on PATH'}`,
    '',
    '## Instructions for AI',
    '',
    'You are operating inside an OpenMangos-adapted session. Use the situation above to choose tools,',
    'verification steps, and scope. Prefer stack-appropriate commands. Explain destructive actions.',
    'When finished, suggest verification commands for this stack and mode.',
    '',
  ]
  return lines.join('\n')
}