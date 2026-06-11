import type { ProbeResult } from '../types.js'
import { probeCi } from './ci.js'
import { probeDocker } from './docker.js'
import { probeFly } from './fly.js'
import { probeGit } from './git.js'
import { probeK8s } from './k8s.js'
import { probeNode } from './node.js'
import { probePorts } from './ports.js'
import { probePython } from './python.js'
import { probeRust } from './rust.js'
import { probeTerraform } from './terraform.js'
import { probeVercel } from './vercel.js'

const PROBES = [
  probeGit,
  probeNode,
  probePython,
  probeRust,
  probeDocker,
  probeTerraform,
  probeK8s,
  probeVercel,
  probeFly,
  probeCi,
  probePorts,
]

export async function runAllProbes(root: string): Promise<ProbeResult[]> {
  const results = await Promise.all(PROBES.map((probe) => probe(root)))
  return results
}