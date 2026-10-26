import { urlFor } from '../lib/sanity'
import './ArticlePreview.css'

// A Mind that lives on Medium or Substack. Those sites refuse to be embedded,
// so we show the article's preview here and send readers to the original.

function externalLink(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}

export default function ArticlePreview({ mind }) {
  const href = externalLink(mind.articleUrl)
  const host = href ? new URL(href).hostname.replace(/^www\./, '') : ''
  const source = mind.siteName || host
  const date = mind.publishedAt
    ? new Date(mind.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''
  const topics = (mind.categories || []).filter(Boolean)

  return (
    <article className="article-preview">
      {mind.mainImage && (
        <div className="article-preview-cover">
          <img src={urlFor(mind.mainImage).width(1400).auto('format').url()} alt="" />
        </div>
      )}

      <div className="article-preview-body">
        {source && <p className="article-preview-source">{source}</p>}
        <h1 className="article-preview-title">{mind.title}</h1>
        {(mind.authorName || date) && (
          <p className="article-preview-byline">
            {mind.authorName && <span>{mind.authorName}</span>}
            {mind.authorName && date && <span aria-hidden="true"> · </span>}
            {date && <time dateTime={mind.publishedAt}>{date}</time>}
          </p>
        )}
        {mind.excerpt && <p className="article-preview-excerpt">{mind.excerpt}</p>}
        {topics.length > 0 && (
          <ul className="article-preview-tags">
            {topics.map(topic => <li key={topic}>{topic}</li>)}
          </ul>
        )}

        {href && (
          <div className="article-preview-cta">
            <a className="article-preview-read cursor-target" href={href} target="_blank" rel="noopener noreferrer">
              Read the full article{source ? ` on ${source}` : ''}
              <span aria-hidden="true">↗</span>
            </a>
            <span className="article-preview-note">Opens {host} in a new tab</span>
          </div>
        )}
      </div>
    </article>
  )
}
