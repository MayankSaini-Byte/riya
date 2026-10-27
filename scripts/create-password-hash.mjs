import { createInterface } from 'node:readline'
import { createPasswordHash } from '../server/security.js'

const input = process.stdin
if (!input.isTTY || typeof input.setRawMode !== 'function') {
  process.stderr.write('Run this command in an interactive terminal so the password is not echoed or captured in shell history.\n')
  process.exit(1)
}

const terminal = createInterface({ input, output: process.stdout, terminal: true })
terminal.close()
input.setRawMode(true)
input.resume()
let password = ''
process.stdout.write('Admin password (14+ characters): ')

input.on('data', async chunk => {
  for (const character of chunk.toString()) {
    if (character === '\u0003') {
      process.stdout.write('\nCancelled.\n')
      process.exit(1)
    }
    if (character === '\r' || character === '\n') {
      input.setRawMode(false)
      input.pause()
      process.stdout.write('\n')
      try {
        const hash = await createPasswordHash(password)
        process.stdout.write(`${hash}\n`)
      } catch (error) {
        process.stderr.write(`${error.message}\n`)
        process.exitCode = 1
      } finally {
        password = ''
      }
      process.exit()
    }
    if (character === '\u007f' || character === '\b') {
      password = password.slice(0, -1)
      process.stdout.write('\b \b')
    } else {
      password += character
      process.stdout.write('*')
    }
  }
})
