import { Link } from 'react-router-dom'
import { urlFor } from '../lib/sanity'

export default function MindCard({ mind }) {
  const { title, slug, publishedAt, mainImage, authorName, categories, articleUrl, siteName } = mind
  const date = publishedAt
    ? new Date(publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Draft'

  return (
    <Link to={`/minds/${slug?.current}`} className="mind-card">
      <div className="mind-card-image">
        {mainImage ? (
          <img src={urlFor(mainImage).auto('format').width(600).url()} alt={title} loading="lazy" />
        ) : (
          <div className="mind-card-fallback" />
        )}
      </div>
      <div className="mind-card-content">
        <div className="mind-card-meta">
          <span className="mind-card-date">{date}</span>
          {authorName && (
            <>
              <span className="mind-card-meta-sep">·</span>
              <span className="mind-card-author">{authorName}</span>
            </>
          )}
        </div>
        <h3 className="mind-card-title">{title}</h3>
        {categories?.length > 0 && (
          <div className="mind-card-tags">
            {categories.slice(0, 3).map((cat, i) => (
              <span key={i} className="mind-card-tag">{cat}</span>
            ))}
          </div>
        )}
        <div className="mind-card-read">
          {articleUrl ? `Read on ${siteName || 'the web'}` : 'Read Mind'} <span className="mind-card-arrow">→</span>
        </div>
      </div>
    </Link>
  )
}
