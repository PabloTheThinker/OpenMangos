import { basename, resolve } from 'node:path'
import { runAllProbes } from '../probes/registry.js'
import type { BackendId, HealthEntry, ProbeSignal, SituationGraph } from '../types.js'
import { detectAvailableBackends } from './backends.js'
import { loadProfile } from './profile.js'
import { resolveMode } from './modes.js'

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function collectLabels(signals: ProbeSignal[], kind: ProbeSignal['kind'], label: string): string[] {
  return unique(signals.filter((s) => s.kind === kind && s.label === label).map((s) => s.value))
}

function buildWorkflow(signals: ProbeSignal[]): Record<string, string> {
  const workflow: Record<string, string> = {}
  for (const signal of signals.filter((s) => s.kind === 'workflow')) {
    workflow[signal.label] = signal.value
  }
  return workflow
}

function buildHealth(signals: ProbeSignal[]): Record<string, HealthEntry> {
  const health: Record<string, HealthEntry> = {}
  for (const signal of signals.filter((s) => s.kind === 'health')) {
    let status: HealthEntry['status'] = 'unknown'
    if (signal.value === 'up' || signal.value === 'ok') status = 'ok'
    else if (signal.value === 'unhealthy' || signal.value === 'fail') status = 'fail'
    else if (signal.value === 'warn') status = 'warn'
    health[signal.label] = { status, detail: signal.value }
  }
  return health
}

function buildRuntime(signals: ProbeSignal[]): Record<string, string> {
  const runtime: Record<string, string> = {}
  for (const signal of signals.filter((s) => s.kind === 'runtime')) {
    runtime[signal.label] = signal.value
  }
  return runtime
}

export async function buildSituation(rootInput?: string): Promise<SituationGraph> {
  const root = resolve(rootInput ?? process.cwd())
  const [probeResults, profile, availableBackends] = await Promise.all([
    runAllProbes(root),
    loadProfile(root),
    detectAvailableBackends(),
  ])

  const signals = probeResults.flatMap((r) => r.signals)
  const { mode, suggestedMode, suggestedReasons, activeReasons } = resolveMode(
    probeResults,
    profile.mode,
  )

  const preferred: BackendId =
    profile.backends?.preferred && availableBackends.includes(profile.backends.preferred) ?
      profile.backends.preferred
    : availableBackends[0] ?? 'grok'

  const workflow = buildWorkflow(signals)
  if (profile.intent) workflow.intent = profile.intent

  return {
    workspace: basename(root),
    root,
    generatedAt: new Date().toISOString(),
    stack: unique([
      ...collectLabels(signals, 'stack', 'runtime'),
      ...collectLabels(signals, 'stack', 'language'),
      ...collectLabels(signals, 'stack', 'framework'),
      ...collectLabels(signals, 'stack', 'layout'),
      ...collectLabels(signals, 'stack', 'test_runner'),
    ]),
    infra: unique([
      ...collectLabels(signals, 'infra', 'compose'),
      ...collectLabels(signals, 'infra', 'dockerfile'),
      ...collectLabels(signals, 'infra', 'iac'),
      ...collectLabels(signals, 'infra', 'service').map((s) => `service:${s}`),
    ]),
    workflow,
    health: buildHealth(signals),
    runtime: buildRuntime(signals),
    signals,
    mode,
    modeReasons: activeReasons,
    suggestedMode,
    suggestedModeReasons: suggestedReasons,
    constraints: profile.constraints ?? [],
    backends: {
      preferred,
      available: availableBackends,
    },
  }
}