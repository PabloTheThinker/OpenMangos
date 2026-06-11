import { execFile } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

export async function readJson<T>(path: string): Promise<T | null> {
  const text = await readText(path)
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = 5000,
): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, LC_ALL: 'C' },
    })
    return { stdout: stdout.trim(), stderr: stderr.trim(), ok: true }
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; code?: number }
    return {
      stdout: (err.stdout ?? '').toString().trim(),
      stderr: (err.stderr ?? '').toString().trim(),
      ok: false,
    }
  }
}

export async function firstExisting(root: string, candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    if (await pathExists(join(root, candidate))) return candidate
  }
  return null
}