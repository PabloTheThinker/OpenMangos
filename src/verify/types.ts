export type VerificationCategory = 'node' | 'python' | 'rust' | 'docker' | 'terraform' | 'generic'

export interface VerificationStep {
  id: string
  label: string
  category: VerificationCategory
  command: string
  args: string[]
  timeoutMs?: number
}

export interface VerificationStepResult {
  step: VerificationStep
  ok: boolean
  stdout: string
  stderr: string
  durationMs: number
  skipped?: boolean
  skipReason?: string
}

export interface VerificationResult {
  root: string
  steps: VerificationStepResult[]
  passed: number
  failed: number
  skipped: number
  ok: boolean
  durationMs: number
}