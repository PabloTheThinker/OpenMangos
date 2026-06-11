import type { ProbeResult } from '../types.js'
import { firstExisting, readText, runCommand } from './util.js'

function parseComposeServices(text: string): string[] {
  const services: string[] = []
  let inServices = false
  for (const line of text.split('\n')) {
    if (/^services:\s*$/.test(line)) {
      inServices = true
      continue
    }
    if (inServices) {
      const match = /^  ([a-zA-Z0-9_.-]+):\s*$/.exec(line)
      if (match) services.push(match[1])
      if (/^[a-zA-Z]/.test(line) && !line.startsWith('  ')) break
    }
  }
  return services
}

export async function probeDocker(root: string): Promise<ProbeResult> {
  const signals: ProbeResult['signals'] = []
  const modeHints: ProbeResult['modeHints'] = { infra: [] }

  const composeFile = await firstExisting(root, [
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
  ])
  if (composeFile) {
    signals.push({ source: 'docker', kind: 'infra', label: 'compose', value: composeFile })
    modeHints.infra!.push(`compose file: ${composeFile}`)

    const text = await readText(`${root}/${composeFile}`)
    if (text) {
      const services = parseComposeServices(text)
      for (const service of services.slice(0, 8)) {
        signals.push({ source: 'docker', kind: 'infra', label: 'service', value: service })
      }
    }
  }

  if (await firstExisting(root, ['Dockerfile'])) {
    signals.push({ source: 'docker', kind: 'infra', label: 'dockerfile', value: 'Dockerfile' })
    modeHints.infra!.push('Dockerfile present')
  }

  const ps = await runCommand('docker', ['ps', '--format', '{{.Names}}\t{{.Status}}'], root, 4000)
  if (ps.ok) {
    const lines = ps.stdout.split('\n').filter(Boolean)
    if (lines.length > 0) {
      signals.push({
        source: 'docker',
        kind: 'runtime',
        label: 'containers_running',
        value: String(lines.length),
      })
      for (const line of lines.slice(0, 6)) {
        const [name, status] = line.split('\t')
        const health = status?.includes('unhealthy') ? 'unhealthy' : status?.includes('Up') ? 'up' : 'unknown'
        signals.push({
          source: 'docker',
          kind: 'health',
          label: `container:${name}`,
          value: health,
          weight: health === 'unhealthy' ? 3 : 1,
        })
        if (health === 'unhealthy') {
          modeHints.debug = [...(modeHints.debug ?? []), `container unhealthy: ${name}`]
        }
      }
    }
  }

  if (modeHints.infra!.length === 0) delete modeHints.infra

  return { probe: 'docker', signals, modeHints }
}