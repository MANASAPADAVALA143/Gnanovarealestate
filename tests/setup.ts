import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

/** Load `.env` / `.env.local` into process.env for Node Vitest (no Vite env injection). */
function loadEnvFile(file: string) {
  const fullPath = resolve(process.cwd(), file)
  if (!existsSync(fullPath)) return
  const lines = readFileSync(fullPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = val
    }
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')
