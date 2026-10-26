import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ArticlePreview from '../components/ArticlePreview'
import MindViewer from '../components/MindViewer'
import MindMinimap from '../components/MindMinimap'
import PageTransition from '../components/PageTransition'
import { fetchMind as loadMind } from '../lib/sanity'
import { FiArrowLeft } from 'react-icons/fi'

export default function MindDetail() {
  const { slug } = useParams()
  const [mind, setMind] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMind() {
      try {
        const fetchedMind = await loadMind(slug)
        setMind(fetchedMind)
      } catch (err) {
        console.error("Failed to fetch mind from Sanity:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchMind()
  }, [slug])

  return (
    <PageTransition className="page mind-detail-page">
      <div className="mind-detail-container">
        <motion.div 
          className="back-link-wrapper"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link to="/minds" className="back-link minimal-back cursor-target" title="Back to Archive">
            <FiArrowLeft size={24} />
          </Link>
        </motion.div>

        {loading ? (
          <div className="pdf-loading">
            <div className="spinner" />
            <p>Loading Issue...</p>
          </div>
        ) : mind?.articleUrl ? (
          <ArticlePreview mind={mind} />
        ) : mind ? (
          <>
            <MindMinimap body={mind.body} />
            <MindViewer mind={mind} fullWidth />
          </>
        ) : (
          <div className="mind-viewer empty-state">
            <h3>Issue Not Found</h3>
            <p>The requested edition could not be found.</p>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
