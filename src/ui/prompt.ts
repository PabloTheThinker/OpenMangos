import { createInterface } from 'node:readline'
import { stdin as input, stdout as output } from 'node:process'

export function isInteractiveTerminal(): boolean {
  return input.isTTY === true
}

export function promptLine(question: string): Promise<string> {
  if (!isInteractiveTerminal()) return Promise.resolve('')

  const rl = createInterface({ input, output, terminal: true })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

export async function promptYesNo(
  question: string,
  defaultYes = false,
): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]'
  const answer = (await promptLine(`${question} ${hint}: `)).trim().toLowerCase()
  if (!answer) return defaultYes
  return answer.startsWith('y')
}

export async function promptSelect<T extends string>(
  title: string,
  choices: Array<{ value: T; label: string }>,
  defaultIndex = 0,
): Promise<T> {
  if (!choices.length) throw new Error('No choices')
  if (choices.length === 1) return choices[0]!.value

  console.error('')
  console.error(title)
  console.error('')
  choices.forEach((choice, i) => {
    const mark = i === defaultIndex ? ' (default)' : ''
    console.error(`  ${i + 1}) ${choice.label}${mark}`)
  })
  console.error('')

  const answer = await promptLine(`Choice [${defaultIndex + 1}]: `)
  const trimmed = answer.trim()
  if (!trimmed) return choices[defaultIndex]!.value

  const num = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(num) || num < 1 || num > choices.length) {
    return choices[defaultIndex]!.value
  }
  return choices[num - 1]!.value
}