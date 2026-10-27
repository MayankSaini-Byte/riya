import { randomUUID } from 'node:crypto'
import { createClient } from '@sanity/client'
import { getBuildInPublicProjects } from '../../server/build-in-public-projects.js'
import { checkPublicSubmissionLimit, deleteBuildInPublicAttachment, json, readStoredJson, requireMethod, requireSameOrigin, setSecurityHeaders, writeStoredJson } from '../../server/security.js'
import { sanityConfig } from '../../server/sanity.js'

const KEY = 'bm-bip:submissions:v1'

// Sanity analyses every uploaded image; reuse its palette and blurred preview
// so cards can be tinted by their own cover. Covers are stored as CDN URLs.
async function coverDetails(projects) {
  const urls = [...new Set(projects.map(project => String(project.imageUrl || '').split('?')[0]).filter(url => url.startsWith('https://cdn.sanity.io/')))]
  if (!urls.length) return {}
  const client = createClient({ ...sanityConfig(), apiVersion: '2025-01-01', useCdn: true })
  const assets = await client.fetch(
    `*[_type == "sanity.imageAsset" && url in $urls]{
      url,
      "lqip": metadata.lqip,
      "dark": metadata.palette.darkMuted.background,
      "dominant": metadata.palette.dominant.background
    }`,
    { urls },
  )
  return Object.fromEntries(assets.map(asset => [asset.url, { lqip: asset.lqip || '', dark: asset.dark || '', dominant: asset.dominant || '' }]))
}
function normalizeProfile(value, platform) {
  const input = String(value || '').trim()
  const patterns = {
    github: {
      url: /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]+)\/?$/i,
      username: /^@?([A-Za-z0-9-]{1,39})$/,
      host: 'github.com',
    },
    linkedin: {
      url: /^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([A-Za-z0-9_-]+)\/?$/i,
      username: /^@?([A-Za-z0-9_-]{1,100})$/,
      host: 'linkedin.com/in',
    },
  }
  const rule = patterns[platform]
  const match = input.match(rule.url) || input.match(rule.username)
  if (!match) return null
  const username = match[1]
  if (platform === 'github' && (username.startsWith('-') || username.endsWith('-') || username.includes('--'))) return null
  return `https://${rule.host}/${username}`
}

function bodyOf(req) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {}
}

function text(value, max) {
  return String(value || '').trim().slice(0, max)
}

export default async function handler(req, res) {
  setSecurityHeaders(res)
  try {
    if (req.method === 'GET') {
      const projects = await getBuildInPublicProjects()
      // Only a count of accepted contributors per project is public; who they
      // are stays private. A storage hiccup must not hide the projects.
      const building = {}
      try {
        const submissions = await readStoredJson(KEY, [])
        for (const item of Array.isArray(submissions) ? submissions : []) {
          if (item?.status === 'accepted' && item.projectId) building[item.projectId] = (building[item.projectId] || 0) + 1
        }
      } catch { /* counts stay at zero */ }
      const published = projects.filter(project => project.status === 'published')
      let covers = {}
      try { covers = await coverDetails(published) } catch { /* cards fall back to a neutral tint */ }
      return json(res, 200, {
        projects: published.map(project => ({
          ...project,
          contributors: building[project.id] || 0,
          cover: covers[String(project.imageUrl || '').split('?')[0]] || null,
        })),
      })
    }
    if (!requireMethod(req, res, 'POST') || !requireSameOrigin(req, res)) return
    const body = bodyOf(req)
    if (body.website) return json(res, 200, { ok: true })
    if (!(await checkPublicSubmissionLimit(req))) return json(res, 429, { error: 'Too many applications. Please try again later.' })

    const fullName = text(body.fullName, 100)
    const studentEmail = text(body.studentEmail, 160).toLowerCase()
    const githubProfile = normalizeProfile(text(body.githubProfile, 300), 'github')
    const linkedinProfile = normalizeProfile(text(body.linkedinProfile, 300), 'linkedin')
    const motivation = text(body.motivation, 2000)
    const contributionIdea = text(body.contributionIdea, 2000)
    const projectId = text(body.projectId, 64)
    const project = (await getBuildInPublicProjects()).find(item => item.id === projectId && item.status === 'published')
    if (!project) return json(res, 400, { error: 'This project is no longer accepting contribution requests. Refresh the page and choose an open project.' })
    if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) {
      return json(res, 400, { error: 'Enter your full name and a valid student email.' })
    }
    if (!githubProfile) return json(res, 400, { error: 'Enter your GitHub username or a github.com profile link.' })
    if (!linkedinProfile) return json(res, 400, { error: 'Enter your LinkedIn ID or a linkedin.com/in profile link.' })
    if (motivation.length < 20 || contributionIdea.length < 20) {
      return json(res, 400, { error: 'Please provide at least 20 characters for both written responses.' })
    }

    let attachment = null
    const uploadId = text(body.uploadId, 40)
    if (uploadId) {
      if (!/^[\da-f-]{36}$/i.test(uploadId)) return json(res, 400, { error: 'The attachment upload is invalid.' })
      const uploadKey = `bm-bip:upload:${uploadId}:meta`
      const metadata = await readStoredJson(uploadKey, null)
      if (!metadata || metadata.submitted || !metadata.fileName || !metadata.totalChunks) {
        return json(res, 400, { error: 'The attachment upload expired. Please select the file again.' })
      }
      for (let index = 0; index < metadata.totalChunks; index += 1) {
        const chunkKey = `bm-bip:upload:${uploadId}:chunk:${index}`
        const chunk = await readStoredJson(chunkKey, null)
        if (!chunk) return json(res, 400, { error: 'The attachment is incomplete. Please select the file again.' })
        await writeStoredJson(chunkKey, chunk, 60 * 60 * 24 * 90)
      }
      attachment = { uploadId, fileName: metadata.fileName, mimeType: metadata.mimeType, size: metadata.size, totalChunks: metadata.totalChunks }
      await writeStoredJson(uploadKey, { ...metadata, submitted: true }, 60 * 60 * 24 * 90)
    }

    const submissions = await readStoredJson(KEY, [])
    if (!Array.isArray(submissions)) throw new Error('Application storage is invalid')
    const application = {
      id: randomUUID(), projectId: project.id, project: project.title, fullName, studentEmail, githubProfile,
      linkedinProfile, motivation, contributionIdea, attachment,
      status: 'pending', createdAt: new Date().toISOString(),
    }
    submissions.unshift(application)
    const retained = submissions.slice(0, 500)
    await writeStoredJson(KEY, retained)
    for (const expired of submissions.slice(500)) {
      if (expired.attachment) {
        try { await deleteBuildInPublicAttachment(expired.attachment) } catch { /* Its 90-day Redis TTL remains the fallback cleanup. */ }
      }
    }
    return json(res, 201, { ok: true, message: 'Your contribution request has been sent for review.' })
  } catch {
    return json(res, 503, { error: 'Contribution requests are temporarily unavailable.' })
  }
}
