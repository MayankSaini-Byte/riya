// Set (or reset) the local admin password cleanly.
//
// Prompts for a password, hashes it, and writes ADMIN_USERS_JSON back into .env
// for you — so there is no copy-paste, no stray spaces, and no chance the
// password you typed differs from the one stored. Run it in your own terminal:
//
//   node scripts/set-admin-password.mjs
//
// Then restart `npm run dev` and sign in.

import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { createPasswordHash } from '../server/security.js'

const ENV_PATH = '.env'

function readEnvLines() {
  try { return readFileSync(ENV_PATH, 'utf8').split(/\r?\n/) }
  catch { return [] }
}

function currentUser(lines) {
  for (const line of lines) {
    const eq = line.indexOf('=')
    if (eq < 0 || line.slice(0, eq).trim() !== 'ADMIN_USERS_JSON') continue
    try {
      const parsed = JSON.parse(line.slice(eq + 1))
      if (Array.isArray(parsed) && parsed[0]) return parsed[0]
    } catch { /* fall through */ }
  }
  return null
}

const lines = readEnvLines()
const existing = currentUser(lines)
const username = (existing?.username || '').trim()
const role = existing?.role || 'super_admin'

if (!username) {
  process.stderr.write('No username found in ADMIN_USERS_JSON. Add one first, e.g. ADMIN_USERS_JSON=[{"username":"you@example.com","role":"super_admin","passwordHash":"placeholder"}]\n')
  process.exit(1)
}

const input = process.stdin
if (!input.isTTY || typeof input.setRawMode !== 'function') {
  process.stderr.write('Run this in an interactive terminal so the password is not echoed or saved in history.\n')
  process.exit(1)
}

process.stdout.write(`Setting password for: ${username} (${role})\n`)
const terminal = createInterface({ input, output: process.stdout, terminal: true })
terminal.close()
input.setRawMode(true)
input.resume()
let password = ''
process.stdout.write('New password (14+ characters): ')

input.on('data', async chunk => {
  for (const character of chunk.toString()) {
    if (character === '\u0003') { // Ctrl+C
      process.stdout.write('\nCancelled.\n')
      process.exit(1)
    }
    if (character === '\r' || character === '\n') {
      input.setRawMode(false)
      input.pause()
      process.stdout.write('\n')
      try {
        const passwordHash = await createPasswordHash(password)
        const entry = { username, role, passwordHash }
        const value = `ADMIN_USERS_JSON=${JSON.stringify([entry])}`
        let replaced = false
        const next = lines.map(line => {
          const eq = line.indexOf('=')
          if (eq > 0 && line.slice(0, eq).trim() === 'ADMIN_USERS_JSON') { replaced = true; return value }
          return line
        })
        if (!replaced) next.push(value)
        writeFileSync(ENV_PATH, next.join('\n'))
        process.stdout.write(`\nDone. Password set for ${username}.\nRestart "npm run dev", then sign in with this password.\n`)
      } catch (error) {
        process.stderr.write(`${error.message}\n`)
        process.exitCode = 1
      } finally {
        password = ''
      }
      process.exit()
    }
    if (character === '\u007f' || character === '\b') { // backspace
      password = password.slice(0, -1)
      process.stdout.write('\b \b')
    } else {
      password += character
      process.stdout.write('*')
    }
  }
})
