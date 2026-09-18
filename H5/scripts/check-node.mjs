/**
 * Node version preflight.
 *
 * IMPORTANT: keep this file ASCII-only and free of any Web Crypto API usage.
 * It must run on Node 16 (and older) so it can report the problem instead of
 * crashing with the very error it is meant to explain.
 *
 * Background: Vite 5 requires Node >= 18. On Node 16, `npm run dev` throws
 *   TypeError: crypto$2.getRandomValues is not a function
 * because Node only exposed Web Crypto as globalThis.crypto from v19.
 */
const REQUIRED_MAJOR = 18
const current = process.versions.node
const major = Number(current.split('.')[0])

if (major >= REQUIRED_MAJOR) {
  process.exit(0)
}

const bar = '='.repeat(64)
console.error('')
console.error(bar)
console.error('  Node version too old - cannot start the Vite dev server')
console.error(bar)
console.error(`  Detected : v${current}`)
console.error(`  Required : >= v${REQUIRED_MAJOR}.0.0   (v22 LTS recommended)`)
console.error('')
console.error('  Why you see "crypto.getRandomValues is not a function":')
console.error('  Node exposes Web Crypto on globalThis.crypto only from v19.')
console.error('  Vite 5 depends on it, so it crashes on Node 16/17.')
console.error('')
console.error('  Fix (Windows, nvm installed):')
console.error('      nvm install 22')
console.error('      nvm use 22')
console.error('      npm run dev')
console.error('')
console.error('  Fix (no nvm): install Node 22 LTS from https://nodejs.org')
console.error('  then reopen the terminal and run: npm run dev')
console.error(bar)
console.error('')
process.exit(1)
