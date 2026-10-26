import { json, recordAudit, requireSameOrigin, requireSession, setSecurityHeaders } from '../../server/security.js'
import { MAX_IMAGE_BYTES, fetchPublic, uploadImage } from '../../server/sanity.js'

// Turns an article link (Medium, Substack, or any page with Open Graph tags)
// into preview fields for a Mind, and copies its cover image into Sanity so the
// site only ever serves images from its own CDN.
//
// Medium blocks scrapers, so Medium links are read from the author's public RSS
// feed instead; that feed only lists their most recent posts.

function decodeEntities(text) {
  return String(text || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function plainText(html, limit) {
  const text = decodeEntities(String(html || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit - 1).replace(/\s+\S*$/, '')}…` : text
}

export function metaTags(html) {
  const tags = {}
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = {}
    for (const [, name, , quoted, bare] of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      attrs[name.toLowerCase()] = quoted ?? bare ?? ''
    }
    const key = (attrs.property || attrs.name || '').toLowerCase()
    if (key && attrs.content && !(key in tags)) tags[key] = decodeEntities(attrs.content)
  }
  return tags
}

function isoDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 19)
}

async function previewFromPage(url) {
  const { buffer, finalUrl } = await fetchPublic(url, { accept: 'text/html,application/xhtml+xml' })
  const html = buffer.toString('utf8')
  const meta = metaTags(html)
  const title = meta['og:title'] || meta['twitter:title'] || decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim()
  return {
    articleUrl: meta['og:url'] || finalUrl,
    title: title.replace(/\s*\|\s*(Substack|Medium)\s*$/i, ''),
    excerpt: plainText(meta['og:description'] || meta['twitter:description'] || meta.description, 280),
    siteName: meta['og:site_name'] || new URL(finalUrl).hostname.replace(/^www\./, ''),
    authorName: meta.author || meta['article:author'] || meta['twitter:creator'] || '',
    publishedAt: isoDate(meta['article:published_time'] || meta['og:published_time'] || ''),
    imageUrl: meta['og:image'] || meta['twitter:image'] ? new URL(meta['og:image'] || meta['twitter:image'], finalUrl).toString() : '',
  }
}

export function mediumFeedFor(url) {
  const segments = url.pathname.split('/').filter(Boolean)
  if (url.hostname === 'medium.com' && segments[0]) return `https://medium.com/feed/${segments[0]}`
  const sub = url.hostname.match(/^([\w-]+)\.medium\.com$/)?.[1]
  return sub && sub !== 'www' ? `https://medium.com/feed/@${sub}` : ''
}

async function previewFromMedium(url) {
  const postId = url.pathname.match(/-([0-9a-f]{8,16})\/?$/i)?.[1] || url.pathname.match(/^\/p\/([0-9a-f]{8,16})/i)?.[1]
  const feedUrl = mediumFeedFor(url)
  if (!postId || !feedUrl) throw new Error('Paste the full Medium post link (it ends with the post ID).')
  const { buffer } = await fetchPublic(feedUrl, { accept: 'application/rss+xml,application/xml,text/xml' })
  const xml = buffer.toString('utf8')
  const item = (xml.match(/<item>[\s\S]*?<\/item>/g) || []).find(entry => entry.includes(postId))
  if (!item) throw new Error('This Medium post is not in the author’s recent feed. Fill in the fields by hand.')
  const field = name => item.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${name}>`))?.[1] || ''
  const content = field('content:encoded')
  const image = [...content.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1]).find(src => !src.includes('/_/stat')) || ''
  return {
    articleUrl: `${url.origin}${url.pathname}`,
    title: decodeEntities(field('title')).trim(),
    excerpt: plainText(content, 280),
    siteName: 'Medium',
    authorName: decodeEntities(field('dc:creator')).trim(),
    publishedAt: isoDate(field('pubDate')),
    imageUrl: image,
  }
}

export default async function handler(req, res) {
  setSecurityHeaders(res)
  const actor = await requireSession(req, res, ['super_admin', 'event_organizer', 'content_editor'])
  if (!actor) return
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }
  if (!requireSameOrigin(req, res)) return

  let url
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    url = new URL(String(body?.url || '').trim())
    if (url.protocol !== 'https:') throw new Error()
  } catch {
    return json(res, 400, { error: 'Paste a full https:// article link.' })
  }

  try {
    const isMedium = url.hostname === 'medium.com' || url.hostname.endsWith('.medium.com')
    const preview = isMedium ? await previewFromMedium(url) : await previewFromPage(url.toString())

    let image = null
    let note = ''
    if (preview.imageUrl) {
      try {
        const { buffer } = await fetchPublic(preview.imageUrl, { maxBytes: MAX_IMAGE_BYTES, accept: 'image/*' })
        image = await uploadImage(buffer, preview.title || 'cover')
        await recordAudit({ actor: actor.username, role: actor.role, action: 'media.image.imported', contentType: 'sanity.imageAsset', documentId: image.assetId })
      } catch {
        note = 'The cover image could not be copied. Upload one by hand.'
      }
    } else {
      note = 'The article has no cover image. Upload one by hand.'
    }

    const { imageUrl, ...fields } = preview
    return json(res, 200, { preview: { ...fields, image }, note })
  } catch (error) {
    return json(res, 422, { error: error.message || 'That link could not be previewed.' })
  }
}
