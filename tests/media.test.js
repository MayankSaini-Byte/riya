import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchPublic, isSanityImageUrl, sniffImageType } from '../server/sanity.js'
import { mediumFeedFor, metaTags } from '../api/admin/link-preview.js'

test('images are identified by their bytes, not their name', () => {
  assert.equal(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), 'image/png')
  assert.equal(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg')
  assert.equal(sniffImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'binary')), 'image/webp')
  assert.equal(sniffImageType(Buffer.from('<svg onload=alert(1)>', 'utf8')), null)
  assert.equal(sniffImageType(Buffer.from('hello world, not an image', 'utf8')), null)
})

test('only this project’s Sanity CDN counts as a stored image URL', () => {
  assert.equal(isSanityImageUrl('https://cdn.sanity.io/images/pirhl038/production/abc123-800x600.webp'), true)
  assert.equal(isSanityImageUrl('https://cdn.sanity.io/images/otherproj/production/abc123-800x600.webp'), false)
  assert.equal(isSanityImageUrl('https://cdn.sanity.io/images/94wv2qdl/production/abc123-800x600.webp'), false)
  assert.equal(isSanityImageUrl('http://cdn.sanity.io/images/pirhl038/production/abc123-800x600.webp'), false)
  assert.equal(isSanityImageUrl('https://cdn.sanity.io.evil.example/images/pirhl038/x.png'), false)
  assert.equal(isSanityImageUrl('https://drive.google.com/file/d/abc/view'), false)
  assert.equal(isSanityImageUrl(''), false)
})

test('article previews never fetch private or non-https addresses', async () => {
  for (const url of ['https://127.0.0.1/', 'https://10.0.0.5/admin', 'https://192.168.1.1/', 'https://169.254.169.254/latest/meta-data', 'https://[::1]/']) {
    await assert.rejects(fetchPublic(url), /private address/, url)
  }
  await assert.rejects(fetchPublic('http://example.com/'), /https/)
})

test('Open Graph tags are read in any attribute order with entities decoded', () => {
  const tags = metaTags(`
    <meta property="og:title" content="Agents &amp; Tools">
    <meta content="https://img.example/a.png" property="og:image" />
    <meta name='author' content='Riya S.'>
    <meta property="og:title" content="ignored duplicate">
  `)
  assert.equal(tags['og:title'], 'Agents & Tools')
  assert.equal(tags['og:image'], 'https://img.example/a.png')
  assert.equal(tags.author, 'Riya S.')
})

test('Medium links map to the right public RSS feed', () => {
  assert.equal(mediumFeedFor(new URL('https://medium.com/@riya/my-post-1a2b3c4d5e6f')), 'https://medium.com/feed/@riya')
  assert.equal(mediumFeedFor(new URL('https://riya.medium.com/my-post-1a2b3c4d5e6f')), 'https://medium.com/feed/@riya')
  assert.equal(mediumFeedFor(new URL('https://medium.com/blog/updating-our-rules-62edea66ffa4')), 'https://medium.com/feed/blog')
})
