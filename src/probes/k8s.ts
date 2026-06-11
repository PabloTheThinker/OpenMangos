import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProbeResult } from '../types.js'
import { firstExisting, pathExists, readText } from './util.js'

const K8S_KINDS = ['Pod', 'Deployment', 'Service'] as const

async function scanYamlForKinds(
  dir: string,
  relPrefix: string,
): Promise<Array<{ file: string; kind: string }>> {
  const results: Array<{ file: string; kind: string }> = []
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])

  for (const entry of entries) {
    if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) continue

    const text = await readText(join(dir, entry.name))
    if (!text || !/apiVersion:/i.test(text)) continue

    for (const kind of K8S_KINDS) {
      if (new RegExp(`^kind:\\s*${kind}\\s*$`, 'm').test(text)) {
        results.push({ file: `${relPrefix}/${entry.name}`, kind })
        break
      }
    }
  }

  return results
}

async function findHelmCharts(root: string): Promise<string[]> {
  const charts: string[] = []

  if (await pathExists(join(root, 'Chart.yaml'))) {
    charts.push('Chart.yaml')
  }

  for (const subdir of ['charts', 'helm', 'deploy']) {
    const dir = join(root, subdir)
    if (!(await pathExists(dir))) continue

    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.isDirectory() && (await pathExists(join(dir, entry.name, 'Chart.yaml')))) {
        charts.push(`${subdir}/${entry.name}/Chart.yaml`)
      }
    }
  }

  return charts
}

export async function probeK8s(root: string): Promise<ProbeResult> {
  const signals: ProbeResult['signals'] = []
  const modeHints: ProbeResult['modeHints'] = {}

  const k8sDir = (await pathExists(join(root, 'k8s')))
    ? 'k8s'
    : (await pathExists(join(root, 'kubernetes')))
      ? 'kubernetes'
      : null

  if (k8sDir) {
    signals.push({ source: 'k8s', kind: 'infra', label: 'directory', value: k8sDir })
    modeHints.infra = [`${k8sDir}/ directory detected`]
  }

  const scanDirs: Array<{ path: string; rel: string }> = []
  if (k8sDir) scanDirs.push({ path: join(root, k8sDir), rel: k8sDir })
  scanDirs.push({ path: root, rel: '.' })

  const seen = new Set<string>()
  for (const { path, rel } of scanDirs) {
    const resources = await scanYamlForKinds(path, rel === '.' ? '' : rel)
    for (const { file, kind } of resources) {
      const key = `${file}:${kind}`
      if (seen.has(key)) continue
      seen.add(key)
      signals.push({ source: 'k8s', kind: 'infra', label: 'resource', value: `${kind} (${file})` })
    }
  }

  const helmCharts = await findHelmCharts(root)
  for (const chart of helmCharts.slice(0, 6)) {
    signals.push({ source: 'k8s', kind: 'infra', label: 'helm', value: chart })
    modeHints.infra = [...(modeHints.infra ?? []), `helm chart: ${chart}`]
  }

  if (signals.length > 0 && !modeHints.infra) {
    modeHints.infra = ['kubernetes manifests detected']
  }

  return { probe: 'k8s', signals, modeHints }
}