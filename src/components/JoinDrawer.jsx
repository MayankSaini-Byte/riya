import { useEffect, useRef, useState } from 'react'
import { ALLOWED_FILES, CHUNK_BYTES, MAX_FILE_BYTES, fileAsBase64, postJson } from '../lib/buildInPublic'

const EMPTY_FORM = {
  fullName: '',
  studentEmail: '',
  githubProfile: '',
  linkedinProfile: '',
  motivation: '',
  contributionIdea: '',
  website: '',
}

/**
 * The join form, as a panel that slides in from the left edge.
 * Rendered only while `project` is set; the caller owns open/close.
 */
export default function JoinDrawer({ project, onClose }) {
  const panelRef = useRef(null)
  const fileInputRef = useRef(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [file, setFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [state, setState] = useState({ busy: false, error: '', success: false })

  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape' && !state.busy) onClose() }
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('bm-drawer-open')
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.querySelector('input, textarea, button')?.focus()
    }, 120)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('bm-drawer-open')
      window.clearTimeout(focusTimer)
    }
  }, [state.busy, onClose])

  // Keep tab focus inside the panel while it is open.
  function trapFocus(event) {
    if (event.key !== 'Tab') return
    const focusable = panelRef.current?.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  function chooseFile(nextFile) {
    setState(current => ({ ...current, error: '' }))
    if (!nextFile) return setFile(null)
    const extension = nextFile.name.split('.').pop().toLowerCase()
    if (!ALLOWED_FILES.has(extension)) {
      setFile(null)
      return setState(current => ({ ...current, error: 'Choose a PDF, DOC, or DOCX file.' }))
    }
    if (nextFile.size < 1 || nextFile.size > MAX_FILE_BYTES) {
      setFile(null)
      return setState(current => ({ ...current, error: 'The attachment must be a non-empty file up to 5 MB.' }))
    }
    setFile(nextFile)
  }

  async function submit(event) {
    event.preventDefault()
    setState({ busy: true, error: '', success: false })
    try {
      let uploadId = ''
      if (file) {
        const upload = await postJson('/api/public/build-in-public-attachment', {
          action: 'init', fileName: file.name, size: file.size,
        })
        uploadId = upload.uploadId
        for (let index = 0; index < upload.totalChunks; index += 1) {
          const start = index * CHUNK_BYTES
          const chunk = await fileAsBase64(file.slice(start, Math.min(start + CHUNK_BYTES, file.size)))
          await postJson('/api/public/build-in-public-attachment', { action: 'chunk', uploadId, index, data: chunk })
        }
      }
      await postJson('/api/public/build-in-public', { ...form, projectId: project.id, uploadId })
      setState({ busy: false, error: '', success: true })
      setForm(EMPTY_FORM)
      setFile(null)
    } catch (error) {
      setState({ busy: false, error: error.message, success: false })
    }
  }

  function updateField(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  return (
    <div className="jd-scrim" onMouseDown={event => { if (event.target === event.currentTarget && !state.busy) onClose() }}>
      <section
        className="jd-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="jd-title"
        onKeyDown={trapFocus}
        data-lenis-prevent
      >
        <header className="jd-head">
          <div>
            <h2 id="jd-title">Join {project.title}</h2>
            <p className="jd-sub">Send a contribution request to the maintainers.</p>
          </div>
          <button type="button" className="jd-close" onClick={onClose} aria-label="Close the join form">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l14 14M19 5L5 19" /></svg>
          </button>
        </header>

        {state.success ? (
          <div className="jd-success">
            <div className="jd-success-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square"><path d="M4 12.5l5 5L20 6" /></svg>
            </div>
            <h3>Request sent</h3>
            <p>A Binary Minds maintainer will reply to the student email you gave. You can close this panel.</p>
            <button className="bm-btn bm-btn-primary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form className="jd-form" onSubmit={submit}>
            <div className="jd-fields">
              <p className="jd-brief">{project.guidelines}</p>

              <label>Full name <b aria-hidden="true">*</b>
                <input name="fullName" value={form.fullName} onChange={updateField} autoComplete="name" maxLength={100} required />
              </label>
              <label>Student email <b aria-hidden="true">*</b>
                <input name="studentEmail" type="email" value={form.studentEmail} onChange={updateField} autoComplete="email" placeholder="you@iitmbs.ac.in" maxLength={160} required />
              </label>
              <label>GitHub <b aria-hidden="true">*</b>
                <input name="githubProfile" type="text" inputMode="url" value={form.githubProfile} onChange={updateField} placeholder="username or github.com/username" maxLength={300} autoComplete="off" required />
              </label>
              <label>LinkedIn <b aria-hidden="true">*</b>
                <input name="linkedinProfile" type="text" inputMode="url" value={form.linkedinProfile} onChange={updateField} placeholder="id or linkedin.com/in/username" maxLength={300} autoComplete="off" required />
              </label>
              <label>Why do you want to contribute? <b aria-hidden="true">*</b>
                <textarea name="motivation" value={form.motivation} onChange={updateField} rows={4} maxLength={2000} minLength={20} placeholder="Your motivation, experience, or what draws you to this project…" required />
              </label>
              <label>Your first idea for the project <b aria-hidden="true">*</b>
                <textarea name="contributionIdea" value={form.contributionIdea} onChange={updateField} rows={4} maxLength={2000} minLength={20} placeholder="The feature, improvement, or area you would start with…" required />
              </label>

              <div className="jd-attach">
                <span className="jd-attach-label">Attachment <small>optional</small></span>
                <div
                  className={`jd-drop ${dragActive ? 'is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInputRef.current?.click() } }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={event => { event.preventDefault(); setDragActive(true) }}
                  onDragOver={event => event.preventDefault()}
                  onDragLeave={event => { event.preventDefault(); setDragActive(false) }}
                  onDrop={event => { event.preventDefault(); setDragActive(false); chooseFile(event.dataTransfer.files?.[0]) }}
                >
                  <span>{file ? file.name : 'Choose a file or drop it here'}</span>
                  <small>PDF or Word document, up to 5 MB</small>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onClick={event => event.stopPropagation()}
                    onChange={event => chooseFile(event.target.files?.[0])}
                  />
                </div>
                {file && <button type="button" className="jd-remove" onClick={() => { chooseFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>Remove file</button>}
              </div>

              <label className="jd-honeypot" aria-hidden="true">Website
                <input name="website" tabIndex="-1" autoComplete="off" value={form.website} onChange={updateField} />
              </label>

              {state.error && <p className="jd-error" role="alert">{state.error}</p>}
            </div>

            <footer className="jd-actions">
              <p>Your details go only to the Binary Minds review team.</p>
              <div>
                <button type="button" className="bm-btn bm-btn-ghost" onClick={onClose} disabled={state.busy}>Cancel</button>
                <button type="submit" className="bm-btn bm-btn-primary" disabled={state.busy}>{state.busy ? 'Sending…' : 'Send request'}</button>
              </div>
            </footer>
          </form>
        )}
      </section>
    </div>
  )
}
