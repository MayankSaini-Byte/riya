// Shared data access and formatting for the Build in Public pages.

export const CHUNK_BYTES = 512 * 1024
export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const ALLOWED_FILES = new Set(['pdf', 'doc', 'docx'])

// Rendered only by `vite dev`, where the serverless /api routes do not run,
// so the pages can be designed and reviewed with representative content.
const DEV_SAMPLE_PROJECTS = [
  {
    id: 'open-ai-agent-framework',
    title: 'Open AI Agent Framework',
    summary: 'An open-source framework for building and inspecting multi-agent workflows, with a visual debugger for how agents reason and collaborate.',
    guidelines: 'Python developers with LLM and prompt-engineering experience, plus React contributors for the visual agent debugger.',
    tags: ['Python', 'LLMs', 'React', 'Agent tooling'],
    category: 'AI & Agents',
    difficulty: 'Intermediate',
    authorName: 'Binary Minds Core',
    authorRole: 'Maintainers',
    repositoryUrl: '',
    createdAt: '2026-10-20T00:00:00.000Z',
  },
  {
    id: 'campus-schedule',
    title: 'Campus Schedule Engine',
    summary: 'A constraint solver that builds clash-free class and exam timetables for the whole house, exposed through a small web planner.',
    guidelines: 'Interest in constraint solving or graph algorithms. A good first systems project.',
    tags: ['Algorithms', 'TypeScript', 'Scheduling'],
    category: 'Systems & Tools',
    difficulty: 'Advanced',
    authorName: 'Riya S.',
    authorRole: 'Project lead',
    repositoryUrl: '',
    createdAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'minds-reader',
    title: 'Minds Reader',
    summary: 'A faster, distraction-free reader for the Binary Minds article archive, with offline saving and keyboard navigation.',
    guidelines: 'Front-end contributors comfortable with React and accessibility. Beginner friendly.',
    tags: ['React', 'Accessibility', 'PWA'],
    category: 'Web & Product',
    difficulty: 'Beginner',
    authorName: 'Aarav P.',
    authorRole: 'Contributor',
    repositoryUrl: '',
    createdAt: '2026-10-22T00:00:00.000Z',
  },
  {
    id: 'house-bot',
    title: 'House Notification Bot',
    summary: 'A service that watches events, results and deadlines and posts timely nudges to the house channels.',
    guidelines: 'Node or Python developers interested in small reliable services and webhooks.',
    tags: ['Node', 'Webhooks', 'Automation'],
    category: 'Systems & Tools',
    difficulty: 'Beginner',
    authorName: 'Binary Minds Core',
    authorRole: 'Maintainers',
    repositoryUrl: '',
    createdAt: '2026-10-10T00:00:00.000Z',
  },
]

export async function fetchProjects() {
  try {
    const response = await fetch('/api/public/build-in-public')
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Projects are temporarily unavailable.')
    const list = Array.isArray(result.projects) ? result.projects : []
    if (!list.length && import.meta.env.DEV) return DEV_SAMPLE_PROJECTS
    return list
  } catch (error) {
    if (import.meta.env.DEV) return DEV_SAMPLE_PROJECTS
    throw error
  }
}

export async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.')
  return result
}

export function fileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
}

/** Only Google Drive share links are turned into image sources, so a stored
 *  value can never point the browser at an arbitrary third-party origin. */
export function driveImageSource(shareUrl) {
  if (!shareUrl) return ''
  try {
    const url = new URL(shareUrl)
    if (url.hostname !== 'drive.google.com') return ''
    const fileId = url.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1] || url.searchParams.get('id')
    return fileId && /^[\w-]{10,}$/.test(fileId)
      ? `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`
      : ''
  } catch {
    return ''
  }
}

/** Repository links are rendered only when they are http(s), so a stored
 *  `javascript:` or `data:` value can never become a live link. */
export function safeExternalUrl(value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}

export function categoryOf(project) {
  return project?.category?.trim() || 'Other'
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'BM'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export function relativeWhen(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} wk ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatDate(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
