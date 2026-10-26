import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const COOKIE_NAME = '__Host-bm_admin'
const SESSION_SECONDS = 60 * 60 * 8
const ROLES = new Set(['super_admin', 'content_editor', 'event_organizer', 'evaluator', 'read_only'])

export function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function requireMethod(req, res, method) {
  if (req.method === method) return true
  res.setHeader('Allow', method)
  json(res, 405, { error: 'Method not allowed' })
  return false
}

export function requireSameOrigin(req, res) {
  const origin = req.headers.origin
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || 'https'
  if (!origin || !host || origin !== `${proto}://${host}`) {
    json(res, 403, { error: 'Request origin rejected' })
    return false
  }
  return true
}

export function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
}

async function getAdminUsers() {
  let users
  try {
    users = JSON.parse(process.env.ADMIN_USERS_JSON || '[]')
  } catch {
    throw new Error('ADMIN_USERS_JSON must contain valid JSON')
  }
  if (!Array.isArray(users)) throw new Error('ADMIN_USERS_JSON must be an array')
  const envUsers = users.filter(user => user && typeof user.username === 'string' && /^[A-Za-z0-9._@-]{1,64}$/.test(user.username) && typeof user.passwordHash === 'string' && ROLES.has(user.role))
  // ADMIN_USERS_LOCAL_ONLY=true makes the app trust ADMIN_USERS_JSON alone and
  // skip the Redis-stored accounts. It is for local development pointed at a
  // shared Redis: it lets your .env admin sign in without the Redis copy of the
  // same username overriding it. Production never sets this flag, so its
  // behaviour is unchanged.
  const managedUsers = process.env.ADMIN_USERS_LOCAL_ONLY === 'true'
    ? []
    : process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ? await readStoredJson('bm-admin:users:v1', [])
      : []
  if (!Array.isArray(managedUsers)) throw new Error('Stored admin accounts are invalid')
  const merged = new Map(envUsers.map(user => [user.username.toLowerCase(), user]))
  for (const user of managedUsers) {
    if (user && typeof user.username === 'string' && /^[A-Za-z0-9._@-]{1,64}$/.test(user.username) && typeof user.passwordHash === 'string' && ROLES.has(user.role) && user.active !== false) {
      merged.set(user.username.toLowerCase(), user)
    }
  }
  return [...merged.values()]
}

export async function assertAuthConfig() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters')
  }
  const users = await getAdminUsers()
  const uniqueNames = new Set(users.map(user => user.username.toLowerCase()))
  if (!users.length || uniqueNames.size !== users.length) throw new Error('Admin users must be configured with unique usernames')
  if (!users.some(user => user.role === 'super_admin')) throw new Error('At least one Super Admin must be configured')
  if (users.some(user => !/^scrypt\$[a-f\d]{64}\$[a-f\d]{128}$/i.test(user.passwordHash))) {
    throw new Error('Admin password hashes must use the configured scrypt format')
  }
}

export async function verifyPassword(password, encoded) {
  const [algorithm, salt, expectedHex] = String(encoded).split('$')
  if (algorithm !== 'scrypt' || !salt || !/^[a-f\d]{128}$/i.test(expectedHex || '')) return false
  const actual = await scrypt(password, Buffer.from(salt, 'hex'), 64)
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function createPasswordHash(password) {
  if (typeof password !== 'string' || password.length < 14 || password.length > 1024) {
    throw new Error('Password must be between 14 and 1024 characters')
  }
  const salt = randomBytes(32)
  const hash = await scrypt(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${Buffer.from(hash).toString('hex')}`
}

function sign(value) {
  return createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('base64url')
}

export function createSession(user) {
  const payload = Buffer.from(JSON.stringify({
    username: user.username,
    role: user.role,
    credentialFingerprint: createHmac('sha256', process.env.SESSION_SECRET).update(user.passwordHash).digest('hex'),
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export async function readSession(req) {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(part => {
    const [key, ...value] = part.trim().split('=')
    return [key, value.join('=')]
  }).filter(([key]) => key))
  const token = cookies[COOKIE_NAME]
  if (!token || !process.env.SESSION_SECRET) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(signature)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (session.exp <= Math.floor(Date.now() / 1000)) return null
    const user = (await getAdminUsers()).find(entry => entry.username === session.username && entry.role === session.role)
    if (!user) return null
    const fingerprint = createHmac('sha256', process.env.SESSION_SECRET).update(user.passwordHash).digest('hex')
    if (fingerprint !== session.credentialFingerprint) return null
    return { username: user.username, role: user.role }
  } catch {
    return null
  }
}

export function writeSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`)
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`)
}

/**
 * The address to key rate limits on.
 *
 * `x-real-ip` is set by the platform edge and holds a single, trustworthy
 * value, so it is preferred. Falling back to `x-forwarded-for`, we take the
 * LAST entry rather than the first: the header reads `client, proxy1, proxy2`,
 * and a caller may send their own `x-forwarded-for`, which the edge appends
 * to. Only the final entry is the address the trusted edge actually observed.
 * Taking the first would let anyone rotate invented addresses and walk past
 * every limit below.
 *
 * Returns an empty string when no address is available; callers decide what a
 * missing address means rather than silently sharing one bucket by accident.
 */
export function clientAddress(req) {
  const real = String(req.headers['x-real-ip'] || '').trim()
  if (real) return real
  const chain = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
  return chain.length ? chain[chain.length - 1] : ''
}

export async function enforceLoginLimit(req, res, username) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url?.startsWith('https://') || !token) {
    json(res, 503, { error: 'Login protection is not configured' })
    return false
  }
  // With no address the limit still applies per account, which is the control
  // that matters for password guessing.
  const address = clientAddress(req) || 'no-address'
  const key = `bm-admin-login:${createHmac('sha256', process.env.SESSION_SECRET).update(`${address}:${username.toLowerCase()}`).digest('hex')}`
  const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],900) end; return n"
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['EVAL', script, '1', key]]),
    })
    if (!response.ok) throw new Error('Rate-limit store unavailable')
    const result = await response.json()
    if (result?.[0]?.error) throw new Error('Rate-limit command rejected')
    if (Number(result?.[0]?.result) > 8) {
      json(res, 429, { error: 'Too many login attempts. Try again in 15 minutes.' })
      return false
    }
    return true
  } catch {
    json(res, 503, { error: 'Login protection is temporarily unavailable' })
    return false
  }
}

export async function recordAudit(entry) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url?.startsWith('https://') || !token) throw new Error('Audit storage is not configured')
  const key = 'bm-admin:audit:v1'
  const value = JSON.stringify({ ...entry, at: new Date().toISOString() })
  const commands = [
    ['LPUSH', key, value],
    ['LTRIM', key, '0', '9999'],
    ['EXPIRE', key, '31536000'],
  ]
  const response = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  })
  if (!response.ok) throw new Error('Audit storage unavailable')
  const results = await response.json()
  if (results.some(item => item.error)) throw new Error('Audit storage unavailable')
}

export async function readAudit() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url?.startsWith('https://') || !token) throw new Error('Audit storage is not configured')
  const response = await fetch(`${url.replace(/\/$/, '')}/lrange/bm-admin%3Aaudit%3Av1/0/499`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error('Audit storage unavailable')
  const result = await response.json()
  return Array.isArray(result.result) ? result.result.map(value => JSON.parse(value)) : []
}

export async function authenticate(username, password) {
  const users = await getAdminUsers()
  const user = users.find(entry => entry.username.toLowerCase() === username.toLowerCase())
  const hashToCheck = user?.passwordHash || users[0]?.passwordHash
  if (!hashToCheck || !(await verifyPassword(password, hashToCheck))) return null
  return user || null
}

export async function requireSession(req, res, roles = []) {
  try {
    await assertAuthConfig()
  } catch {
    json(res, 503, { error: 'Admin authentication is not configured' })
    return null
  }
  const user = await readSession(req)
  if (!user) {
    json(res, 401, { error: 'Authentication required' })
    return null
  }
  if (roles.length && !roles.includes(user.role)) {
    json(res, 403, { error: 'Access denied' })
    return null
  }
  return user
}

export async function readStoredJson(key, fallback = null) {
  const result = await redisCommand(['GET', key])
  if (result === null) return fallback
  try { return JSON.parse(result) } catch { throw new Error('Stored admin data is invalid') }
}

export async function writeStoredJson(key, value, ttlSeconds) {
  const command = ['SET', key, JSON.stringify(value)]
  if (Number.isInteger(ttlSeconds) && ttlSeconds > 0) command.push('EX', String(ttlSeconds))
  await redisCommand(command)
}

export async function checkPublicSubmissionLimit(req) {
  // The platform always sets one of these headers, so an empty address means
  // the app is not behind the expected edge. Keep limiting rather than opening
  // the endpoint up, but on a shared bucket so the cause is visible in Redis.
  const address = clientAddress(req) || 'no-address'
  const digest = createHmac('sha256', process.env.SESSION_SECRET || 'binary-minds').update(address).digest('hex')
  const key = `bm-bip:rate:${digest}`
  const result = await redisCommand(['EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],3600) end; return n", '1', key])
  return Number(result) <= 5
}

async function redisCommand(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url?.startsWith('https://') || !token) throw new Error('Upstash storage is not configured')
  const response = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([command]),
  })
  if (!response.ok) throw new Error('Upstash storage is unavailable')
  const result = await response.json()
  if (result?.[0]?.error) throw new Error('Upstash command failed')
  return result?.[0]?.result ?? null
}

export { COOKIE_NAME, ROLES }
