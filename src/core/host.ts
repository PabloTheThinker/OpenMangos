export type TerminalHost = 'plain' | 'warp' | 'unknown'

export interface HostInfo {
  host: TerminalHost
  hints: string[]
}

/** Best-effort detection of Warp ADE vs plain terminal. */
export function detectTerminalHost(env: NodeJS.ProcessEnv = process.env): HostInfo {
  const hints: string[] = []

  if (
    env.WARP_IS_LOCAL_SHELL_SESSION === '1' ||
    env.TERM_PROGRAM === 'warp-terminal' ||
    env.WARP_TERMINAL === '1'
  ) {
    hints.push('Warp detected — use OpenCode/Claude/Codex tabs inside Warp')
    return { host: 'warp', hints }
  }

  if (env.TERM_PROGRAM) {
    hints.push(`TERM_PROGRAM=${env.TERM_PROGRAM}`)
  }

  return { host: 'plain', hints }
}