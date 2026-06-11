export type Mode = 'build' | 'debug' | 'infra' | 'review' | 'ship'

export type BackendId = 'grok' | 'claude' | 'opencode' | 'codex' | 'cursor'

export interface ProbeSignal {
  source: string
  kind: 'stack' | 'infra' | 'workflow' | 'health' | 'runtime'
  label: string
  value: string
  weight?: number
}

export interface ProbeResult {
  probe: string
  signals: ProbeSignal[]
  modeHints: Partial<Record<Mode, string[]>>
  errors?: string[]
}

export interface HealthEntry {
  status: 'ok' | 'warn' | 'fail' | 'unknown'
  detail: string
}

export interface SituationGraph {
  workspace: string
  root: string
  generatedAt: string
  stack: string[]
  infra: string[]
  workflow: Record<string, string>
  health: Record<string, HealthEntry>
  runtime: Record<string, string>
  signals: ProbeSignal[]
  mode: Mode
  modeReasons: string[]
  suggestedMode: Mode
  suggestedModeReasons: string[]
  constraints: string[]
  backends: {
    preferred: BackendId
    available: BackendId[]
  }
}

export interface UserProfile {
  mode?: Mode
  intent?: string
  constraints?: string[]
  backends?: {
    preferred?: BackendId
  }
  notes?: string
}