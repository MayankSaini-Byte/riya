import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import MindCard from '../components/MindCard'
import PageTransition from '../components/PageTransition'
import { fetchMinds as loadMinds } from '../lib/sanity'
import { InteractiveGridPattern } from '../components/InteractiveGridPattern'

export default function Minds() {
  const [minds, setMinds] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchMinds() {
      try {
        const fetchedMinds = await loadMinds()
        setMinds(fetchedMinds)
      } catch (err) {
        console.error("Failed to fetch minds from Sanity:", err)
        setMinds([])
      } finally {
        setLoading(false)
      }
    }
    fetchMinds()
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return minds
    const q = search.toLowerCase()
    return minds.filter(m =>
      m.title?.toLowerCase().includes(q) ||
      m.authorName?.toLowerCase().includes(q) ||
      m.categories?.some(c => c?.toLowerCase().includes(q))
    )
  }, [minds, search])

  return (
    <PageTransition className="page minds-page" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background grid pattern */}
      <div style={{
        position: 'absolute',
        inset: '-30% 0',
        height: '200%',
        width: '100%',
        transform: 'skewY(12deg)',
        WebkitMaskImage: 'radial-gradient(400px circle at center, white, transparent)',
        maskImage: 'radial-gradient(400px circle at center, white, transparent)',
        zIndex: 0,
        pointerEvents: 'none'
      }}>
        <InteractiveGridPattern width={40} height={40} className="grid-bg" />
      </div>

      <div className="minds-container" style={{ position: 'relative', zIndex: 1 }}>
        {/* ── Hero Header ── */}
        <motion.div
          className="minds-hero"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="minds-hero-title">
            Explore Our <span className="minds-hero-accent">Minds</span>
          </h1>

          {/* ── Search Bar ── */}
          <motion.div
            className="minds-search-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="minds-search-bar">
              <svg className="minds-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="minds-search-input"
                placeholder="Search by title, author, or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="minds-search-clear"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>

        {/* ── Results count ── */}
        {!loading && (
          <motion.div
            className="minds-results-bar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <span className="minds-results-count">
              {filtered.length} {filtered.length === 1 ? 'article' : 'articles'}
              {search && ` matching "${search}"`}
            </span>
          </motion.div>
        )}

        {/* ── Cards Grid ── */}
        <div className="minds-grid">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="mind-card-skeleton" style={{ animationDelay: `${i * 0.1}s` }} />
            ))
          ) : filtered.length > 0 ? (
            filtered.map((mind, i) => (
              <motion.div
                key={mind._id || mind.slug?.current || i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '50px' }}
                transition={{ duration: 0.5, delay: Math.min(i * 0.08, 0.4) }}
              >
                <MindCard mind={mind} />
              </motion.div>
            ))
          ) : (
            <motion.div
              className="minds-empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="minds-empty-icon">🔍</div>
              <h3>No articles found</h3>
              <p>
                {search
                  ? `Nothing matches "${search}". Try a different search term.`
                  : 'Check back later for new editions.'
                }
              </p>
              {search && (
                <button className="btn-secondary" onClick={() => setSearch('')} style={{ marginTop: '1rem' }}>
                  Clear Search
                </button>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
