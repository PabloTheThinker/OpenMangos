export type Mode = 'build' | 'debug' | 'infra' | 'review' | 'ship'

export type BackendId = 'grok' | 'claude' | 'opencode' | 'codex' | 'cursor'

export type MissionRole = 'orchestrator' | 'implementer' | 'validator' | 'research'

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

export interface AgentDriveConfig {
  enabled?: boolean
  bin?: string
  swarm_id?: string
  auto_remember?: boolean
}

export interface VektraBridgeConfig {
  enabled?: boolean
  auto_push?: boolean
}

export interface OpenMangosConfig {
  constraints?: string[]
  backends?: {
    preferred?: BackendId
    routing?: Partial<Record<string, BackendId>>
    roles?: Partial<Record<MissionRole, BackendId>>
  }
  probes?: {
    extra_signals?: ProbeSignal[]
  }
  verify_on_exit?: boolean
  plugins?: string[]
  agentdrive?: AgentDriveConfig
  vektra?: VektraBridgeConfig
  team?: {
    name?: string
    shared_profile?: boolean
  }
}

export interface ToolDefinition {
  id: string
  label: string
  command: string
  category: 'dev' | 'test' | 'infra' | 'git' | 'debug' | 'ship'
  modes: Mode[]
  reason: string
}

export interface SessionEntry {
  id: string
  startedAt: string
  endedAt?: string
  backend: BackendId
  mode: Mode
  workspace: string
  root: string
  event: 'start' | 'handoff' | 'end'
  note?: string
}

export interface RouteResult {
  backend: BackendId
  mode: Mode
  reasons: string[]
  confidence: 'high' | 'medium' | 'low'
}

export interface MissionPhase {
  name: string
  tasks: string[]
}

export interface MissionPlan {
  id: string
  goal: string
  createdAt: string
  mode: Mode
  stack: string[]
  phases: MissionPhase[]
  verification: string[]
}

export interface MemorySnapshot {
  id: string
  recordedAt: string
  workspace: string
  mode: Mode
  stack: string[]
  summary: string
  situationPath?: string
}

export interface BridgeStatus {
  available: boolean
  wsUrl?: string
  editorConnected?: boolean
  message?: string
}