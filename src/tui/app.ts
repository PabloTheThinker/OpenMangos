import { spawn } from 'node:child_process'
import { MODES } from '../core/modes.js'
import type { BackendId, Mode, SituationGraph } from '../types.js'
import { helpContent, renderFrame, type LayoutState, type Overlay } from './layout.js'
import { handlePlainTask, handleSlash, launchFromTui, type SlashContext } from './slash.js'
import { Terminal } from './terminal.js'
import { theme } from './theme.js'

export interface TuiOptions {
  directory: string
}

export async function runTuiApp(options: TuiOptions): Promise<void> {
  const root = options.directory
  const term = new Terminal()

  if (!term.isInteractive()) {
    console.error('OpenMangos TUI requires an interactive terminal.')
    console.error('Run: om sense · om run grok')
    process.exit(1)
  }

  let situation = await buildInitialSituation(root)
  let selectedBackend: BackendId = situation.backends.preferred
  const session = { lastTask: undefined as string | undefined }
  let input = ''
  let cursor = 0
  let overlay: Overlay = 'none'
  let overlayContent: string[] = []
  let bashMode = false
  let statusLine = ''
  const transcript: string[] = [
    theme.brand('OpenMangos') + ' — adaptive terminal framework',
    theme.dim('The terminal adapts to the problem. The model adapts to the terminal.'),
    '',
    theme.dim('Type a task, /help, or ? · situation strip stays live above.'),
  ]

  const slashCtx = (): SlashContext => ({
    root,
    situation,
    selectedBackend,
    lastTask: session.lastTask,
    onSituationUpdate: (s) => {
      situation = s
    },
    onBackendSelect: (b) => {
      selectedBackend = b
    },
    onExitForLaunch: () => term.exit(),
  })

  const redraw = () => {
    const { cols, rows } = term.size()
    const state: LayoutState = {
      situation,
      transcript,
      input,
      overlay,
      overlayContent,
      selectedBackend,
      bashMode,
      statusLine,
      cursorPos: cursor,
    }
    term.clear()
    term.write(renderFrame(state, cols, rows))
    if (overlay === 'none') {
      const prefixLen = bashMode ? 2 : 2
      term.moveTo(rows - 3, 3 + prefixLen + cursor)
      term.showCursor()
    } else {
      term.hideCursor()
    }
  }

  term.enter()
  term.onWindowResize(redraw)
  redraw()

  const appendLines = (lines: string[]) => {
    for (const line of lines) transcript.push(line)
    while (transcript.length > 500) transcript.shift()
  }

  const closeOverlay = () => {
    overlay = 'none'
    overlayContent = []
    redraw()
  }

  const openOverlay = (kind: Overlay, content: string[]) => {
    overlay = kind
    overlayContent = kind === 'help' ? helpContent() : content
    redraw()
  }

  const cycleMode = async (dir: 1 | -1) => {
    const idx = MODES.indexOf(situation.mode)
    const next = MODES[(idx + dir + MODES.length) % MODES.length] as Mode
    const { loadProfile, saveProfile } = await import('../core/profile.js')
    const { buildSituation } = await import('../core/situation.js')
    const profile = await loadProfile(root)
    profile.mode = next
    await saveProfile(root, profile)
    situation = await buildSituation(root)
    statusLine = `Mode → ${next}`
    appendLines([theme.ok(`Mode: ${next}`)])
    redraw()
  }

  const cycleBackend = (dir: 1 | -1) => {
    const avail = situation.backends.available
    if (!avail.length) {
      statusLine = 'No backends on PATH'
      redraw()
      return
    }
    const idx = Math.max(0, avail.indexOf(selectedBackend))
    const next = avail[(idx + dir + avail.length) % avail.length]!
    selectedBackend = next
    statusLine = `Backend → ${next}`
    appendLines([theme.ok(`Backend: ${next}`)])
    redraw()
  }

  const processSlashResult = async (result: Awaited<ReturnType<typeof handleSlash>>) => {
    if (result.type === 'clear') {
      transcript.length = 0
      appendLines([theme.dim('Transcript cleared.')])
    } else if (result.type === 'lines') {
      appendLines(result.lines)
    } else if (result.type === 'overlay') {
      openOverlay(result.kind, result.lines)
      return
    } else if (result.type === 'launch') {
      session.lastTask = result.task ?? session.lastTask
      selectedBackend = result.backend
      term.exit()
      situation = await (await import('../core/situation.js')).buildSituation(root)
      await launchFromTui(root, result.backend, situation)
      return
    } else if (result.type === 'refresh') {
      situation = await (await import('../core/situation.js')).buildSituation(root)
    }
    redraw()
  }

  const submit = async () => {
    const line = input.trim()
    input = ''
    cursor = 0
    statusLine = ''

    if (!line) {
      redraw()
      return
    }

    if (bashMode || line.startsWith('!')) {
      const cmd = bashMode ? line : line.slice(1).trim()
      bashMode = false
      appendLines([theme.fail('! ') + cmd])
      const out = await runShell(cmd, root)
      appendLines(out.split('\n').filter(Boolean).map((l) => theme.dim(l)))
      redraw()
      return
    }

    appendLines([theme.mango('› ') + line])

    if (line === '?') {
      openOverlay('help', helpContent())
      return
    }

    if (line.startsWith('/')) {
      const result = await handleSlash(line, slashCtx())
      if (result.type === 'launch' && result.task) session.lastTask = result.task
      await processSlashResult(result)
      return
    }

    session.lastTask = line
    const lines = await handlePlainTask(line, slashCtx())
    appendLines(lines)
    redraw()
  }

  const launchRouted = async () => {
    const result = await handleSlash('/run', slashCtx())
    await processSlashResult(result)
  }

  return new Promise<void>((resolve) => {
    const onData = (data: string) => {
      if (overlay !== 'none') {
        if (data === '\x1b' || data === '\x03') {
          if (data === '\x03') {
            term.exit()
            process.exit(0)
          }
          closeOverlay()
          return
        }
        return
      }

      if (data === '\x03') {
        term.exit()
        resolve()
        process.exit(0)
      }

      // Ctrl+G — run routed session (Factory/Codex launch pattern)
      if (data === '\x07') {
        void launchRouted()
        return
      }

      // Ctrl+O — sessions transcript (Factory Ctrl+O)
      if (data === '\x0f') {
        void handleSlash('/sessions', slashCtx()).then(processSlashResult)
        return
      }

      // Ctrl+T — mission panel (Factory Ctrl+T)
      if (data === '\x14') {
        void handleSlash('/mission', slashCtx()).then(processSlashResult)
        return
      }

      // Shift+Tab — cycle backend
      if (data === '\x1b[Z') {
        cycleBackend(1)
        return
      }

      // Tab — cycle mode (Factory Shift+Tab modes → we use Tab)
      if (data === '\t') {
        void cycleMode(1)
        return
      }

      if (data === '\r' || data === '\n') {
        void submit()
        return
      }

      if (data === '\x7f' || data === '\b') {
        if (cursor > 0) {
          input = input.slice(0, cursor - 1) + input.slice(cursor)
          cursor--
        }
        redraw()
        return
      }

      if (data === '\x1b[D') {
        if (cursor > 0) cursor--
        redraw()
        return
      }
      if (data === '\x1b[C') {
        if (cursor < input.length) cursor++
        redraw()
        return
      }

      if (data === '!' && input.length === 0 && cursor === 0) {
        bashMode = true
        redraw()
        return
      }

      if (data.length === 1 && data >= ' ') {
        input = input.slice(0, cursor) + data + input.slice(cursor)
        cursor += data.length
        redraw()
      }
    }

    term.on('data', onData)

    process.on('SIGINT', () => {
      term.exit()
      resolve()
      process.exit(0)
    })
  })
}

async function buildInitialSituation(root: string): Promise<SituationGraph> {
  const { buildSituation } = await import('../core/situation.js')
  return buildSituation(root)
}

function runShell(command: string, cwd: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(command, [], {
      cwd,
      shell: true,
      env: process.env,
    })
    let out = ''
    child.stdout?.on('data', (c) => {
      out += String(c)
    })
    child.stderr?.on('data', (c) => {
      out += String(c)
    })
    child.on('close', () => resolve(out || '(no output)'))
    child.on('error', (e) => resolve(e.message))
  })
}