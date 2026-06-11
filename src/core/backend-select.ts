import { createInterface } from 'node:readline'
import { stdin as input, stdout as output } from 'node:process'
import pc from 'picocolors'
import { BACKEND_ADAPTERS } from '../adapters/backends/index.js'
import type { BackendId } from '../types.js'

const ORDER: BackendId[] = ['opencode', 'grok', 'claude', 'codex', 'cursor']

export interface PickBackendOptions {
  current?: BackendId
  remember?: (backend: BackendId) => Promise<void>
}

function labelFor(id: BackendId): string {
  const spec = BACKEND_ADAPTERS.find((b) => b.id === id)
  return spec ? `${id} — ${spec.description}` : id
}

export function sortAvailableBackends(available: BackendId[]): BackendId[] {
  return ORDER.filter((id) => available.includes(id))
}

export async function pickBackendInteractive(
  available: BackendId[],
  options: PickBackendOptions = {},
): Promise<BackendId> {
  const sorted = sortAvailableBackends(available)
  if (sorted.length === 0) throw new Error('No agent backends on PATH')
  if (sorted.length === 1) return sorted[0]!

  const currentIdx = options.current ? sorted.indexOf(options.current) : -1
  const defaultIdx = currentIdx >= 0 ? currentIdx + 1 : 1
  const defaultBackend = sorted[defaultIdx - 1] ?? sorted[0]!

  console.error('')
  console.error(pc.bold(pc.yellow('🥭 Pick agent backend')))
  console.error(pc.dim('Installed on PATH:\n'))
  sorted.forEach((id, i) => {
    const mark = i + 1 === defaultIdx ? pc.cyan(' (default)') : ''
    console.error(`  ${pc.bold(String(i + 1))}) ${labelFor(id)}${mark}`)
  })
  console.error(pc.dim('\nEnter number · Enter for default · Ctrl+C to cancel\n'))

  const choice = await promptLine(`Backend [${defaultIdx}]: `)
  const trimmed = choice.trim()
  if (!trimmed) {
    if (options.remember) await options.remember(defaultBackend)
    return defaultBackend
  }

  const num = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(num) || num < 1 || num > sorted.length) {
    console.error(pc.yellow(`Invalid choice — using ${defaultBackend}`))
    if (options.remember) await options.remember(defaultBackend)
    return defaultBackend
  }

  const picked = sorted[num - 1]!
  if (options.remember) await options.remember(picked)
  return picked
}

function promptLine(question: string): Promise<string> {
  if (!input.isTTY) return Promise.resolve('')

  const rl = createInterface({ input, output, terminal: true })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

export function shouldShowBackendPicker(options: {
  explicit?: BackendId
  yes?: boolean
  pick?: boolean
  available: BackendId[]
}): boolean {
  if (options.explicit) return false
  if (options.yes) return false
  if (process.env.OPENMANGOS_BACKEND) return false
  if (options.pick) return options.available.length > 1
  if (!input.isTTY) return false
  return options.available.length > 1
}