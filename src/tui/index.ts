export { runTuiApp } from './app.js'

export async function runTui(options: { directory?: string } = {}): Promise<void> {
  const { runTuiApp } = await import('./app.js')
  await runTuiApp({ directory: options.directory ?? process.cwd() })
}