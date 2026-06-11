import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Mode, SituationGraph } from '../types.js'

export type OpenCodeAgent = 'build' | 'plan'

const OPENCODE_CONFIG = 'opencode.json'

export function modeToOpenCodeAgent(mode: Mode): OpenCodeAgent {
  if (mode === 'review' || mode === 'debug') return 'plan'
  return 'build'
}

/** TUI launch — context via opencode.json instructions + OPENMANGOS_* env (no -f; that's run-only). */
export function openCodeLaunchArgs(_situation: SituationGraph, _packMdRelative: string): string[] {
  return []
}

export async function syncOpenCodeConfig(
  root: string,
  situation: SituationGraph,
  packMdPath: string,
): Promise<{ configPath: string; agent: OpenCodeAgent }> {
  const configPath = join(root, OPENCODE_CONFIG)
  const packRel = '.openmangos/context-pack.md'
  const agent = modeToOpenCodeAgent(situation.mode)

  let existing: Record<string, unknown> = {}
  try {
    existing = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>
  } catch {
    /* new file */
  }

  const instructions = uniqueStrings([
    ...(Array.isArray(existing.instructions) ? (existing.instructions as string[]) : []),
    packRel,
    'AGENTS.md',
  ])

  const merged: Record<string, unknown> = { ...existing }
  delete merged._openmangos
  merged.$schema = existing.$schema ?? 'https://opencode.ai/config.json'
  merged.instructions = instructions
  merged.default_agent = agent
  // npm-installed OpenCode can hang on startup when autoupdate downloads; om handles upgrade hints via doctor.
  merged.autoupdate = false

  await writeFile(configPath, JSON.stringify(merged, null, 2) + '\n', 'utf8')
  return { configPath, agent }
}

export async function scaffoldOpenCodeIntegration(root: string): Promise<string[]> {
  const written: string[] = []
  const pluginDir = join(root, '.opencode', 'plugins')
  const commandsDir = join(root, '.opencode', 'commands')
  await mkdir(pluginDir, { recursive: true })
  await mkdir(commandsDir, { recursive: true })

  const pluginPath = join(pluginDir, 'openmangos.ts')
  await writeFile(pluginPath, OPENMANGOS_PLUGIN_SOURCE, 'utf8')
  written.push(pluginPath)

  const senseCmd = join(commandsDir, 'sense.md')
  await writeFile(
    senseCmd,
    `---
description: Refresh OpenMangos situation probes
agent: plan
---

Run \`om sense\` in the project root and summarize the situation report for the user.
`,
    'utf8',
  )
  written.push(senseCmd)

  const verifyCmd = join(commandsDir, 'verify.md')
  await writeFile(
    verifyCmd,
    `---
description: Run stack-appropriate OpenMangos verification
agent: build
---

Run \`om verify\` in the project root. Report pass/fail per step and suggest fixes for failures.
`,
    'utf8',
  )
  written.push(verifyCmd)

  return written
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

const OPENMANGOS_PLUGIN_SOURCE = `/**
 * OpenMangos ↔ OpenCode bridge plugin (scaffolded by om init).
 * Passes OPENMANGOS_* env through shell tools and compaction context.
 */
export const OpenMangosPlugin = async () => {
  const keys = [
    'OPENMANGOS_ROOT',
    'OPENMANGOS_MODE',
    'OPENMANGOS_CONTEXT',
    'OPENMANGOS_CONTEXT_MD',
    'OPENMANGOS_SESSION',
  ]

  return {
    "shell.env": async (_input, output) => {
      for (const key of keys) {
        const value = process.env[key]
        if (value) output.env[key] = value
      }
    },
    "experimental.session.compacting": async (_input, output) => {
      const mode = process.env.OPENMANGOS_MODE
      const contextMd = process.env.OPENMANGOS_CONTEXT_MD
      if (!mode && !contextMd) return
      output.context.push(\`
## OpenMangos substrate
- mode: \${mode ?? 'unknown'}
- context: \${contextMd ?? 'none'}
\`)
    },
  }
}
`