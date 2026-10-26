import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

export const client = createClient({
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID || 'pirhl038',
  dataset: import.meta.env.VITE_SANITY_DATASET || 'production',
  useCdn: false,
  apiVersion: '2023-05-03',
})

// Setup image builder for portable text images
const builder = imageUrlBuilder(client)
export function urlFor(source) {
  return builder.image(source)
}

// Minds are read through this site's own API rather than straight from
// Sanity, so the browser needs no CORS access and the server's project
// setting is the single source of truth.
async function publicContent(params) {
  const response = await fetch(`/api/public/content?${new URLSearchParams(params)}`)
  const result = await response.json().catch(() => ({}))
  if (response.status === 404 && params.slug) return null
  if (!response.ok) throw new Error(result.error || 'Content is temporarily unavailable.')
  return result
}

export async function fetchMinds() {
  return (await publicContent({ type: 'mind' }))?.documents || []
}

export async function fetchMind(slug) {
  return (await publicContent({ type: 'mind', slug }))?.document || null
}
