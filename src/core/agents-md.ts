import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadMangosDriveManifest } from '../integrations/mangos-drive.js'
import { PROFILE_DIR } from './profile.js'
import type { SituationGraph } from '../types.js'

export const OPENMANGOS_SECTION_START = '<!-- OPENMANGOS:START -->'
export const OPENMANGOS_SECTION_END = '<!-- OPENMANGOS:END -->'

const AGENTS_MD_FILE = 'AGENTS.md'

function signalValue(situation: SituationGraph, label: string): string | undefined {
  return situation.signals.find((s) => s.label === label)?.value
}

function suggestVerificationCommands(situation: SituationGraph): string[] {
  const commands: string[] = []
  const scripts = signalValue(situation, 'scripts')?.split(',').map((s) => s.trim()) ?? []
  const testRunner = signalValue(situation, 'test_runner')
  const hasNode = situation.stack.includes('node')
  const hasPython = situation.stack.includes('python')
  const hasTerraform = situation.infra.some((i) => i.includes('terraform'))
  const hasCompose = situation.infra.some((i) => i.includes('compose') || i.includes('docker-compose'))

  if (hasNode) {
    if (scripts.includes('test')) commands.push('npm test')
    if (scripts.includes('lint')) commands.push('npm run lint')
    if (scripts.includes('build')) commands.push('npm run build')
    if (scripts.includes('typecheck')) commands.push('npm run typecheck')
    if (situation.stack.includes('typescript') && !commands.some((c) => /tsc|typecheck|build/.test(c))) {
      commands.push('npx tsc --noEmit')
    }
    if (testRunner === 'vitest' && !commands.some((c) => c.includes('vitest'))) {
      commands.push('npx vitest run')
    }
    if (testRunner === 'playwright') commands.push('npx playwright test')
  }

  if (hasPython) {
    commands.push(testRunner === 'pytest' ? 'pytest' : 'python -m pytest')
  }

  if (hasTerraform) {
    commands.push('terraform validate')
    if (situation.mode === 'infra') commands.push('terraform plan')
  }

  if (hasCompose) {
    commands.push('docker compose config')
    if (situation.mode === 'infra' || situation.mode === 'debug') {
      commands.push('docker compose ps')
    }
  }

  if (situation.mode === 'ship' && hasNode && scripts.includes('build') && !commands.includes('npm run build')) {
    commands.unshift('npm run build')
  }

  if (!commands.length) {
    if (hasNode) commands.push('npm test')
    else if (hasPython) commands.push('pytest')
    else if (hasTerraform) commands.push('terraform validate')
  }

  return [...new Set(commands)].slice(0, 6)
}

export function buildAgentsMdSection(
  situation: SituationGraph,
  mangosDrive?: { displayName: string; driveId: string; workspaceSwarm: string; personalSwarm: string },
): string {
  const stack = situation.stack.join(', ') || 'unknown'
  const infra = situation.infra.join(', ') || 'none detected'
  const verification = suggestVerificationCommands(situation)
  const packDir = `${PROFILE_DIR}/context-pack.md`

  const lines: string[] = [
    '## OpenMangos situation',
    '',
    `*Managed by \`om wrap\`. Updated: ${situation.generatedAt}*`,
    '',
    `- **Mode:** ${situation.mode}`,
    `- **Suggested mode:** ${situation.suggestedMode}`,
    `- **Stack:** ${stack}`,
    `- **Infra:** ${infra}`,
    '',
    ...(mangosDrive ?
      [
        '### Mangos Drive',
        '',
        `- **Drive:** ${mangosDrive.displayName} (\`${mangosDrive.driveId}\`)`,
        `- **Workspace swarm:** \`${mangosDrive.workspaceSwarm}\``,
        `- **Personal swarm:** \`${mangosDrive.personalSwarm}\``,
        '',
        'OpenMangos routes memory through this user-scoped drive; AgentDrive is the substrate underneath.',
        '',
      ]
    : []),
    '### Verification commands',
    '',
    ...(
      verification.length ?
        verification.map((cmd) => `- \`${cmd}\``)
      : ['- *(none detected — use stack-appropriate checks)*']
    ),
    '',
    '### OPENMANGOS environment',
    '',
    'Set automatically when launched via `om wrap`:',
    '',
    '| Variable | Purpose |',
    '|---|---|',
    '| `OPENMANGOS_ROOT` | Workspace root |',
    '| `OPENMANGOS_MODE` | Active mode |',
    '| `OPENMANGOS_CONTEXT` | JSON situation pack (`.openmangos/context-pack.json`) |',
    '| `OPENMANGOS_CONTEXT_MD` | Markdown situation pack |',
    '| `OPENMANGOS_PROFILE` | User profile (`.openmangos/profile.yaml`) |',
    '| `OPENMANGOS_WORKSPACE` | Workspace name |',
    '',
    `Full context pack: \`${packDir}\`. Prefer stack-appropriate commands for **${situation.mode}** mode.`,
  ]

  return lines.join('\n')
}

function buildMinimalAgentsMd(section: string): string {
  return [
    '# Agent Instructions',
    '',
    OPENMANGOS_SECTION_START,
    section,
    OPENMANGOS_SECTION_END,
    '',
  ].join('\n')
}

function wrapSection(section: string): string {
  return [OPENMANGOS_SECTION_START, section, OPENMANGOS_SECTION_END].join('\n')
}

export async function syncAgentsMd(
  root: string,
  situation: SituationGraph,
): Promise<{ path: string; created: boolean; updated: boolean }> {
  const path = join(root, AGENTS_MD_FILE)
  const manifest = await loadMangosDriveManifest(root)
  const section = buildAgentsMdSection(
    situation,
    manifest ?
      {
        displayName: manifest.display_name,
        driveId: manifest.drive_id,
        workspaceSwarm: manifest.swarms.workspace,
        personalSwarm: manifest.swarms.personal,
      }
    : undefined,
  )
  const wrapped = wrapSection(section)

  let existing: string
  try {
    existing = await readFile(path, 'utf8')
  } catch {
    await writeFile(path, buildMinimalAgentsMd(section), 'utf8')
    return { path, created: true, updated: true }
  }

  const startIdx = existing.indexOf(OPENMANGOS_SECTION_START)
  const endIdx = existing.indexOf(OPENMANGOS_SECTION_END)

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx)
    const after = existing.slice(endIdx + OPENMANGOS_SECTION_END.length)
    const next = `${before}${wrapped}${after}`
    const updated = next !== existing
    if (updated) await writeFile(path, next, 'utf8')
    return { path, created: false, updated }
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n'
  await writeFile(path, `${existing}${separator}${wrapped}\n`, 'utf8')
  return { path, created: false, updated: true }
}