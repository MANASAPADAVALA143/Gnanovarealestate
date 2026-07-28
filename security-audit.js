#!/usr/bin/env node
/**
 * Wrapper — runs the TypeScript security audit (project uses ESM).
 * Usage: node security-audit.js   OR   npm run security-audit
 */
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const dir = dirname(fileURLToPath(import.meta.url))
const script = join(dir, 'scripts', 'security-audit.ts')

const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', script], {
  stdio: 'inherit',
  cwd: dir,
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
