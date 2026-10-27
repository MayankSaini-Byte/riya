import { createClient } from '@sanity/client'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

// Shared Sanity access for the admin API: the write client, image uploads, and
// a guarded fetcher for pulling article previews from the open web.

// Vercel holds these as SANITY_API_PROJECT_ID / SANITY_API_DATASET, so read
// both spellings. Resolved on each call because env loads after import in dev.
export function sanityConfig() {
  return {
    projectId: process.env.SANITY_PROJECT_ID || process.env.SANITY_API_PROJECT_ID || 'pirhl038',
    dataset: process.env.SANITY_DATASET || process.env.SANITY_API_DATASET || 'production',
  }
}

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024

export function sanityWriteClient() {
  const token = process.env.SANITY_API_WRITE_TOKEN
  if (!token) throw new Error('Sanity write access is not configured')
  return createClient({
    ...sanityConfig(),
    token,
    apiVersion: '2025-01-01',
    useCdn: false,
  })
}

// Identify the format from the file's own bytes rather than trusting the
// extension or the declared content type.
export function sniffImageType(buffer) {
  if (!buffer || buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a') return 'image/gif'
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  if (buffer.toString('ascii', 4, 12) === 'ftypavif') return 'image/avif'
  return null
}

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif' }

export async function uploadImage(buffer, name = 'image') {
  if (!buffer?.length) throw new Error('The image is empty.')
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Images must be 3 MB or smaller.')
  const contentType = sniffImageType(buffer)
  if (!contentType) throw new Error('Upload a JPEG, PNG, WebP, GIF or AVIF image.')
  const base = String(name).replace(/\.[^.]*$/, '').replace(/[^\w-]+/g, '-').slice(0, 60) || 'image'
  const asset = await sanityWriteClient().assets.upload('image', buffer, {
    filename: `${base}.${EXTENSIONS[contentType]}`,
    contentType,
  })
  return {
    assetId: asset._id,
    url: asset.url,
    width: asset.metadata?.dimensions?.width || null,
    height: asset.metadata?.dimensions?.height || null,
  }
}

// Only URLs served from this project's own Sanity image CDN are accepted as
// stored image links, so a record can never point visitors at another host.
export function isSanityImageUrl(value) {
  try {
    const url = new URL(String(value || ''))
    const { projectId } = sanityConfig()
    return url.protocol === 'https:' && url.hostname === 'cdn.sanity.io' && url.pathname.startsWith(`/images/${projectId}/`)
  } catch {
    return false
  }
}

function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  }
  const lower = address.toLowerCase()
  return lower === '::' || lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')
    || lower.startsWith('::ffff:') && isPrivateAddress(lower.slice(7))
}

async function assertPublicHost(url) {
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Only public https:// links can be fetched.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (!addresses.length || addresses.some(entry => isPrivateAddress(entry.address))) {
    throw new Error('That link points to a private address and cannot be fetched.')
  }
}

// Fetch a public URL with every redirect hop checked, a timeout, and a size cap,
// so a pasted link cannot be used to reach internal services.
export async function fetchPublic(input, { maxBytes = 2 * 1024 * 1024, accept = '*/*', timeoutMs = 10000 } = {}) {
  let url = new URL(input)
  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublicHost(url)
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: accept,
        'User-Agent': 'Mozilla/5.0 (compatible; BinaryMindsPreview/1.0; +https://binaryminds.in)',
      },
    })
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      url = new URL(response.headers.get('location'), url)
      continue
    }
    if (!response.ok) throw new Error(`The site answered ${response.status}.`)
    if (Number(response.headers.get('content-length') || 0) > maxBytes) throw new Error('That page is too large to preview.')
    const buffer = await readCapped(response, maxBytes)
    return { buffer, finalUrl: url.toString(), contentType: response.headers.get('content-type') || '' }
  }
  throw new Error('That link redirects too many times.')
}

// Read the body a chunk at a time and stop at the cap, so a server that omits
// (or lies about) content-length cannot stream an unbounded amount into memory.
async function readCapped(response, maxBytes) {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > maxBytes) throw new Error('That page is too large to preview.')
    return buffer
  }
  const chunks = []
  let total = 0
  for await (const chunk of response.body) {
    total += chunk.length
    if (total > maxBytes) {
      await response.body.cancel?.().catch(() => {})
      throw new Error('That page is too large to preview.')
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
