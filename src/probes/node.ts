import { join } from 'node:path'
import type { ProbeResult } from '../types.js'
import { firstExisting, readJson } from './util.js'

interface PackageJson {
  name?: string
  workspaces?: string[] | { packages?: string[] }
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function collectDeps(pkg: PackageJson): Record<string, string> {
  return { ...pkg.dependencies, ...pkg.devDependencies }
}

export async function probeNode(root: string): Promise<ProbeResult> {
  const signals: ProbeResult['signals'] = []
  const modeHints: ProbeResult['modeHints'] = {}

  const pkgPath = await firstExisting(root, ['package.json'])
  if (!pkgPath) {
    return { probe: 'node', signals, modeHints }
  }

  const pkg = await readJson<PackageJson>(join(root, pkgPath))
  if (!pkg) return { probe: 'node', signals, modeHints, errors: ['package.json unreadable'] }

  signals.push({ source: 'node', kind: 'stack', label: 'runtime', value: 'node' })

  if (pkg.name) {
    signals.push({ source: 'node', kind: 'stack', label: 'package', value: pkg.name })
  }

  const deps = collectDeps(pkg)
  if (deps.typescript || (await firstExisting(root, ['tsconfig.json']))) {
    signals.push({ source: 'node', kind: 'stack', label: 'language', value: 'typescript' })
  } else {
    signals.push({ source: 'node', kind: 'stack', label: 'language', value: 'javascript' })
  }

  if (pkg.workspaces) {
    signals.push({ source: 'node', kind: 'stack', label: 'layout', value: 'monorepo' })
  }

  const frameworks: Array<[string, string]> = [
    ['next', 'next.js'],
    ['react', 'react'],
    ['vite', 'vite'],
    ['express', 'express'],
    ['@nestjs/core', 'nestjs'],
    ['svelte', 'svelte'],
  ]
  for (const [dep, label] of frameworks) {
    if (deps[dep]) signals.push({ source: 'node', kind: 'stack', label: 'framework', value: label })
  }

  const testRunner =
    deps.vitest ? 'vitest'
    : deps.jest ? 'jest'
    : deps.mocha ? 'mocha'
    : deps['@playwright/test'] ? 'playwright'
    : null
  if (testRunner) {
    signals.push({ source: 'node', kind: 'stack', label: 'test_runner', value: testRunner })
  }

  if (pkg.scripts) {
    const scriptNames = Object.keys(pkg.scripts)
    signals.push({
      source: 'node',
      kind: 'stack',
      label: 'scripts',
      value: scriptNames.slice(0, 12).join(', '),
    })
    if (pkg.scripts.dev || pkg.scripts.start) {
      modeHints.build = ['dev/start scripts available']
    }
    if (pkg.scripts.test) {
      modeHints.debug = ['test script available']
    }
    if (pkg.scripts.build && (pkg.scripts.deploy || pkg.scripts.release)) {
      modeHints.ship = ['build + deploy/release scripts detected']
    }
  }

  if (await firstExisting(root, ['tsconfig.json'])) {
    signals.push({ source: 'node', kind: 'stack', label: 'config', value: 'tsconfig.json' })
  }

  return { probe: 'node', signals, modeHints }
}