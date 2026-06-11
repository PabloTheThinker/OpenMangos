import { join } from 'node:path'
import { firstExisting, readJson } from '../probes/util.js'
import type { Mode, SituationGraph, ToolDefinition } from '../types.js'

interface PackageJson {
  scripts?: Record<string, string>
}

function scriptTool(id: string, label: string, script: string, modes: Mode[]): ToolDefinition {
  return {
    id,
    label,
    command: `npm run ${script}`,
    category: script === 'test' ? 'test' : script === 'lint' ? 'test' : 'dev',
    modes,
    reason: `package.json scripts.${script}`,
  }
}

export async function resolveTools(situation: SituationGraph, root: string): Promise<ToolDefinition[]> {
  const tools: ToolDefinition[] = []
  const stack = new Set(situation.stack)
  const mode = situation.mode

  const paletteAlways: ToolDefinition[] = [
    { id: 'sense', label: 'Situation report', command: 'om sense', category: 'debug', modes: ['build', 'debug', 'infra', 'review', 'ship'], reason: 'OpenMangos core' },
    { id: 'verify', label: 'Run verification', command: 'om verify', category: 'test', modes: ['build', 'debug', 'review', 'ship'], reason: 'OpenMangos core' },
    { id: 'pack', label: 'Export context pack', command: 'om pack --write', category: 'dev', modes: ['build', 'debug', 'infra', 'review', 'ship'], reason: 'OpenMangos core' },
  ]
  tools.push(...paletteAlways)

  if (stack.has('node')) {
    const pkg = await readJson<PackageJson>(join(root, 'package.json'))
    const scripts = pkg?.scripts ?? {}
    if (scripts.dev) tools.push(scriptTool('dev', 'Start dev server', 'dev', ['build', 'debug']))
    if (scripts.test) tools.push(scriptTool('test', 'Run tests', 'test', ['build', 'debug', 'review', 'ship']))
    if (scripts.lint) tools.push(scriptTool('lint', 'Run linter', 'lint', ['build', 'review', 'ship']))
    if (scripts.build) tools.push(scriptTool('build', 'Production build', 'build', ['build', 'ship']))
  }

  if (stack.has('python')) {
    tools.push({ id: 'pytest', label: 'Run pytest', command: 'pytest', category: 'test', modes: ['build', 'debug', 'review'], reason: 'python stack' })
  }

  if (stack.has('rust') || (await firstExisting(root, ['Cargo.toml']))) {
    tools.push(
      { id: 'cargo-test', label: 'Cargo test', command: 'cargo test', category: 'test', modes: ['build', 'debug', 'review'], reason: 'rust stack' },
      { id: 'cargo-check', label: 'Cargo check', command: 'cargo check', category: 'test', modes: ['build', 'debug'], reason: 'rust stack' },
    )
  }

  if (situation.infra.some((i) => i.includes('compose') || i === 'Dockerfile')) {
    tools.push(
      { id: 'compose-ps', label: 'Compose status', command: 'docker compose ps', category: 'infra', modes: ['debug', 'infra'], reason: 'docker compose detected' },
      { id: 'compose-logs', label: 'Compose logs', command: 'docker compose logs --tail=50', category: 'debug', modes: ['debug', 'infra'], reason: 'docker compose detected' },
    )
  }

  if (situation.infra.includes('terraform')) {
    tools.push(
      { id: 'tf-plan', label: 'Terraform plan', command: 'terraform plan', category: 'infra', modes: ['infra', 'ship'], reason: 'terraform detected' },
      { id: 'tf-validate', label: 'Terraform validate', command: 'terraform validate', category: 'infra', modes: ['infra', 'review'], reason: 'terraform detected' },
    )
  }

  if (situation.infra.some((i) => i.includes('k8s') || i.startsWith('service:'))) {
    tools.push({ id: 'kubectl-pods', label: 'K8s pods', command: 'kubectl get pods', category: 'infra', modes: ['infra', 'debug'], reason: 'kubernetes detected' })
  }

  if (situation.infra.some((i) => i.includes('vercel'))) {
    tools.push({ id: 'vercel-deploy', label: 'Vercel deploy', command: 'vercel --prod', category: 'ship', modes: ['ship'], reason: 'vercel detected' })
  }

  if (situation.infra.some((i) => i.includes('fly'))) {
    tools.push({ id: 'fly-status', label: 'Fly status', command: 'fly status', category: 'infra', modes: ['infra', 'debug', 'ship'], reason: 'fly.io detected' })
  }

  tools.push(
    { id: 'git-status', label: 'Git status', command: 'git status', category: 'git', modes: ['build', 'debug', 'review', 'ship'], reason: 'always available in git repos' },
    { id: 'git-diff', label: 'Git diff', command: 'git diff', category: 'git', modes: ['review', 'debug'], reason: 'review mode' },
  )

  return tools.filter((t) => t.modes.includes(mode))
}