import pc from 'picocolors'

/** Mango / amber on dark — OpenMangos terminal identity */
export const theme = {
  brand: (s: string) => pc.bold(pc.yellow(s)),
  mango: (s: string) => pc.yellow(s),
  amber: (s: string) => pc.bold(pc.yellow(s)),
  accent: (s: string) => pc.cyan(s),
  dim: (s: string) => pc.dim(s),
  ok: (s: string) => pc.green(s),
  warn: (s: string) => pc.yellow(s),
  fail: (s: string) => pc.red(s),
  bold: (s: string) => pc.bold(s),
  inverse: (s: string) => pc.inverse(s),
  panel: (s: string) => pc.dim(s),
  input: (s: string) => pc.white(s),
  slash: (s: string) => pc.magenta(s),
  key: (s: string) => pc.bold(pc.cyan(s)),
}

export function healthGlyph(status: string): string {
  if (status === 'ok') return theme.ok('●')
  if (status === 'fail') return theme.fail('●')
  if (status === 'warn') return theme.warn('●')
  return theme.dim('○')
}