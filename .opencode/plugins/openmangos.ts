/**
 * OpenMangos ↔ OpenCode bridge plugin (scaffolded by om init).
 * Passes OPENMANGOS_* env through shell tools and compaction context.
 */
export const OpenMangosPlugin = async () => {
  const keys = [
    'OPENMANGOS_ROOT',
    'OPENMANGOS_MODE',
    'OPENMANGOS_CONTEXT',
    'OPENMANGOS_CONTEXT_MD',
    'OPENMANGOS_SESSION',
  ]

  return {
    "shell.env": async (_input, output) => {
      for (const key of keys) {
        const value = process.env[key]
        if (value) output.env[key] = value
      }
    },
    "experimental.session.compacting": async (_input, output) => {
      const mode = process.env.OPENMANGOS_MODE
      const contextMd = process.env.OPENMANGOS_CONTEXT_MD
      if (!mode && !contextMd) return
      output.context.push(`
## OpenMangos substrate
- mode: ${mode ?? 'unknown'}
- context: ${contextMd ?? 'none'}
`)
    },
  }
}
