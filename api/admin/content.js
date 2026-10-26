import { createClient } from '@sanity/client'
import { randomUUID } from 'node:crypto'
import { json, recordAudit, requireMethod, requireSession, requireSameOrigin, setSecurityHeaders } from '../../server/security.js'
import { sanityConfig } from '../../server/sanity.js'

const PERMISSIONS = {
  siteEvent: ['super_admin', 'event_organizer', 'read_only'],
  siteResult: ['super_admin', 'event_organizer', 'read_only'],
  siteAnnouncement: ['super_admin', 'content_editor', 'event_organizer', 'read_only'],
  mind: ['super_admin', 'content_editor', 'event_organizer', 'read_only'],
}

const EDITORS = {
  siteEvent: ['super_admin', 'event_organizer'],
  siteResult: ['super_admin', 'event_organizer'],
  siteAnnouncement: ['super_admin', 'content_editor', 'event_organizer'],
  mind: ['super_admin', 'content_editor'],
}

function canPublish(type, role) {
  return role === 'super_admin'
    || (role === 'event_organizer' && ['siteEvent', 'siteResult', 'siteAnnouncement'].includes(type))
    || (role === 'content_editor' && type === 'mind')
}

function getClient() {
  const { projectId, dataset } = sanityConfig()
  const token = process.env.SANITY_API_WRITE_TOKEN
  if (!token) throw new Error('Sanity write access is not configured')
  return createClient({ projectId, dataset, token, apiVersion: '2025-01-01', useCdn: false, perspective: 'raw' })
}

function readParam(req, name) {
  const value = req.query?.[name]
  return Array.isArray(value) ? value[0] : value
}

function parseBody(req) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Body must be a JSON object')
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 200_000) throw new Error('Content is larger than the allowed size')
  return body
}

export default async function handler(req, res) {
  setSecurityHeaders(res)
  const type = readParam(req, 'type')
  if (!Object.hasOwn(PERMISSIONS, type)) return json(res, 400, { error: 'Unsupported content type' })
  const user = await requireSession(req, res, PERMISSIONS[type])
  if (!user) return

  try {
    const client = getClient()
    if (req.method === 'GET') {
      const docs = await client.fetch('*[_type == $type] | order(_updatedAt desc)[0...200]', { type })
      return json(res, 200, { documents: docs, sanity: sanityConfig() })
    }
    if (!EDITORS[type].includes(user.role)) return json(res, 403, { error: 'Access denied' })
    if (!requireSameOrigin(req, res)) return

    if (req.method === 'POST') {
      const body = parseBody(req)
      if (body._type !== type) return json(res, 400, { error: 'Document type does not match the collection' })
      if (body.publicationStatus === 'published' && !canPublish(type, user.role)) return json(res, 403, { error: 'Your role cannot publish this content' })
      if (body._id && !/^[A-Za-z0-9_.-]{1,128}$/.test(body._id)) return json(res, 400, { error: 'Invalid document ID' })
      body._id ||= randomUUID()
      delete body._rev
      delete body._createdAt
      delete body._updatedAt
      await recordAudit({ actor: user.username, role: user.role, action: 'content.create_requested', contentType: type, documentId: body._id })
      const created = await client.create(body)
      return json(res, 201, { document: created })
    }
    if (req.method === 'PUT') {
      const id = readParam(req, 'id')
      if (!id || !/^[A-Za-z0-9_.-]{1,128}$/.test(id)) return json(res, 400, { error: 'Invalid document ID' })
      const existing = await client.fetch('*[_id == $id][0]{_type}', { id })
      if (!existing || existing._type !== type) return json(res, 404, { error: 'Document not found in this collection' })
      const body = parseBody(req)
      if (body._type !== type || (body._id && body._id !== id)) return json(res, 400, { error: 'Document identity does not match the request' })
      if (body.publicationStatus === 'published' && !canPublish(type, user.role)) return json(res, 403, { error: 'Your role cannot publish this content' })
      delete body._rev
      delete body._createdAt
      delete body._updatedAt
      delete body._id
      await recordAudit({ actor: user.username, role: user.role, action: 'content.update_requested', contentType: type, documentId: id })
      const updated = await client.patch(id).set(body).commit()
      return json(res, 200, { document: updated })
    }
    if (req.method === 'DELETE') {
      if (user.role !== 'super_admin') return json(res, 403, { error: 'Only a Super Admin can delete content' })
      const id = readParam(req, 'id')
      if (!id || !/^[A-Za-z0-9_.-]{1,128}$/.test(id)) return json(res, 400, { error: 'Invalid document ID' })
      const existing = await client.fetch('*[_id == $id][0]{_type}', { id })
      if (!existing || existing._type !== type) return json(res, 404, { error: 'Document not found in this collection' })
      await recordAudit({ actor: user.username, role: user.role, action: 'content.delete_requested', contentType: type, documentId: id })
      await client.delete(id)
      return json(res, 200, { ok: true })
    }
    res.setHeader('Allow', 'GET, POST, PUT, DELETE')
    return json(res, 405, { error: 'Method not allowed' })
  } catch (error) {
    const message = error?.message === 'Sanity write access is not configured'
      ? 'Sanity write access is not configured. Add SANITY_API_WRITE_TOKEN in Vercel to manage these documents.'
      : [401, 403].includes(error?.statusCode)
        ? 'Sanity rejected the server token. Check SANITY_API_WRITE_TOKEN permissions and project access.'
        : 'Sanity content request failed. Check the server logs for the exact document or connection error.'
    return json(res, 503, { error: message })
  }
}
