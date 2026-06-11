import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import YAML from 'yaml'
import { runDoctor } from '../core/doctor.js'
import { healProfileDrift, pickInstalledBackend } from '../core/heal/profile.js'
import { healWorkspace } from '../core/heal/workspace.js'
import {
  healOpenCodeAutoupdate,
  npmPrefixFromBin,
  resolvePrimaryNpmPrefix,
} from '../core/heal/opencode.js'
import {
  classifyOpenCodeAuth,
  parseOpenCodeModelLines,
} from '../core/heal/opencode-auth.js'

describe('opencode auth detection', () => {
  it('parses built-in model lines', () => {
    const models = parseOpenCodeModelLines(
      'opencode/big-pickle\nopencode/deepseek-v4-flash-free\nanthropic/claude\n',
    )
    assert.deepEqual(models, ['opencode/big-pickle', 'opencode/deepseek-v4-flash-free'])
  })

  it('treats built-in free models as authenticated', () => {
    const auth = classifyOpenCodeAuth([], ['opencode/big-pickle', 'opencode/mimo-v2.5-free'])
    assert.equal(auth.authenticated, true)
    assert.ok(auth.detail?.includes('free models'))
  })

  it('prefers provider credentials when present', () => {
    const auth = classifyOpenCodeAuth(['anthropic'], ['opencode/big-pickle'])
    assert.equal(auth.authenticated, true)
    assert.ok(auth.detail?.includes('1 provider'))
    assert.ok(auth.detail?.includes('free models'))
  })
})

describe('heal helpers', () => {
  it('derives npm prefix from binary path', () => {
    assert.equal(
      npmPrefixFromBin('/home/user/.npm-global/bin/opencode'),
      '/home/user/.npm-global',
    )
  })

  it('prefers ~/.npm-global when multiple paths exist', () => {
    const prefix = resolvePrimaryNpmPrefix([
      '/home/user/.nvm/versions/node/v20/bin/opencode',
      '/home/user/.npm-global/bin/opencode',
    ])
    assert.equal(prefix, '/home/user/.npm-global')
  })

  it('picks OSS-first installed backend', () => {
    assert.equal(pickInstalledBackend('grok', ['grok', 'opencode']), 'grok')
    assert.equal(pickInstalledBackend('claude', ['opencode', 'grok']), 'opencode')
  })
})

describe('heal opencode config', () => {
  it('disables autoupdate in project opencode.json', async () => {
    const root = await mkdtemp(join(tmpdir(), 'om-heal-'))
    try {
      await writeFile(
        join(root, 'opencode.json'),
        JSON.stringify({ autoupdate: true, model: 'test/model' }, null, 2) + '\n',
        'utf8',
      )
      const healed = await healOpenCodeAutoupdate(root)
      assert.ok(healed.some((h) => h.includes(join(root, 'opencode.json'))))
      const raw = JSON.parse(await readFile(join(root, 'opencode.json'), 'utf8')) as {
        autoupdate: boolean
      }
      assert.equal(raw.autoupdate, false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('heal workspace', () => {
  it('creates missing .openmangos files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'om-ws-'))
    try {
      const healed = await healWorkspace(root)
      assert.ok(healed.some((h) => h.includes('profile.yaml')))
      assert.ok(healed.some((h) => h.includes('config.yaml')))
      assert.ok(await readFile(join(root, '.openmangos', 'profile.yaml'), 'utf8'))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('heal profile drift', () => {
  it('repairs preferred backend not on PATH', async () => {
    const root = await mkdtemp(join(tmpdir(), 'om-profile-'))
    try {
      await mkdir(join(root, '.openmangos'), { recursive: true })
      await writeFile(
        join(root, '.openmangos', 'profile.yaml'),
        YAML.stringify({ backends: { preferred: 'claude' } }),
        'utf8',
      )
      const healed = await healProfileDrift(root)
      if (healed.length) {
        const profile = YAML.parse(
          await readFile(join(root, '.openmangos', 'profile.yaml'), 'utf8'),
        ) as { backends?: { preferred?: string } }
        assert.notEqual(profile.backends?.preferred, 'claude')
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('doctor', () => {
  it('flags autoupdate when enabled in project config', async () => {
    const root = await mkdtemp(join(tmpdir(), 'om-doctor-'))
    try {
      await writeFile(
        join(root, 'opencode.json'),
        JSON.stringify({ autoupdate: true }, null, 2) + '\n',
        'utf8',
      )
      const report = await runDoctor(root)
      assert.ok(report.issues.some((issue) => issue.id === 'opencode-autoupdate'))
      assert.ok(report.lines.some((line) => line.includes('autoupdate')))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})