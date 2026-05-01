#!/usr/bin/env tsx
/**
 * Check if development servers are running
 */

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function checkServer(name: string, url: string, method: 'GET' | 'POST' = 'GET', body?: any) {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(3000), // 3 second timeout
    })
    log(`✅ ${name} is running (${response.status})`, 'green')
    return true
  } catch (error: any) {
    if (error.name === 'AbortError') {
      log(`⏱️  ${name} timeout (server may be starting)`, 'yellow')
    } else {
      log(`❌ ${name} is not running`, 'red')
      log(`   URL: ${url}`, 'yellow')
      log(`   Error: ${error.message}`, 'yellow')
    }
    return false
  }
}

async function main() {
  console.log('\n🔍 Checking Development Servers...\n')

  const servers = [
    { name: 'Vite/Next.js (port 3000)', url: 'http://localhost:3000', method: 'GET' as const },
    { name: 'Express (port 3001)', url: 'http://localhost:3001/health', method: 'GET' as const },
    { name: 'Property Search API', url: 'http://localhost:3000/api/properties/search', method: 'POST' as const, body: { query: 'test' } },
  ]

  const results = await Promise.all(
    servers.map(s => checkServer(s.name, s.url, s.method, s.body))
  )

  const running = results.filter(r => r).length

  console.log('\n' + '='.repeat(60))
  log(`Results: ${running}/${servers.length} servers running`, running > 0 ? 'green' : 'red')
  console.log('='.repeat(60))

  if (running === 0) {
    console.log('\n💡 To start servers:')
    console.log('   Terminal 1: npm run dev')
    console.log('   Terminal 2: npm run webhook (if using Express)')
  } else if (running < servers.length) {
    console.log('\n💡 Some servers are not running. Start missing servers:')
    if (!results[0]) console.log('   - npm run dev (for Vite/Next.js)')
    if (!results[1]) console.log('   - npm run webhook (for Express)')
  } else {
    log('\n✅ All servers are running!', 'green')
  }

  console.log('')
}

main().catch(console.error)
