import { json, recordAudit, requireSameOrigin, requireSession, setSecurityHeaders } from '../../server/security.js'
import { MAX_IMAGE_BYTES, uploadImage } from '../../server/sanity.js'

// Uploads one image to the Sanity asset store and returns its CDN URL. The
// browser resizes images before sending them, so they stay well under the cap.
export default async function handler(req, res) {
  setSecurityHeaders(res)
  const actor = await requireSession(req, res, ['super_admin', 'event_organizer', 'content_editor'])
  if (!actor) return
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }
  if (!requireSameOrigin(req, res)) return

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const data = String(body?.data || '')
    if (!data || data.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 16) {
      return json(res, 400, { error: 'Images must be 3 MB or smaller.' })
    }
    const image = await uploadImage(Buffer.from(data, 'base64'), body?.filename)
    await recordAudit({ actor: actor.username, role: actor.role, action: 'media.image.uploaded', contentType: 'sanity.imageAsset', documentId: image.assetId })
    return json(res, 201, { image })
  } catch (error) {
    const known = /^(Images must|Upload a|The image is empty)/.test(error.message)
    if (known) return json(res, 400, { error: error.message })
    if (error.message === 'Sanity write access is not configured') {
      return json(res, 503, { error: 'Sanity write access is not configured. Add SANITY_API_WRITE_TOKEN.' })
    }
    return json(res, 502, { error: 'Sanity could not store the image. Try again.' })
  }
}
