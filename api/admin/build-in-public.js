import { deleteBuildInPublicAttachment, json, readStoredJson, recordAudit, requireSameOrigin, requireSession, setSecurityHeaders, writeStoredJson } from '../../server/security.js'
import { sendAcceptanceEmail } from '../../server/email.js'

const KEY = 'bm-bip:submissions:v1'
const STATUSES = new Set(['pending', 'accepted', 'rejected'])

export default async function handler(req, res) {
  setSecurityHeaders(res)
  const actor = await requireSession(req, res, ['super_admin'])
  if (!actor) return
  try {
    const submissions = await readStoredJson(KEY, [])
    if (!Array.isArray(submissions)) throw new Error('Submission storage is invalid')
    if (req.method === 'GET') return json(res, 200, { submissions })
    if (!['PATCH', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'GET, PATCH, DELETE')
      return json(res, 405, { error: 'Method not allowed' })
    }
    if (!requireSameOrigin(req, res)) return
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
    const id = String(body.id || '')
    const status = String(body.status || '')
    const index = submissions.findIndex(item => item.id === id)
    if (index < 0) return json(res, 404, { error: 'Submission not found.' })
    if (req.method === 'DELETE') {
      const [removed] = submissions.splice(index, 1)
      if (removed.attachment) await deleteBuildInPublicAttachment(removed.attachment)
      await writeStoredJson(KEY, submissions)
      await recordAudit({ actor: actor.username, role: actor.role, action: 'build_in_public.application.deleted', contentType: 'contributionApplication', documentId: id })
      return json(res, 200, { ok: true })
    }
    if (!STATUSES.has(status)) return json(res, 400, { error: 'Choose pending, accepted, or rejected.' })
    const previous = submissions[index]
    submissions[index] = { ...previous, status, reviewedBy: actor.username, reviewedAt: new Date().toISOString() }
    await writeStoredJson(KEY, submissions)
    await recordAudit({ actor: actor.username, role: actor.role, action: `build_in_public.application.${status}`, contentType: 'contributionApplication', documentId: id })
    let notification
    if (status === 'accepted') {
      if (previous.emailNotificationStatus === 'sent') {
        notification = { sent: true, alreadySent: true }
      } else {
        try {
          await sendAcceptanceEmail(submissions[index])
          submissions[index] = {
            ...submissions[index],
            emailNotificationStatus: 'sent',
            emailNotificationSentAt: new Date().toISOString(),
            emailNotificationError: undefined,
          }
          notification = { sent: true }
        } catch (error) {
          submissions[index] = {
            ...submissions[index],
            emailNotificationStatus: 'failed',
            emailNotificationAttemptedAt: new Date().toISOString(),
            emailNotificationError: error.message,
          }
          notification = { sent: false, message: error.message }
        }
        await writeStoredJson(KEY, submissions)
        await recordAudit({
          actor: actor.username,
          role: actor.role,
          action: `build_in_public.application.acceptance_email_${notification.sent ? 'sent' : 'failed'}`,
          contentType: 'contributionApplication',
          documentId: id,
        })
      }
    }
    return json(res, 200, { submission: submissions[index], notification })
  } catch {
    return json(res, 503, { error: 'Build in Public review is temporarily unavailable.' })
  }
}
