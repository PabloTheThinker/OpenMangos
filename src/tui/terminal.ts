import { stdin as input, stdout as output } from 'node:process'

export interface TerminalSize {
  cols: number
  rows: number
}

export class Terminal {
  private raw = false
  private altScreen = false
  private listeners = new Map<string, Set<(data: string) => void>>()
  private onResize?: () => void

  size(): TerminalSize {
    return {
      cols: output.columns ?? 80,
      rows: output.rows ?? 24,
    }
  }

  enter(): void {
    if (!input.isTTY) return
    input.setRawMode(true)
    this.raw = true
    input.resume()
    input.setEncoding('utf8')
    input.on('data', (chunk: string) => this.emit('data', chunk))
    output.on('resize', () => this.onResize?.())
    this.write('\x1b[?1049h\x1b[?25l\x1b[H')
    this.altScreen = true
  }

  exit(): void {
    if (!input.isTTY) return
    this.write('\x1b[?1049l\x1b[?25h')
    this.altScreen = false
    if (this.raw) {
      input.setRawMode(false)
      this.raw = false
    }
    input.pause()
    input.removeAllListeners('data')
    output.removeAllListeners('resize')
    this.listeners.clear()
  }

  on(event: 'data', handler: (data: string) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
  }

  off(event: 'data', handler: (data: string) => void): void {
    this.listeners.get(event)?.delete(handler)
  }

  onWindowResize(handler: () => void): void {
    this.onResize = handler
  }

  write(data: string): void {
    output.write(data)
  }

  clear(): void {
    const { rows } = this.size()
    this.write(`\x1b[H\x1b[0J`)
    for (let i = 0; i < rows; i++) this.write('\x1b[E')
    this.write('\x1b[H')
  }

  moveTo(row: number, col: number): void {
    this.write(`\x1b[${row};${col}H`)
  }

  hideCursor(): void {
    this.write('\x1b[?25l')
  }

  showCursor(): void {
    this.write('\x1b[?25h')
  }

  private emit(event: string, data: string): void {
    for (const handler of this.listeners.get(event) ?? []) handler(data)
  }

  isInteractive(): boolean {
    return input.isTTY === true
  }
}

export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '')
}

export function visibleWidth(text: string): number {
  return stripAnsi(text).length
}

export function truncate(text: string, max: number): string {
  const plain = stripAnsi(text)
  if (plain.length <= max) return text
  if (max <= 1) return '…'
  return plain.slice(0, max - 1) + '…'
}

export function wrapLines(text: string, width: number): string[] {
  const lines: string[] = []
  for (const raw of text.split('\n')) {
    let line = raw
    while (visibleWidth(line) > width) {
      let cut = width
      while (cut > 0 && visibleWidth(line.slice(0, cut)) > width) cut--
      lines.push(line.slice(0, cut))
      line = line.slice(cut).trimStart()
    }
    lines.push(line)
  }
  return lines
}