import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import JoinDrawer from '../components/JoinDrawer'
import JoiningSteps from '../components/JoiningSteps'
import ProjectCover from '../components/ProjectCover'
import {
  buildingLabel, categoryOf, coverTint, fetchProjects, formatDate, initials, projectImageSource, safeExternalUrl,
} from '../lib/buildInPublic'
import './BuildInPublic.css'
import './BuildInPublicHome.css'

function BackLink() {
  return (
    <Link className="bp-back cursor-target" to="/build-in-public">
      <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 5l-5 5 5 5" /></svg>
      All projects
    </Link>
  )
}

export default function BuildInPublicProject() {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  // ?join=1 opens the request drawer straight away (used by the landing page).
  const [joinOpen, setJoinOpen] = useState(() => searchParams.get('join') === '1')
  const [current, setCurrent] = useState('needs')
  const reduceMotion = useReducedMotion()

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

  const sections = project ? [
    { id: 'needs', label: 'What it needs', show: Boolean(project.guidelines) },
    { id: 'skills', label: 'Skills', show: project.tags?.length > 0 },
    { id: 'joining', label: 'How joining works', show: true },
  ].filter(section => section.show) : []

  // Highlight the section being read in the "On this page" index.
  useEffect(() => {
    if (!project) return undefined
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setCurrent(visible[0].target.id)
    }, { rootMargin: '-20% 0px -60% 0px' })
    for (const id of ['needs', 'skills', 'joining']) {
      const element = window.document.getElementById(id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [project])

  if (loading) {
    return (
      <PageTransition className="bp bp-detail">
        <div className="bp-wrap"><div className="bp-hero bp-hero-loading" aria-busy="true" aria-label="Loading project" /></div>
      </PageTransition>
    )
  }

  if (error || !project) {
    return (
      <PageTransition className="bp bp-detail">
        <div className="bp-wrap">
          <BackLink />
          <p className="bp-error" role="alert">{error || 'Project not found.'}</p>
        </div>
      </PageTransition>
    )
  }

  const avatar = projectImageSource(project.authorAvatarUrl, 120)
  const repository = safeExternalUrl(project.repositoryUrl)
  const track = categoryOf(project)

  function goTo(id) {
    window.document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <PageTransition className="bp bp-detail">
      <div className="bp-wrap">
        <BackLink />

        <section className="bp-hero bp-detail-hero" style={{ '--tint': coverTint(project) }}>
          {project.cover?.lqip && <span className="bp-wash" style={{ backgroundImage: `url(${project.cover.lqip})` }} aria-hidden="true" />}
          <div className="bp-hero-text">
            <p className="bp-tag">{[track, project.difficulty].filter(Boolean).join(' · ') || 'Project'}</p>
            <h1 className="bp-hero-title">{project.title}</h1>
            {project.summary && <p className="bp-hero-summary">{project.summary}</p>}
            <div className="bp-hero-actions">
              <button type="button" className="bp-btn bp-btn-light bp-btn-lg cursor-target" onClick={() => setJoinOpen(true)}>Request to join</button>
              {repository && (
                <a className="bp-btn bp-btn-glass bp-btn-lg cursor-target" href={repository} target="_blank" rel="noopener noreferrer">View repository</a>
              )}
            </div>
            <div className="bp-owner">
              <span className="bp-avatar">{avatar ? <img src={avatar} alt="" /> : initials(project.authorName || 'Binary Minds')}</span>
              <span>
                <strong>{project.authorName || 'Binary Minds'}</strong>
                <small>{[project.authorRole, buildingLabel(project.contributors)].filter(Boolean).join(' · ')}</small>
              </span>
            </div>
          </div>
          <div className="bp-hero-media"><ProjectCover project={project} width={1600} /></div>
        </section>

        <div className="bp-detail-body">
          <article className="bp-detail-main">
            {project.guidelines && (
              <section id="needs" className="bp-block" aria-labelledby="needs-title">
                <h2 id="needs-title">What it needs</h2>
                <p className="bp-prose">{project.guidelines}</p>
              </section>
            )}
            {project.tags?.length > 0 && (
              <section id="skills" className="bp-block" aria-labelledby="skills-title">
                <h2 id="skills-title">Skills</h2>
                <ul className="bp-tags">{project.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>
              </section>
            )}
            <div id="joining" className="bp-block"><JoiningSteps /></div>
          </article>

          <aside className="bp-detail-side" aria-label="About this project">
            <div className="bp-side-sticky">
              <button type="button" className="bp-btn bp-btn-light bp-side-join cursor-target" onClick={() => setJoinOpen(true)}>Request to join</button>

              <dl className="bp-facts-list">
                <div><dt>Track</dt><dd>{track}</dd></div>
                <div><dt>Level</dt><dd>{project.difficulty || 'Any'}</dd></div>
                {project.createdAt && <div><dt>Opened</dt><dd>{formatDate(project.createdAt)}</dd></div>}
                <div><dt>Contributors</dt><dd>{buildingLabel(project.contributors)}</dd></div>
              </dl>

              {sections.length > 1 && (
                <nav className="bp-toc" aria-label="On this page">
                  <p>On this page</p>
                  {sections.map(section => (
                    <button key={section.id} type="button" aria-current={current === section.id ? 'true' : undefined} onClick={() => goTo(section.id)}>
                      {section.label}
                    </button>
                  ))}
                </nav>
              )}
            </div>
          </aside>
        </div>
      </div>

      {joinOpen && project && <JoinDrawer project={project} onClose={() => setJoinOpen(false)} />}
    </PageTransition>
  )
}
