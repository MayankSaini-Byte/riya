import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { categoryOf, driveImageSource, fetchProjects, initials, relativeWhen } from '../lib/buildInPublic'
import './BuildInPublic.css'

export default function BuildInPublic() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  useEffect(() => {
    let active = true
    fetchProjects()
      .then(list => { if (active) setProjects(list) })
      .catch(reason => { if (active) setError(reason.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const categories = useMemo(() => {
    const seen = []
    for (const project of projects) {
      const name = categoryOf(project)
      if (!seen.includes(name)) seen.push(name)
    }
    return seen
  }, [projects])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const project of projects) {
      const name = categoryOf(project)
      if (activeCategory !== 'All' && name !== activeCategory) continue
      if (!map.has(name)) map.set(name, [])
      map.get(name).push(project)
    }
    return [...map.entries()]
  }, [projects, activeCategory])

  const featured = useMemo(() => {
    return [...projects].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null
  }, [projects])

  return (
    <PageTransition className="bip">
      <>
        <header className="bip-mast">
          <motion.div
            className="bip-mast-copy"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="bip-title">Build in public.</h1>
            <p className="bip-lede">
              The open build log of Binary Minds — the projects we are making in the open,
              and the people making them. Pick one and help ship it.
            </p>
            <div className="bip-facts">
              <span><strong>{projects.length}</strong> open projects</span>
              <span><strong>{categories.length}</strong> active tracks</span>
              <span className="bip-fact-open"><i aria-hidden="true" /> Open for contributors</span>
            </div>
          </motion.div>

          {featured && (
            <motion.aside
              className="bip-featured"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="bip-featured-label">Newest project</h2>
              <ul className="bip-featured-grid"><ProjectCard project={featured} /></ul>
            </motion.aside>
          )}
        </header>

        {categories.length > 0 && (
          <nav className="bip-filter" aria-label="Filter projects by track">
            <button
              type="button"
              aria-pressed={activeCategory === 'All'}
              className={activeCategory === 'All' ? 'is-active' : ''}
              onClick={() => setActiveCategory('All')}
            >
              All
            </button>
            {categories.map(name => (
              <button
                key={name}
                type="button"
                aria-pressed={activeCategory === name}
                className={activeCategory === name ? 'is-active' : ''}
                onClick={() => setActiveCategory(name)}
              >
                {name}
              </button>
            ))}
          </nav>
        )}

        {loading ? (
          <div className="bip-grid bip-grid-skeleton" aria-hidden="true">
            {[0, 1, 2].map(key => <div className="bip-skeleton" key={key} />)}
          </div>
        ) : error ? (
          <p className="bip-state bip-state-error" role="alert">{error}</p>
        ) : grouped.length ? (
          grouped.map(([category, items]) => (
            <section className="bip-track" key={category}>
              <div className="bip-track-head">
                <h2>{category}</h2>
                <span>{items.length} {items.length === 1 ? 'project' : 'projects'}</span>
              </div>
              <ul className="bip-grid">
                {items.map(project => <ProjectCard key={project.id} project={project} />)}
              </ul>
            </section>
          ))
        ) : (
          <p className="bip-state">No projects are open for this track yet. Check back soon.</p>
        )}

        <section className="bip-how" aria-labelledby="bip-how-title">
          <h2 id="bip-how-title">How contributing works</h2>
          <p className="bip-how-lede">
            Everything happens in the open. No gatekeeping, no committee — a short request and a maintainer who replies.
          </p>
          <ol className="bip-steps">
            <li>
              <h3>Pick a project</h3>
              <p>Open a project to read its brief, its track and what it needs right now.</p>
            </li>
            <li>
              <h3>Send a request</h3>
              <p>Tell us who you are, why you want in, and the first thing you would build.</p>
            </li>
            <li>
              <h3>Build with the maintainers</h3>
              <p>Accepted contributors join the project and start shipping with the team.</p>
            </li>
          </ol>
        </section>
      </>
    </PageTransition>
  )
}

function ProjectCard({ project }) {
  const cover = driveImageSource(project.imageDriveUrl)
  const avatar = driveImageSource(project.authorAvatarUrl)
  const track = categoryOf(project)

  return (
    <li className="bip-card">
      <Link className="bip-card-link" to={`/build-in-public/${encodeURIComponent(project.id)}`}>
        <div className="bip-card-cover">
          {cover
            ? <img src={cover} alt="" loading="lazy" />
            : <span className="bip-card-mark" aria-hidden="true">{initials(project.title)}</span>}
          {project.difficulty && (
            <span className={`bm-level bm-level-${project.difficulty.toLowerCase()}`}>{project.difficulty}</span>
          )}
        </div>
        <div className="bip-card-body">
          <h3>{project.title}</h3>
          <p className="bip-card-summary">{project.summary}</p>
          <div className="bip-card-foot">
            <span className="bm-avatar" aria-hidden="true">
              {avatar ? <img src={avatar} alt="" loading="lazy" /> : initials(project.authorName)}
            </span>
            <span className="bip-card-meta">
              <strong>{project.authorName || 'Binary Minds'}</strong>
              <small>{track}{project.createdAt ? ` · ${relativeWhen(project.createdAt)}` : ''}</small>
            </span>
          </div>
        </div>
      </Link>
    </li>
  )
}
