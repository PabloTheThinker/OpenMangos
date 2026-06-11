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

export interface MangosDriveManifest {
  drive_id: string
  display_name: string
  owner: string
  created_at: string
  swarms: {
    personal: string
    workspace: string
  }
  agentdrive_home?: string
}

export interface AgentDriveConfig {
  enabled?: boolean
  bin?: string
  swarm_id?: string
  /** Record situation to Experience Graph on wrap (default: true). */
  auto_remember?: boolean
  /** Merge AgentDrive context-pack into bootstrap context (default: true). */
  auto_recall?: boolean
  /** Provision a user-scoped Mangos Drive namespace in AgentDrive (default: true). */
  auto_provision?: boolean
  /** Display name for the user's Mangos Drive (default: "Mangos Drive"). */
  mangos_display_name?: string
  /** Recall personal swarm context in addition to workspace swarm. */
  recall_personal?: boolean
}

export interface AgentDriveContextSummary {
  swarmId?: string
  fabricCoherence?: number
  lookbackDays?: number
  reasoningStyle?: string
  compactSummary?: string
  recommendations?: string[]
  weakClusters?: Array<{ cycleId: string; whyActionable?: string; coherence?: number }>
  source: string
}

export interface MangoSkillOpenMangosMeta {
  tags: string[]
  category: string
  mode: Mode
  backend: BackendId
  stack: string[]
  success_count: number
  created_at: string
  updated_at: string
}

export interface MangoSkillMeta {
  name: string
  description: string
  version: string
  openmangos: MangoSkillOpenMangosMeta
}

export interface RecalledSkillSummary {
  slug: string
  score: number
  description: string
  mode: Mode
  backend: BackendId
  stack: string[]
  success_count: number
  excerpt?: string
}

export interface LearningEvent {
  id: string
  recordedAt: string
  sessionId?: string
  backend: BackendId
  mode: Mode
  stack: string[]
  workspace: string
  exitCode: number
  signal?: string
  verificationOk?: boolean
  outcome: 'success' | 'failure' | 'nudge'
  skillSlug?: string
  note?: string
}

export interface LearningConfig {
  enabled?: boolean
  /** Extract/update skills after successful sessions (default: true). */
  auto_learn?: boolean
  /** Inject recalled skills into context pack (default: true). */
  auto_recall?: boolean
  /** Hermes-style nudge in AGENTS.md (default: true). */
  nudge_agents?: boolean
  min_success_exit_code?: number
}

export interface ContextPackMemory {
  mangos_drive?: MangosDriveManifest
  agentdrive?: AgentDriveContextSummary
  agentdrive_personal?: AgentDriveContextSummary
  local?: MemorySnapshot[]
  skills?: RecalledSkillSummary[]
}

export interface VektraBridgeConfig {
  enabled?: boolean
  auto_push?: boolean
}

export interface OpenMangosConfig {
  /** Run quick heal before bootstrap launch (default: true). Set false or OPENMANGOS_NO_HEAL=1 to skip. */
  auto_heal?: boolean
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
  learning?: LearningConfig
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