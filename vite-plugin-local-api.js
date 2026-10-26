// Local API dev server.
//
// In production the files under /api run as Vercel serverless functions.
// `vite dev` only serves the frontend, so this plugin runs those same handlers
// inside the dev server — meaning `npm run dev` gives you the admin portal and
// its API locally, with no Vercel account, login, or deployment involved.
//
// It adapts the Vercel (req, res) shape to Node's native http objects and loads
// your git-ignored .env into process.env so the handlers find their secrets.

import { readFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Minimal .env reader that keeps values literal. We cannot use Vite's loadEnv
// here: it runs dotenv's variable expansion, which eats the "$" in scrypt
// password hashes (scrypt$salt$hash) and corrupts ADMIN_USERS_JSON.
function readEnvFile(path) {
  let text
  try { text = readFileSync(path, 'utf8') } catch { return {} }
  const result = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (value.length >= 2 && ((value[0] === '"' && value.endsWith('"')) || (value[0] === "'" && value.endsWith("'")))) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

function readBody(req) {
  const method = (req.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return Promise.resolve(undefined)
  return new Promise(resolve => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(undefined)
      if ((req.headers['content-type'] || '').includes('application/json')) {
        try { return resolve(JSON.parse(raw)) } catch { return resolve(raw) }
      }
      resolve(raw)
    })
    req.on('error', () => resolve(undefined))
  })
}

export function localApi() {
  return {
    name: 'local-api',
    apply: 'serve',

    // Load every .env var into process.env (Vite only exposes VITE_ ones),
    // reading literally so "$" in secrets survives. A value already set in the
    // real environment wins; .env.local overrides .env.
    config() {
      const merged = { ...readEnvFile(join(process.cwd(), '.env')), ...readEnvFile(join(process.cwd(), '.env.local')) }
      for (const [key, value] of Object.entries(merged)) {
        if (process.env[key] === undefined) process.env[key] = value
      }
    },

    configureServer(server) {
      const apiDir = join(server.config.root, 'api')

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()

        const url = new URL(req.url, 'http://localhost')
        const route = url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '')
        const file = join(apiDir, `${route}.js`)

        const sendJson = (status, body) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(body))
        }

        try {
          await stat(file)
        } catch {
          return sendJson(404, { error: `No local API route for /api/${route}` })
        }

        try {
          // Shape the request the way the Vercel runtime would.
          req.query = Object.fromEntries(url.searchParams.entries())
          req.body = await readBody(req)
          req.headers['x-forwarded-proto'] = 'http' // so the same-origin check matches http://localhost
          if (!req.headers['x-real-ip']) req.headers['x-real-ip'] = '127.0.0.1'

          // Add the Express-style helpers the handlers expect on res.
          res.status = code => { res.statusCode = code; return res }
          res.json = body => {
            if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(body))
          }
          res.send = body => res.end(body)

          // Re-import each time so edits to api/ files take effect without a restart.
          const module = await import(`${pathToFileURL(file).href}?t=${Date.now()}`)
          if (typeof module.default !== 'function') {
            return sendJson(500, { error: `/api/${route} has no default export handler` })
          }
          await module.default(req, res)
        } catch (error) {
          server.config.logger.error(`[local-api] /api/${route} failed:\n${error?.stack || error}`)
          if (!res.writableEnded) sendJson(500, { error: `Local API error: ${error?.message || 'unknown'}` })
        }
      })
    },
  }
}
