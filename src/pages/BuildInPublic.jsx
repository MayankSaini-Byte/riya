import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import JoiningSteps from '../components/JoiningSteps'
import ProjectCover from '../components/ProjectCover'
import { buildingLabel, categoryOf, coverTint, fetchProjects, initials, projectImageSource } from '../lib/buildInPublic'
import './BuildInPublicPages.css'
import './BuildInPublicHome.css'

const LEVELS = ['Beginner', 'Intermediate', 'Advanced']
const WEEK = 7 * 24 * 60 * 60 * 1000
const EASE = [0.16, 1, 0.3, 1]

export default function BuildInPublic() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [track, setTrack] = useState('All')
  const [level, setLevel] = useState('All')
  const search = useRef(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    let active = true
    fetchProjects()
      .then(list => { if (active) setProjects(list) })
      .catch(reason => { if (active) setError(reason.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  // "/" jumps to search.
  useEffect(() => {
    function onKey(event) {
      if (event.key !== '/' || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return
      event.preventDefault()
      search.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const tracks = useMemo(() => [...new Set(projects.map(categoryOf))], [projects])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...projects]
      .filter(project => track === 'All' || categoryOf(project) === track)
      .filter(project => level === 'All' || project.difficulty === level)
      .filter(project => !needle || [project.title, project.summary, project.authorName, categoryOf(project), ...(project.tags || [])]
        .join(' ').toLowerCase().includes(needle))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [projects, query, track, level])

  // Rotates once a calendar week, the same for every visitor.
  const featured = useMemo(() => {
    if (!projects.length) return null
    const ordered = [...projects].sort((a, b) => String(a.id).localeCompare(String(b.id)))
    return ordered[Math.floor(Date.now() / WEEK) % ordered.length]
  }, [projects])

  const building = projects.reduce((sum, project) => sum + (project.contributors || 0), 0)
  const filtering = track !== 'All' || level !== 'All' || query.trim()

  function clearFilters() {
    setQuery('')
    setTrack('All')
    setLevel('All')
  }

  function scrollTo(id) {
    window.document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <PageTransition className="bp">
      <div className="bp-wrap">
        <header className="bp-bar">
          <div className="bp-bar-top">
            <div className="bp-brand">
              <img src="/binary-minds-logo.jpg" alt="" />
              <div>
                <h1>Build in Public</h1>
                <p>Kaziranga House · Binary Minds</p>
              </div>
            </div>
            <div className="bp-bar-actions">
              <button type="button" className="bp-btn bp-btn-ghost cursor-target" onClick={() => scrollTo('bp-joining')}>How joining works</button>
              <button type="button" className="bp-btn bp-btn-light cursor-target" onClick={() => scrollTo('bp-projects')}>Browse projects</button>
            </div>
          </div>
          <label className="bp-search">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.75" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            <span className="bp-sr">Search projects</span>
            <input ref={search} type="search" value={query} placeholder="Search projects, tracks or tools" onChange={event => setQuery(event.target.value)} />
            {query && <button type="button" className="bp-search-clear" aria-label="Clear search" onClick={() => setQuery('')}>×</button>}
          </label>
        </header>

        {tracks.length > 0 && (
          <nav className="bp-pills" aria-label="Filter projects">
            <button type="button" aria-pressed={track === 'All' && level === 'All'} onClick={() => { setTrack('All'); setLevel('All') }}>All</button>
            {tracks.map(name => (
              <button key={name} type="button" aria-pressed={track === name} onClick={() => setTrack(track === name ? 'All' : name)}>{name}</button>
            ))}
            {LEVELS.map(name => (
              <button key={name} type="button" aria-pressed={level === name} onClick={() => setLevel(level === name ? 'All' : name)}>{name}</button>
            ))}
          </nav>
        )}

        {loading ? (
          <div className="bp-hero bp-hero-loading" aria-busy="true" aria-label="Loading projects" />
        ) : error ? (
          <p className="bp-error" role="alert">{error}</p>
        ) : featured && !filtering ? (
          <Featured project={featured} reduceMotion={reduceMotion} />
        ) : !projects.length ? (
          <section className="bp-hero bp-hero-empty">
            <p className="bp-tag">Build in Public</p>
            <h2 className="bp-hero-title">The first project opens soon.</h2>
          </section>
        ) : null}

        {projects.length > 0 && (
          <ul className="bp-stats" aria-label="At a glance">
            <li><strong>{projects.length}</strong> open {projects.length === 1 ? 'project' : 'projects'}</li>
            <li><strong>{tracks.length}</strong> {tracks.length === 1 ? 'track' : 'tracks'}</li>
            <li><strong>{building}</strong> {building === 1 ? 'person' : 'people'} building</li>
          </ul>
        )}

        {!loading && !error && projects.length > 0 && (
          <section id="bp-projects" className="bp-section" aria-labelledby="bp-projects-title">
            <div className="bp-section-head">
              <h2 id="bp-projects-title">{filtering ? 'Matching projects' : 'Open projects'}</h2>
              <span>{visible.length} of {projects.length}</span>
            </div>
            {visible.length ? (
              <ul className="bp-grid">
                {visible.map((project, index) => <ProjectCard key={project.id} project={project} index={index} reduceMotion={reduceMotion} />)}
              </ul>
            ) : (
              <div className="bp-none">
                <p>Nothing matches {query.trim() ? <>“{query.trim()}”</> : 'those filters'}.</p>
                <button type="button" className="bp-btn bp-btn-ghost cursor-target" onClick={clearFilters}>Clear filters</button>
              </div>
            )}
          </section>
        )}

        <div id="bp-joining"><JoiningSteps /></div>
      </div>
    </PageTransition>
  )
}

function Featured({ project, reduceMotion }) {
  const avatar = projectImageSource(project.authorAvatarUrl, 120)
  const rise = delay => (reduceMotion ? {} : {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: EASE },
  })

  return (
    <section className="bp-hero" style={{ '--tint': coverTint(project) }} aria-labelledby="bp-hero-title">
      {project.cover?.lqip && <span className="bp-wash" style={{ backgroundImage: `url(${project.cover.lqip})` }} aria-hidden="true" />}
      <div className="bp-hero-text">
        <motion.p className="bp-tag" {...rise(0.05)}><i aria-hidden="true" /> Project of the week</motion.p>
        <motion.h2 id="bp-hero-title" className="bp-hero-title" {...rise(0.12)}>{project.title}</motion.h2>
        {project.summary && <motion.p className="bp-hero-summary" {...rise(0.2)}>{project.summary}</motion.p>}
        <motion.div className="bp-hero-actions" {...rise(0.28)}>
          <Link className="bp-btn bp-btn-light bp-btn-lg cursor-target" to={`/build-in-public/${encodeURIComponent(project.id)}?join=1`}>Request to join</Link>
          <Link className="bp-btn bp-btn-glass bp-btn-lg cursor-target" to={`/build-in-public/${encodeURIComponent(project.id)}`}>Read the brief</Link>
        </motion.div>
        <motion.div className="bp-owner" {...rise(0.34)}>
          <span className="bp-avatar">{avatar ? <img src={avatar} alt="" /> : initials(project.authorName || 'Binary Minds')}</span>
          <span>
            <strong>{project.authorName || 'Binary Minds'}</strong>
            <small>{[categoryOf(project), project.difficulty, buildingLabel(project.contributors)].filter(Boolean).join(' · ')}</small>
          </span>
        </motion.div>
      </div>
      <motion.div className="bp-hero-media" {...rise(0.16)}>
        <ProjectCover project={project} width={1400} />
      </motion.div>
    </section>
  )
}

function ProjectCard({ project, index, reduceMotion }) {
  const avatar = projectImageSource(project.authorAvatarUrl, 120)
  const appear = reduceMotion ? {} : {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '0px 0px -40px 0px' },
    transition: { duration: 0.75, delay: Math.min(index, 5) * 0.06, ease: EASE },
  }

  return (
    <motion.li className="bp-card" style={{ '--tint': coverTint(project) }} {...appear}>
      <Link className="bp-card-link cursor-target" to={`/build-in-public/${encodeURIComponent(project.id)}`}>
        <div className="bp-card-media">
          <ProjectCover project={project} width={900} />
          {project.difficulty && <span className="bp-level">{project.difficulty}</span>}
        </div>
        <div className="bp-card-body">
          <span className="bp-avatar">{avatar ? <img src={avatar} alt="" loading="lazy" /> : initials(project.authorName || 'Binary Minds')}</span>
          <div>
            <h3>{project.title}</h3>
            <p className="bp-card-owner">{project.authorName || 'Binary Minds'}</p>
            <p className="bp-card-meta">{categoryOf(project)} · {buildingLabel(project.contributors)}</p>
          </div>
        </div>
      </Link>
    </motion.li>
  )
}
