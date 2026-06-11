import { loadConfig, saveConfig } from '../config.js'
import { loadProfile, saveProfile } from '../profile.js'
import { detectAvailableBackends } from '../backends.js'
import type { BackendId } from '../../types.js'
import { OSS_FIRST, pickInstalledBackend } from './constants.js'

export async function healProfileDrift(root: string): Promise<string[]> {
  const healed: string[] = []
  const available = await detectAvailableBackends()
  if (!available.length) return healed

  const profile = await loadProfile(root)
  const config = await loadConfig(root)
  const resolved = pickInstalledBackend(profile.backends?.preferred, available)

  if (profile.backends?.preferred && resolved && profile.backends.preferred !== resolved) {
    const old = profile.backends.preferred
    profile.backends = { ...profile.backends, preferred: resolved }
    await saveProfile(root, profile)
    healed.push(`profile preferred ${old} → ${resolved} (was not on PATH)`)
  }

  const configPreferred = config.backends?.preferred
  if (configPreferred && !available.includes(configPreferred)) {
    const next = pickInstalledBackend(undefined, available)
    if (next) {
      config.backends = { ...config.backends, preferred: next }
      await saveConfig(root, config)
      healed.push(`config preferred ${configPreferred} → ${next}`)
    }
  }

  return healed
}

export async function detectProfileDrift(root: string): Promise<{
  id: string
  message: string
  preferred: BackendId
  resolved: BackendId
} | null> {
  const available = await detectAvailableBackends()
  if (!available.length) return null

  const profile = await loadProfile(root)
  const preferred = profile.backends?.preferred
  if (!preferred || available.includes(preferred)) return null

  const resolved = pickInstalledBackend(preferred, available)
  if (!resolved || resolved === preferred) return null

  return {
    id: 'profile-drift',
    message: `profile prefers ${preferred} but only [${available.join(', ')}] on PATH`,
    preferred,
    resolved,
  }
}

export { OSS_FIRST, pickInstalledBackend }