import { useState } from 'react'
import { driveImageSource, initials, projectImageSource } from '../lib/buildInPublic'

// A project's cover, mounted the way NextWork frames its screenshots: the
// image's own blurred colours fill the field behind, with the cover itself
// floating on top. Projects without a cover get a calm colour field instead of
// generated artwork, so nothing on the page is invented.
export default function ProjectCover({ project, width = 900 }) {
  const src = projectImageSource(project.imageUrl, width) || driveImageSource(project.imageDriveUrl)
  const lqip = project.cover?.lqip
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className="bp-cover bp-cover-blank" aria-hidden="true">
        <span>{initials(project.title)}</span>
      </div>
    )
  }

  return (
    <div className="bp-cover">
      {lqip && <span className="bp-cover-wash" style={{ backgroundImage: `url(${lqip})` }} aria-hidden="true" />}
      <img className="bp-cover-img" src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
    </div>
  )
}
