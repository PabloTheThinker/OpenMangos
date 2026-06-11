import { homedir } from 'node:os'
import { join } from 'node:path'
import { resolveAgentDriveBin } from '../../integrations/agentdrive.js'
import { runCommand } from '../../probes/util.js'

export const AGENTDRIVE_INSTALL_URL =
  process.env.AGENTDRIVE_INSTALL_URL ?? 'https://vektraindustries.com/agentdrive/install'

export type AgentDriveInstallResult = {
  actions: string[]
  errors: string[]
}

export async function probeAgentDriveInstalled(): Promise<boolean> {
  return (await resolveAgentDriveBin({})) !== null
}

export async function installAgentDrive(): Promise<AgentDriveInstallResult> {
  const actions: string[] = []
  const errors: string[] = []

  const existing = await resolveAgentDriveBin({})
  if (existing) {
    actions.push(`AgentDrive already installed (${existing})`)
    return { actions, errors }
  }

  const python = await runCommand('python3', ['--version'], process.cwd(), 5000)
  if (!python.ok) {
    errors.push('python3 is required for AgentDrive — install Python 3.10+ first')
    return { actions, errors }
  }
  actions.push(`python3 ${python.stdout.trim()}`)

  const localBin = join(homedir(), '.local', 'bin')
  const installCmd = `export PATH="${localBin}:$PATH" RUN_LAUNCH=false; curl -fsSL "${AGENTDRIVE_INSTALL_URL}" | bash`

  const install = await runCommand('bash', ['-c', installCmd], process.cwd(), 600_000)
  if (!install.ok) {
    const detail = install.stderr || install.stdout || 'unknown error'
    errors.push(`AgentDrive install failed: ${detail}`)
    return { actions, errors }
  }

  actions.push(`installed AgentDrive (${AGENTDRIVE_INSTALL_URL})`)

  const bin = await resolveAgentDriveBin({})
  if (!bin) {
    errors.push(
      'AgentDrive install finished but agentdrive is not on PATH — add ~/.local/bin to PATH',
    )
    return { actions, errors }
  }

  const version = await runCommand(bin, ['--version'], process.cwd(), 15_000)
  if (version.ok && version.stdout) {
    actions.push(`verified ${version.stdout.split('\n')[0]}`)
    return { actions, errors }
  }

  const doctor = await runCommand(bin, ['doctor'], process.cwd(), 60_000)
  if (doctor.ok) {
    actions.push('verified agentdrive doctor')
    return { actions, errors }
  }

  errors.push('agentdrive installed but verification failed — run: agentdrive doctor')
  return { actions, errors }
}