import { randomUUID } from 'node:crypto'
import { readStoredJson, writeStoredJson } from './security.js'

export const PROJECTS_KEY = 'bm-bip:projects:v1'

const INITIAL_PROJECT = {
  id: 'open-ai-agent-framework',
  title: 'Binary Minds Open AI Agent Framework',
  summary: 'An open-source framework for building and inspecting multi-agent AI workflows, with a visual debugger for understanding how agents reason and collaborate.',
  guidelines: 'Looking for Python developers with experience in LLMs, prompt engineering, and React frontend contributors for visual agent debuggers.',
  tags: ['AI / ML', 'Python', 'LLMs', 'React', 'Agent tooling'],
  category: 'AI & Agents',
  difficulty: 'Intermediate',
  authorName: 'Binary Minds Core',
  authorRole: 'Maintainers',
  authorAvatarUrl: '',
  repositoryUrl: '',
  imageDriveUrl: '',
  status: 'published',
  createdAt: '2026-10-24T00:00:00.000Z',
  updatedAt: '2026-10-24T00:00:00.000Z',
}

export async function getBuildInPublicProjects() {
  const projects = await readStoredJson(PROJECTS_KEY, null)
  if (projects === null) {
    await writeStoredJson(PROJECTS_KEY, [INITIAL_PROJECT])
    return [INITIAL_PROJECT]
  }
  if (!Array.isArray(projects)) throw new Error('Build in Public project storage is invalid')
  return projects
}

export function createProjectId() {
  return randomUUID()
}
