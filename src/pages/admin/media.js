// Image helpers for the admin: shrink images in the browser before upload, and
// turn a stored Sanity image (or a plain URL) into something an <img> can show.

// The public site's project. Previews follow the server's project once the
// portal learns it, so an image always resolves where it was really stored.
export const SITE_SANITY = {
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID || 'pirhl038',
  dataset: import.meta.env.VITE_SANITY_DATASET || 'production',
}
let target = { ...SITE_SANITY }

export function setSanityTarget(config) {
  if (config?.projectId && config?.dataset) target = { projectId: config.projectId, dataset: config.dataset }
}

const MAX_EDGE = 1600
const KEEP_AS_IS_BYTES = 700 * 1024
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.readAsDataURL(blob)
  })
}

// Small JPEG/PNG/WebP files go up untouched. Anything larger is scaled down to
// 1600px on its longest edge and re-encoded as WebP. GIFs are sent as-is so
// they keep their animation.
export async function prepareImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose an image file.')
  const name = file.name || 'image'
  if (file.type === 'image/gif') {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('GIFs must be 3 MB or smaller.')
    return { filename: name, data: await blobToBase64(file) }
  }

  let bitmap
  try { bitmap = await createImageBitmap(file) }
  catch { throw new Error('This image format is not supported here. Use JPEG, PNG or WebP.') }

  const longest = Math.max(bitmap.width, bitmap.height)
  const simple = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  if (simple && longest <= MAX_EDGE && file.size <= KEEP_AS_IS_BYTES) {
    bitmap.close?.()
    return { filename: name, data: await blobToBase64(file) }
  }

  const scale = Math.min(1, MAX_EDGE / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.86))
  if (!blob) throw new Error('The image could not be prepared.')
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('That image is still too large after resizing.')
  return { filename: name.replace(/\.[^.]*$/, '') + '.webp', data: await blobToBase64(blob) }
}

// Sanity stores an image as a reference like "image-<hash>-1600x900-webp";
// the CDN serves it at a predictable URL, so previews need no extra request.
export function imageUrl(value, width = 800) {
  if (!value) return ''
  if (typeof value === 'string') {
    if (value.startsWith('https://cdn.sanity.io/')) return `${value}${value.includes('?') ? '&' : '?'}w=${width}&auto=format&fit=max`
    return value.startsWith('/') || value.startsWith('https://') ? value : ''
  }
  const ref = value.asset?._ref || value.asset?._id || ''
  const match = ref.match(/^image-([a-f\d]+)-(\d+x\d+)-(\w+)$/i)
  if (!match) return value.asset?.url || ''
  return `https://cdn.sanity.io/images/${target.projectId}/${target.dataset}/${match[1]}-${match[2]}.${match[3]}?w=${width}&auto=format&fit=max`
}
