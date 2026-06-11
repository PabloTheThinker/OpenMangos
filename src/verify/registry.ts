import { join } from 'node:path'
import { firstExisting, readJson } from '../probes/util.js'
import type { SituationGraph } from '../types.js'
import {
  dockerComposePsStep,
  gitStatusStep,
  nodeLintStep,
  nodeTestStep,
  nodeTscStep,
  pythonPytestStep,
  rustCheckStep,
  rustTestStep,
  terraformValidateStep,
} from './steps.js'
import type { VerificationStep } from './types.js'

interface PackageJson {
  scripts?: Record<string, string>
}

function hasComposeInfra(infra: string[]): boolean {
  return infra.some(
    (item) =>
      item === 'docker-compose.yml' ||
      item === 'docker-compose.yaml' ||
      item === 'compose.yml' ||
      item === 'compose.yaml' ||
      item.includes('compose'),
  )
}

function hasTerraformInfra(infra: string[]): boolean {
  return infra.includes('terraform')
}

export async function resolveVerificationSteps(
  situation: SituationGraph,
  root: string,
): Promise<VerificationStep[]> {
  const steps: VerificationStep[] = []
  const stack = new Set(situation.stack)

  if (stack.has('node')) {
    const pkg = await readJson<PackageJson>(join(root, 'package.json'))
    const scripts = pkg?.scripts ?? {}

    if (scripts.test) steps.push(nodeTestStep)
    if (scripts.lint) steps.push(nodeLintStep)
    if (stack.has('typescript')) steps.push(nodeTscStep)
  }

  if (stack.has('python')) {
    steps.push(pythonPytestStep)
  }

  if (await firstExisting(root, ['Cargo.toml'])) {
    steps.push(rustTestStep, rustCheckStep)
  }

  if (hasComposeInfra(situation.infra)) {
    steps.push(dockerComposePsStep)
  }

  if (hasTerraformInfra(situation.infra)) {
    steps.push(terraformValidateStep)
  }

  steps.push(gitStatusStep)

  return steps
}