import type { SituationGraph } from '../types.js'
import { theme, healthGlyph } from './theme.js'
import { truncate, visibleWidth, wrapLines } from './terminal.js'

export type Overlay = 'none' | 'help' | 'sessions' | 'missions' | 'transcript'

export interface LayoutState {
  situation: SituationGraph
  transcript: string[]
  input: string
  overlay: Overlay
  overlayContent: string[]
  selectedBackend: string
  bashMode: boolean
  statusLine: string
  cursorPos: number
}

const MODE_COLORS: Record<string, (s: string) => string> = {
  build: theme.mango,
  debug: theme.warn,
  infra: theme.accent,
  review: theme.slash,
  ship: theme.ok,
}

export function renderFrame(state: LayoutState, cols: number, rows: number): string {
  const lines: string[] = []
  const border = theme.panel('─'.repeat(Math.max(0, cols - 2)))

  lines.push(renderSituationStrip(state, cols))
  lines.push(theme.panel(`├${border}┤`))

  const inputRows = 3
  const footerRows = 1
  const bodyRows = Math.max(4, rows - 1 - inputRows - footerRows)

  if (state.overlay !== 'none') {
    lines.push(...renderOverlay(state, cols, bodyRows + inputRows))
  } else {
    lines.push(...renderTranscript(state.transcript, cols, bodyRows))
    lines.push(theme.panel(`├${border}┤`))
    lines.push(...renderInput(state, cols, inputRows))
  }

  lines.push(renderFooter(state, cols))
  return lines.slice(0, rows).join('\n')
}

function renderSituationStrip(state: LayoutState, cols: number): string {
  const s = state.situation
  const modeColor = MODE_COLORS[s.mode] ?? theme.mango
  const stack = s.stack.slice(0, 3).join(',') || '—'
  const infra = s.infra.slice(0, 2).join(',') || '—'
  const healthKeys = Object.keys(s.health)
  const health =
    healthKeys.length ?
      healthKeys
        .slice(0, 2)
        .map((k) => `${healthGlyph(s.health[k].status)}${k}`)
        .join(' ')
    : theme.dim('no health')

  const backend = state.selectedBackend || s.backends.preferred
  const avail = s.backends.available.includes(backend as typeof s.backends.preferred) ?
    theme.ok('▶')
  : theme.dim('○')

  const parts = [
    theme.brand('🥭 OpenMangos'),
    modeColor(s.mode.toUpperCase()),
    theme.dim('│'),
    theme.accent(stack),
    theme.dim('│'),
    theme.mango(infra),
    theme.dim('│'),
    health,
    theme.dim('│'),
    `${avail} ${theme.bold(backend)}`,
    theme.dim('│'),
    theme.dim(s.workspace),
  ]

  let line = theme.panel('│ ') + parts.join(' ') + theme.panel(' │')
  if (visibleWidth(line) > cols) {
    const compact = [
      theme.brand('🥭'),
      modeColor(s.mode),
      stack,
      `${avail}${backend}`,
      s.workspace,
    ].join(' ')
    line = theme.panel('│ ') + truncate(compact, cols - 4) + theme.panel(' │')
  }
  return line
}

function renderTranscript(transcript: string[], cols: number, maxRows: number): string {
  const inner = cols - 4
  const wrapped: string[] = []
  for (const entry of transcript) {
    for (const w of wrapLines(entry, inner)) wrapped.push(w)
  }
  const visible = wrapped.slice(-maxRows)
  const pad = maxRows - visible.length
  const lines: string[] = []
  for (let i = 0; i < pad; i++) lines.push(theme.panel('│ ') + ' '.repeat(inner) + theme.panel(' │'))
  for (const row of visible) {
    const padded = row + ' '.repeat(Math.max(0, inner - visibleWidth(row)))
    lines.push(theme.panel('│ ') + padded + theme.panel(' │'))
  }
  return lines.join('\n')
}

function renderInput(state: LayoutState, cols: number, rows: number): string {
  const inner = cols - 6
  const prefix = state.bashMode ? theme.fail('! ') : theme.mango('› ')
  const inputLine = prefix + theme.input(state.input)
  const wrapped = wrapLines(stripForWrap(state.input, prefix), inner)
  const lines: string[] = []
  const show = wrapped.slice(-(rows - 1))
  for (const row of show) {
    lines.push(theme.panel('│ ') + row + ' '.repeat(Math.max(0, inner - visibleWidth(row))) + theme.panel(' │'))
  }
  while (lines.length < rows - 1) {
    lines.push(theme.panel('│ ') + ' '.repeat(inner) + theme.panel(' │'))
  }
  if (state.statusLine) {
    lines.push(
      theme.panel('│ ') +
        truncate(theme.dim(state.statusLine), inner) +
        ' '.repeat(Math.max(0, inner - visibleWidth(truncate(theme.dim(state.statusLine), inner)))) +
        theme.panel(' │'),
    )
  } else {
    lines.push(theme.panel('│ ') + theme.dim('Enter submit · Tab mode · Shift+Tab backend · ? help') + theme.panel(' │'))
  }
  return lines.join('\n')
}

function stripForWrap(input: string, prefix: string): string {
  return prefix + input
}

function renderFooter(state: LayoutState, cols: number): string {
  const hints = state.bashMode ?
    [theme.key('Esc'), 'agent', theme.key('!'), 'bash']
  : [
      theme.key('Tab'),
      'mode',
      theme.key('Shift+Tab'),
      'backend',
      theme.key('Ctrl+G'),
      'run',
      theme.key('Ctrl+O'),
      'sessions',
      theme.key('Ctrl+T'),
      'mission',
      theme.key('Ctrl+C'),
      'quit',
    ]
  const text = hints.join(' · ')
  return theme.panel('└') + truncate(text, cols - 2) + theme.panel('┘')
}

function renderOverlay(state: LayoutState, cols: number, maxRows: number): string[] {
  const inner = cols - 4
  const title =
    state.overlay === 'help' ? theme.brand('Shortcuts & slash commands')
    : state.overlay === 'sessions' ? theme.brand('Sessions')
    : state.overlay === 'missions' ? theme.brand('Mission')
    : theme.brand('Transcript')

  const lines: string[] = []
  lines.push(theme.panel('│ ') + theme.inverse(` ${title} `) + theme.panel(' '.repeat(Math.max(0, inner - visibleWidth(title) - 2)) + ' │'))
  lines.push(theme.panel('│ ') + theme.dim('Esc to close') + theme.panel(' '.repeat(inner - 12) + ' │'))

  const content = state.overlayContent.flatMap((c) => wrapLines(c, inner))
  const visible = content.slice(0, maxRows - 3)
  for (const row of visible) {
    lines.push(theme.panel('│ ') + row + ' '.repeat(Math.max(0, inner - visibleWidth(row))) + theme.panel(' │'))
  }
  while (lines.length < maxRows) {
    lines.push(theme.panel('│ ') + ' '.repeat(inner) + theme.panel(' │'))
  }
  return lines
}

export function helpContent(): string[] {
  return [
    theme.bold('Slash commands (Factory / Codex / Claude pattern)'),
    '',
    theme.slash('/sense') + '     Refresh situation probes',
    theme.slash('/mode') + ' [n]  Switch mode (build|debug|infra|review|ship)',
    theme.slash('/tools') + '      Adaptive tools for current mode',
    theme.slash('/route') + ' <t> Route task → backend + mode',
    theme.slash('/run') + ' [b]   Sense + pack + launch backend',
    theme.slash('/wrap') + ' [b]   Launch backend with context',
    theme.slash('/verify') + '     Run stack verification',
    theme.slash('/pack') + '       Write context pack',
    theme.slash('/mission') + '    plan <goal> | show | run',
    theme.slash('/sessions') + '   Recent session log',
    theme.slash('/recall') + '     Cross-session memory',
    theme.slash('/doctor') + '     Backend health check',
    theme.slash('/clear') + '      Clear transcript',
    theme.slash('/help') + '       This panel',
    '',
    theme.bold('Keys'),
    theme.key('Tab') + ' / ' + theme.key('Shift+Tab') + '  Cycle mode / backend',
    theme.key('Ctrl+G') + '          Run routed session',
    theme.key('Ctrl+O') + '          Sessions overlay',
    theme.key('Ctrl+T') + '          Mission overlay',
    theme.key('!') + ' at start       Shell command (Factory bash mode)',
    theme.key('?') + '               Help overlay',
    '',
    theme.dim('Plain text (no /) routes your task and suggests a backend.'),
    theme.dim('OpenMangos differentiator: situation strip always visible.'),
  ]
}