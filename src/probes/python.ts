import type { ProbeResult } from '../types.js'
import { firstExisting, readText } from './util.js'

export async function probePython(root: string): Promise<ProbeResult> {
  const signals: ProbeResult['signals'] = []
  const modeHints: ProbeResult['modeHints'] = {}

  const marker = await firstExisting(root, [
    'pyproject.toml',
    'requirements.txt',
    'setup.py',
    'Pipfile',
  ])
  if (!marker) return { probe: 'python', signals, modeHints }

  signals.push({ source: 'python', kind: 'stack', label: 'runtime', value: 'python' })
  signals.push({ source: 'python', kind: 'stack', label: 'manifest', value: marker })

  if (marker === 'pyproject.toml') {
    const text = await readText(`${root}/pyproject.toml`)
    if (text) {
      if (text.includes('pytest')) {
        signals.push({ source: 'python', kind: 'stack', label: 'test_runner', value: 'pytest' })
        modeHints.debug = ['pytest detected']
      }
      if (text.includes('django')) {
        signals.push({ source: 'python', kind: 'stack', label: 'framework', value: 'django' })
      }
      if (text.includes('fastapi')) {
        signals.push({ source: 'python', kind: 'stack', label: 'framework', value: 'fastapi' })
      }
    }
  }

  if (await firstExisting(root, ['.venv', 'venv'])) {
    signals.push({ source: 'python', kind: 'stack', label: 'venv', value: 'present' })
  }

  return { probe: 'python', signals, modeHints }
}