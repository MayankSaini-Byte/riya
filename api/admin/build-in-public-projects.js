import { createProjectId, getBuildInPublicProjects, PROJECTS_KEY } from '../../server/build-in-public-projects.js'
import { json, recordAudit, requireSameOrigin, requireSession, setSecurityHeaders, writeStoredJson } from '../../server/security.js'

const STATUSES = new Set(['draft', 'published', 'archived'])
const DIFFICULTIES = new Set(['Beginner', 'Intermediate', 'Advanced'])

function bodyOf(req) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {}
}

function cleanText(value, limit) {
  return String(value || '').trim().slice(0, limit)
}

function safeHttpsUrl(value, label) {
  const input = cleanText(value, 600)
  if (!input) return ''
  let parsed
  try { parsed = new URL(input) } catch { throw new Error(`Enter a valid HTTPS ${label} URL.`) }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error(`Enter a valid HTTPS ${label} URL.`)
  return parsed.toString()
}

function driveImageUrl(value) {
  const url = safeHttpsUrl(value, 'Google Drive image')
  if (!url) return ''
  const parsed = new URL(url)
  const id = parsed.hostname === 'drive.google.com'
    ? parsed.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1] || parsed.searchParams.get('id')
    : null
  if (!id || !/^[\w-]{10,}$/.test(id)) throw new Error('Use a share link for an image stored in Google Drive.')
  return `https://drive.google.com/file/d/${id}/view`
}

function projectFields(body) {
  const title = cleanText(body.title, 140)
  const summary = cleanText(body.summary, 1200)
  const guidelines = cleanText(body.guidelines, 1200)
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map(tag => cleanText(tag, 32)).filter(Boolean))].slice(0, 12)
    : String(body.tags || '').split(',').map(tag => cleanText(tag, 32)).filter(Boolean).slice(0, 12)
  const status = String(body.status || 'draft')
  if (title.length < 3 || summary.length < 20 || guidelines.length < 10) {
    throw new Error('Add a title, a summary of at least 20 characters, and contribution guidelines of at least 10 characters.')
  }
  if (!STATUSES.has(status)) throw new Error('Choose draft, published, or archived for the project status.')
  const category = cleanText(body.category, 40)
  const difficulty = cleanText(body.difficulty, 20)
  if (difficulty && !DIFFICULTIES.has(difficulty)) throw new Error('Choose Beginner, Intermediate, or Advanced for difficulty.')
  const authorName = cleanText(body.authorName, 80)
  const authorRole = cleanText(body.authorRole, 80)
  const repositoryUrl = safeHttpsUrl(body.repositoryUrl, 'repository')
  const imageDriveUrl = driveImageUrl(body.imageDriveUrl)
  const authorAvatarUrl = driveImageUrl(body.authorAvatarUrl)
  return { title, summary, guidelines, tags, category, difficulty, authorName, authorRole, repositoryUrl, imageDriveUrl, authorAvatarUrl, status }
}

export default async function handler(req, res) {
  setSecurityHeaders(res)
  const actor = await requireSession(req, res, ['super_admin'])
  if (!actor) return
  try {
    if (req.method === 'GET') return json(res, 200, { projects: await getBuildInPublicProjects() })
    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PUT, DELETE')
      return json(res, 405, { error: 'Method not allowed' })
    }
    if (!requireSameOrigin(req, res)) return

    const projects = await getBuildInPublicProjects()
    const body = bodyOf(req)
    if (req.method === 'POST') {
      const fields = projectFields(body)
      const project = { id: createProjectId(), ...fields, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      projects.unshift(project)
      await writeStoredJson(PROJECTS_KEY, projects)
      await recordAudit({ actor: actor.username, role: actor.role, action: 'build_in_public.project.created', contentType: 'buildInPublicProject', documentId: project.id })
      return json(res, 201, { project, projects })
    }

    const id = cleanText(body.id, 64)
    const index = projects.findIndex(project => project.id === id)
    if (index < 0) return json(res, 404, { error: 'Project not found.' })
    if (req.method === 'PUT') {
      const fields = projectFields(body)
      projects[index] = { ...projects[index], ...fields, updatedAt: new Date().toISOString() }
      await writeStoredJson(PROJECTS_KEY, projects)
      await recordAudit({ actor: actor.username, role: actor.role, action: 'build_in_public.project.updated', contentType: 'buildInPublicProject', documentId: id })
      return json(res, 200, { project: projects[index], projects })
    }

    const [removed] = projects.splice(index, 1)
    await writeStoredJson(PROJECTS_KEY, projects)
    await recordAudit({ actor: actor.username, role: actor.role, action: 'build_in_public.project.deleted', contentType: 'buildInPublicProject', documentId: id })
    return json(res, 200, { project: removed, projects })
  } catch (error) {
    if (error.message.startsWith('Add a title') || error.message.startsWith('Choose draft') || error.message.startsWith('Enter a valid HTTPS') || error.message.startsWith('Use a share link')) {
      return json(res, 400, { error: error.message })
    }
    return json(res, 503, { error: 'Build in Public projects are temporarily unavailable.' })
  }
}
