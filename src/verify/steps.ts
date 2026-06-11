import type { VerificationStep } from './types.js'

export const nodeTestStep: VerificationStep = {
  id: 'node:test',
  label: 'npm test',
  category: 'node',
  command: 'npm',
  args: ['test'],
  timeoutMs: 120_000,
}

export const nodeLintStep: VerificationStep = {
  id: 'node:lint',
  label: 'npm run lint',
  category: 'node',
  command: 'npm',
  args: ['run', 'lint'],
  timeoutMs: 60_000,
}

export const nodeTscStep: VerificationStep = {
  id: 'node:tsc',
  label: 'tsc --noEmit',
  category: 'node',
  command: 'npx',
  args: ['tsc', '--noEmit'],
  timeoutMs: 60_000,
}

export const pythonPytestStep: VerificationStep = {
  id: 'python:pytest',
  label: 'pytest',
  category: 'python',
  command: 'pytest',
  args: [],
  timeoutMs: 120_000,
}

export const rustTestStep: VerificationStep = {
  id: 'rust:test',
  label: 'cargo test',
  category: 'rust',
  command: 'cargo',
  args: ['test'],
  timeoutMs: 180_000,
}

export const rustCheckStep: VerificationStep = {
  id: 'rust:check',
  label: 'cargo check',
  category: 'rust',
  command: 'cargo',
  args: ['check'],
  timeoutMs: 120_000,
}

export const dockerComposePsStep: VerificationStep = {
  id: 'docker:compose-ps',
  label: 'docker compose ps',
  category: 'docker',
  command: 'docker',
  args: ['compose', 'ps'],
  timeoutMs: 10_000,
}

export const terraformValidateStep: VerificationStep = {
  id: 'terraform:validate',
  label: 'terraform validate',
  category: 'terraform',
  command: 'terraform',
  args: ['validate'],
  timeoutMs: 30_000,
}

export const gitStatusStep: VerificationStep = {
  id: 'generic:git-status',
  label: 'git status',
  category: 'generic',
  command: 'git',
  args: ['status', '--porcelain'],
  timeoutMs: 5_000,
}