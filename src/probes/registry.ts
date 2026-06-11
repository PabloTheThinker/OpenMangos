import type { ProbeResult } from '../types.js'
import { probeDocker } from './docker.js'
import { probeGit } from './git.js'
import { probeNode } from './node.js'
import { probePorts } from './ports.js'
import { probePython } from './python.js'
import { probeTerraform } from './terraform.js'

const PROBES = [probeGit, probeNode, probePython, probeDocker, probeTerraform, probePorts]

export async function runAllProbes(root: string): Promise<ProbeResult[]> {
  const results = await Promise.all(PROBES.map((probe) => probe(root)))
  return results
}