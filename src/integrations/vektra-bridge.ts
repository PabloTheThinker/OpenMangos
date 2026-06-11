import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import WebSocket from 'ws'
import type { BridgeStatus, SituationGraph } from '../types.js'

interface VektraManifest {
  wsUrl?: string
  port?: number
}

interface WireMessage {
  type: string
  role?: string
  situation?: SituationGraph
  workspace?: string
  mode?: string
  message?: string
  connected?: boolean
}

export async function readVektraManifest(root: string): Promise<VektraManifest | null> {
  try {
    const text = await readFile(join(root, '.vektra-dev.json'), 'utf8')
    return JSON.parse(text) as VektraManifest
  } catch {
    return null
  }
}

export async function probeVektraBridge(root: string): Promise<BridgeStatus> {
  const manifest = await readVektraManifest(root)
  if (!manifest?.wsUrl) {
    return { available: false, message: 'No .vektra-dev.json — start vektra-engine dev server' }
  }
  return { available: true, wsUrl: manifest.wsUrl, message: 'Vektra terminal bridge manifest found' }
}

export async function pushSituationToVektra(root: string, situation: SituationGraph): Promise<BridgeStatus> {
  const manifest = await readVektraManifest(root)
  if (!manifest?.wsUrl) {
    return { available: false, message: 'Vektra bridge not available' }
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (status: BridgeStatus) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        /* ok */
      }
      resolve(status)
    }

    const ws = new WebSocket(manifest.wsUrl!)
    const timer = setTimeout(() => finish({ available: true, wsUrl: manifest.wsUrl, message: 'push timed out' }), 3000)

    ws.on('open', () => {
      const register: WireMessage = { type: 'register', role: 'shell' }
      ws.send(JSON.stringify(register))
      const payload: WireMessage = {
        type: 'om-situation',
        workspace: situation.workspace,
        mode: situation.mode,
        situation,
        message: `OpenMangos situation: ${situation.mode} · ${situation.stack.join(', ')}`,
      }
      ws.send(JSON.stringify(payload))
      finish({
        available: true,
        wsUrl: manifest.wsUrl,
        message: 'situation pushed to Vektra bridge',
      })
    })

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(String(data)) as WireMessage
        if (msg.type === 'editor-status') {
          finish({
            available: true,
            wsUrl: manifest.wsUrl,
            editorConnected: msg.connected,
            message: msg.connected ? 'editor connected' : 'editor offline',
          })
        }
      } catch {
        /* ignore */
      }
    })

    ws.on('error', () => {
      finish({ available: false, wsUrl: manifest.wsUrl, message: 'WebSocket error' })
    })
  })
}