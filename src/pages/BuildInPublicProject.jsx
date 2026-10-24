import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageTransition from '../components/PageTransition'
import JoinDrawer from '../components/JoinDrawer'
import {
  categoryOf, driveImageSource, fetchProjects, formatDate, initials, safeExternalUrl,
} from '../lib/buildInPublic'
import './BuildInPublic.css'

export default function BuildInPublicProject() {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joinOpen, setJoinOpen] = useState(false)

  useEffect(() => {
    let active = true
    fetchProjects()
      .then(list => {
        if (!active) return
        const found = list.find(item => item.id === projectId)
        if (found) setProject(found)
        else setError('This project is not open for contributions, or its link has changed.')
      })
      .catch(reason => { if (active) setError(reason.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [projectId])

  if (loading) {
    return (
      <PageTransition className="bip bip-detail">
        <>
          <div className="bip-skeleton bip-skeleton-tall" aria-label="Loading project" />
        </>
      </PageTransition>
    )
  }

  if (error || !project) {
    return (
      <PageTransition className="bip bip-detail">
        <>
          <Link className="bip-back" to="/build-in-public">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            All projects
          </Link>
          <p className="bip-state bip-state-error" role="alert">{error || 'Project not found.'}</p>
        </>
      </PageTransition>
    )
  }

  const cover = driveImageSource(project.imageDriveUrl)
  const avatar = driveImageSource(project.authorAvatarUrl)
  const repository = safeExternalUrl(project.repositoryUrl)
  const track = categoryOf(project)

  return (
    <PageTransition className="bip bip-detail">
      <>
        <Link className="bip-back" to="/build-in-public">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          All projects
        </Link>

        <header className="bip-detail-head">
          <div className="bip-detail-intro">
            <div className="bip-detail-byline">
              <span className="bm-avatar" aria-hidden="true">
                {avatar ? <img src={avatar} alt="" /> : initials(project.authorName)}
              </span>
              <span>
                <strong>{project.authorName || 'Binary Minds'}</strong>
                {project.authorRole && <small>{project.authorRole}</small>}
              </span>
            </div>
            <h1>{project.title}</h1>
            <p className="bip-detail-lede">{project.summary}</p>
            <div className="bip-detail-actions">
              <button type="button" className="bm-btn bm-btn-primary" onClick={() => setJoinOpen(true)}>
                Join this project
              </button>
              {repository && (
                <a className="bm-btn bm-btn-ghost" href={repository} target="_blank" rel="noopener noreferrer">
                  View repository
                </a>
              )}
            </div>
          </div>

          <div className="bip-detail-cover" aria-hidden="true">
            {cover
              ? <img src={cover} alt="" />
              : <span className="bip-card-mark">{initials(project.title)}</span>}
          </div>
        </header>

        <dl className="bip-meta">
          <div>
            <dt>Difficulty</dt>
            <dd>
              {project.difficulty
                ? <span className={`bm-level bm-level-${project.difficulty.toLowerCase()}`}>{project.difficulty}</span>
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Track</dt>
            <dd>{track}</dd>
          </div>
          <div>
            <dt>Opened</dt>
            <dd>{formatDate(project.createdAt)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd className="bip-meta-open">Open for contributors</dd>
          </div>
        </dl>

        <div className="bip-detail-body">
          <article>
            <h2>About this project</h2>
            <p>{project.summary}</p>

            <h2>What this project needs</h2>
            <p className="bip-prewrap">{project.guidelines}</p>
          </article>

          <aside className="bip-detail-side">
            {project.tags?.length > 0 && (
              <section>
                <h2>Skills we are looking for</h2>
                <div className="bm-tags">
                  {project.tags.map(tag => <span key={tag}>{tag}</span>)}
                </div>
              </section>
            )}
            <section className="bip-detail-cta">
              <h2>Ready to build?</h2>
              <p>Send a short request. A maintainer replies to the student email you give.</p>
              <button type="button" className="bm-btn bm-btn-primary" onClick={() => setJoinOpen(true)}>
                Join this project
              </button>
            </section>
          </aside>
        </div>
      </>

      {joinOpen && <JoinDrawer project={project} onClose={() => setJoinOpen(false)} />}
    </PageTransition>
  )
}
