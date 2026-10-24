import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { safeExternalUrl } from '../lib/buildInPublic'
import './AdminPortal.css'

const COLLECTIONS = [
  { type: 'siteEvent', label: 'Events' },
  { type: 'siteResult', label: 'Results' },
  { type: 'siteAnnouncement', label: 'Announcements' },
]

const EMPTY_PROJECT = { title: '', summary: '', guidelines: '', tags: '', category: '', difficulty: '', authorName: '', authorRole: '', status: 'draft' }

function canEditCollection(role, type) {
  if (role === 'super_admin') return true
  if (role === 'event_organizer') return ['siteEvent', 'siteResult', 'siteAnnouncement'].includes(type)
  if (role === 'content_editor') return ['siteAnnouncement'].includes(type)
  return false
}

function newDocument(type) {
  const base = {
    _type: type,
    title: '',
    slug: { _type: 'slug', current: '' },
    publicationStatus: 'draft',
  }
  if (type === 'siteEvent') return { ...base, status: 'upcoming', startDate: '', endDate: '', registrationLink: '', ruleBookLink: '', image: '', footerText: '', details: [] }
  if (type === 'siteResult') return { ...base, eventId: '', eyebrow: '', subtitle: '', top3: [], honorableMentions: [] }
  if (type === 'siteAnnouncement') return { ...base, body: '', startsAt: '', endsAt: '' }
  return { ...base, body: '', startsAt: '', endsAt: '' }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`)
  return payload
}

export default function AdminPortal() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [selectedType, setSelectedType] = useState('build-in-public')
  const [documents, setDocuments] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [projects, setProjects] = useState([])
  const [bipSection, setBipSection] = useState('projects')
  const [projectDraft, setProjectDraft] = useState(EMPTY_PROJECT)
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [adminUsers, setAdminUsers] = useState([])
  const [auditEntries, setAuditEntries] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newAccount, setNewAccount] = useState({ username: '', role: 'content_editor', password: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const loadDocuments = useCallback(async (type) => {
    setBusy(true)
    setError('')
    try {
      const result = await request(`/api/admin/content?type=${encodeURIComponent(type)}`)
      setDocuments(result.documents || [])
      setSelectedId(null)
      setDraft('')
    } catch (reason) {
      setDocuments([])
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    request('/api/auth/session')
      .then(result => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    if (!user) return
    if (user.role !== 'super_admin' && selectedType === 'build-in-public') {
      setSelectedType(user.role === 'content_editor' ? 'siteAnnouncement' : 'siteEvent')
      return
    }
    if (selectedType === 'build-in-public') {
      setBusy(true)
      Promise.all([request('/api/admin/build-in-public'), request('/api/admin/build-in-public-projects')])
        .then(([applicationResult, projectResult]) => {
          setSubmissions(applicationResult.submissions || [])
          setProjects(projectResult.projects || [])
          setError('')
        })
        .catch(reason => { setSubmissions([]); setProjects([]); setError(reason.message) })
        .finally(() => setBusy(false))
      return
    }
    if (selectedType === 'accounts') {
      setBusy(true)
      request('/api/admin/users')
        .then(result => { setAdminUsers(result.users || []); setError('') })
        .catch(reason => { setAdminUsers([]); setError(reason.message) })
        .finally(() => setBusy(false))
      return
    }
    if (selectedType === 'audit') {
      setBusy(true)
      request('/api/admin/audit')
        .then(result => { setAuditEntries(result.entries || []); setError('') })
        .catch(reason => { setAuditEntries([]); setError(reason.message) })
        .finally(() => setBusy(false))
      return
    }
    loadDocuments(selectedType)
  }, [user, selectedType, loadDocuments])

  async function signIn(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      setUser(result.user)
      setPassword('')
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    try {
      await request('/api/auth/logout', { method: 'POST', body: '{}' })
    } finally {
      setUser(null)
      setSelectedType('build-in-public')
      setDocuments([])
      setSelectedId(null)
      setDraft('')
      navigate('/kazi_binary_admins', { replace: true })
    }
  }

  async function refreshSubmissions() {
    setBusy(true)
    setError('')
    try { setSubmissions((await request('/api/admin/build-in-public')).submissions || []) }
    catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }

  function beginProjectEdit(project = null) {
    setEditingProjectId(project?.id || null)
    setProjectDraft(project ? {
      ...project,
      tags: (project.tags || []).join(', '),
      category: project.category || '',
      difficulty: project.difficulty || '',
      authorName: project.authorName || '',
      authorRole: project.authorRole || '',
      repositoryUrl: project.repositoryUrl || '',
      imageDriveUrl: project.imageDriveUrl || '',
      authorAvatarUrl: project.authorAvatarUrl || '',
    } : { ...EMPTY_PROJECT, repositoryUrl: '', imageDriveUrl: '', authorAvatarUrl: '' })
    setError('')
    setNotice('')
  }

  async function saveProject(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const payload = { ...projectDraft, tags: projectDraft.tags.split(',').map(tag => tag.trim()).filter(Boolean) }
    try {
      await request('/api/admin/build-in-public-projects', {
        method: editingProjectId ? 'PUT' : 'POST',
        body: JSON.stringify(editingProjectId ? { ...payload, id: editingProjectId } : payload),
      })
      setProjects((await request('/api/admin/build-in-public-projects')).projects || [])
      setProjectDraft({ ...EMPTY_PROJECT })
      setEditingProjectId(null)
      setNotice(editingProjectId ? 'Project changes saved.' : 'Project created.')
    } catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }

  async function deleteProject(project) {
    if (!window.confirm(`Delete “${project.title}”? Existing contribution requests will keep their project name.`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request('/api/admin/build-in-public-projects', { method: 'DELETE', body: JSON.stringify({ id: project.id }) })
      setProjects((await request('/api/admin/build-in-public-projects')).projects || [])
      if (editingProjectId === project.id) beginProjectEdit()
      setNotice('Project deleted.')
    } catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }

  async function downloadAttachment(application) {
    if (!application.attachment) return
    setBusy(true)
    setError('')
    try {
      const parts = []
      for (let index = 0; index < application.attachment.totalChunks; index += 1) {
        const result = await request(`/api/admin/build-in-public-attachment?id=${encodeURIComponent(application.id)}&chunk=${index}`)
        const decoded = atob(result.data)
        const bytes = new Uint8Array(decoded.length)
        for (let offset = 0; offset < decoded.length; offset += 1) bytes[offset] = decoded.charCodeAt(offset)
        parts.push(bytes)
      }
      const blob = new Blob(parts, { type: application.attachment.mimeType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = application.attachment.fileName
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }

  async function reviewSubmission(id, status) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await request('/api/admin/build-in-public', { method: 'PATCH', body: JSON.stringify({ id, status }) })
      let nextError = ''
      let nextNotice = ''
      if (status === 'accepted' && !result.notification?.sent) {
        nextError = `Request accepted, but the email was not sent. ${result.notification?.message || 'Try again after checking the email setup.'}`
      } else if (status === 'accepted') {
        nextNotice = result.notification?.alreadySent ? 'Request is accepted and its email was already sent.' : 'Request accepted and email sent.'
      } else {
        nextNotice = `Contribution request ${status}.`
      }
      await refreshSubmissions()
      if (nextError) setError(nextError)
      if (nextNotice) setNotice(nextNotice)
    } catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }

  async function deleteSubmission(submission) {
    const hasAttachment = Boolean(submission.attachment)
    const confirmed = window.confirm(
      `Permanently delete the contribution request from ${submission.fullName}?${hasAttachment ? ' Its uploaded attachment will also be deleted from Upstash.' : ''}`,
    )
    if (!confirmed) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request('/api/admin/build-in-public', {
        method: 'DELETE',
        body: JSON.stringify({ id: submission.id }),
      })
      await refreshSubmissions()
      setNotice(`Contribution request${hasAttachment ? ' and attachment' : ''} deleted.`)
    } catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }

  async function addAdminUser(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request('/api/admin/users', { method: 'POST', body: JSON.stringify(newAccount) })
      setNewAccount({ username: '', role: 'content_editor', password: '' })
      setNotice('Account added. Share the initial password with the new team member securely.')
      setAdminUsers((await request('/api/admin/users')).users || [])
    } catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }

  async function removeAdminUser(username) {
    if (!window.confirm(`Remove access for ${username}?`)) return
    setBusy(true)
    setError('')
    try {
      await request('/api/admin/users', { method: 'DELETE', body: JSON.stringify({ username }) })
      setAdminUsers((await request('/api/admin/users')).users || [])
      setNotice('Account access removed.')
    } catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }

  function selectDocument(document) {
    setSelectedId(document._id)
    setDraft(JSON.stringify(document, null, 2))
    setError('')
    setNotice('')
  }

  function startNew() {
    setSelectedId(null)
    setDraft(JSON.stringify(newDocument(selectedType), null, 2))
    setError('')
    setNotice('New draft. Add a stable `_id` if you need to reference this document from another record.')
  }

  async function saveDocument(event) {
    event.preventDefault()
    let parsed
    try {
      parsed = JSON.parse(draft)
    } catch {
      setError('The document is not valid JSON. Check commas, quotes, and brackets.')
      return
    }
    if (parsed._type !== selectedType) {
      setError(`This collection only accepts documents with _type "${selectedType}".`)
      return
    }
    if (parsed.publicationStatus && !['draft', 'review', 'published', 'archived'].includes(parsed.publicationStatus)) {
      setError('publicationStatus must be draft, review, published, or archived.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const isUpdate = Boolean(selectedId)
      const path = `/api/admin/content?type=${encodeURIComponent(selectedType)}${isUpdate ? `&id=${encodeURIComponent(selectedId)}` : ''}`
      const result = await request(path, {
        method: isUpdate ? 'PUT' : 'POST',
        body: JSON.stringify(parsed),
      })
      setNotice(isUpdate ? 'Changes saved.' : 'Document created.')
      await loadDocuments(selectedType)
      if (result.document?._id) selectDocument(result.document)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteDocument() {
    if (!selectedId || !window.confirm('Delete this document permanently? This cannot be undone.')) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request(`/api/admin/content?type=${encodeURIComponent(selectedType)}&id=${encodeURIComponent(selectedId)}`, { method: 'DELETE' })
      setNotice('Document deleted.')
      await loadDocuments(selectedType)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  if (!authChecked) return <main className="admin-loading"><span className="admin-spinner" />Checking admin session…</main>

  if (!user) {
    return (
      <main className="admin-login-page">
        <section className="admin-login-card" aria-labelledby="admin-login-title">
          <a className="admin-brand" href="/"><img src="/binary-minds-logo.jpg" alt="" /><span>Binary Minds</span></a>
          <p className="admin-eyebrow">Organizer access</p>
          <h1 id="admin-login-title">Sign in to your workspace</h1>
          <p className="admin-muted">Use an account configured by the site administrator.</p>
          {error && <div className="admin-alert" role="alert">{error}</div>}
          <form onSubmit={signIn} className="admin-login-form">
            <label>Username<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required /></label>
            <label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
            <button className="admin-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button>
          </form>
          <a className="admin-back-link" href="/">← Return to the public site</a>
        </section>
      </main>
    )
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/"><img src="/binary-minds-logo.jpg" alt="" /><span>Binary Minds</span></a>
        <p className="admin-eyebrow">Administration</p>
        <nav aria-label="Content collections" className="admin-nav">
          {user.role === 'super_admin' && <button className={selectedType === 'build-in-public' ? 'active' : ''} onClick={() => setSelectedType('build-in-public')}>Build in Public</button>}
          {COLLECTIONS.map(collection => (
            <button key={collection.type} className={selectedType === collection.type ? 'active' : ''} onClick={() => setSelectedType(collection.type)}>
              {collection.label}
            </button>
          ))}
          {user.role === 'super_admin' && <button className={selectedType === 'accounts' ? 'active' : ''} onClick={() => setSelectedType('accounts')}>Access management</button>}
          {user.role === 'super_admin' && <button className={selectedType === 'audit' ? 'active' : ''} onClick={() => setSelectedType('audit')}>Audit history</button>}
        </nav>
        <div className="admin-sidebar-bottom">
          <span>{user.username}<small>{user.role.replaceAll('_', ' ')}</small></span>
          <button className="admin-signout" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-page-header">
          <div><p className="admin-eyebrow">{selectedType === 'accounts' || selectedType === 'build-in-public' ? 'Super Admin only' : 'Content governance'}</p><h1>{selectedType === 'audit' ? 'Audit history' : selectedType === 'accounts' ? 'Access management' : selectedType === 'build-in-public' ? 'Build in Public' : COLLECTIONS.find(item => item.type === selectedType)?.label}</h1></div>
          {selectedType === 'build-in-public' && <button className="admin-secondary" onClick={bipSection === 'projects' ? () => request('/api/admin/build-in-public-projects').then(result => setProjects(result.projects || [])).catch(reason => setError(reason.message)) : refreshSubmissions} disabled={busy}>Refresh {bipSection}</button>}
          {selectedType !== 'audit' && selectedType !== 'accounts' && selectedType !== 'build-in-public' && canEditCollection(user.role, selectedType) && <button className="admin-primary" onClick={startNew}>＋ New document</button>}
        </header>

        {['siteEvent', 'siteResult', 'siteAnnouncement'].includes(selectedType) && <div className="admin-callout">
          <strong>Draft → review → publish</strong>
          <span>Set `publicationStatus` to draft, review, published, or archived. Public event, result, and announcement views read only published records.</span>
        </div>}

        {(error || notice) && <div className={error ? 'admin-alert' : 'admin-notice'} role={error ? 'alert' : 'status'}>{error || notice}</div>}

        {selectedType === 'accounts' ? (
          <div className="admin-accounts-layout">
            <section className="admin-document-list">
              <div className="admin-list-heading"><h2>Accounts with access</h2></div>
              {busy && adminUsers.length === 0 ? <p className="admin-muted">Loading accounts…</p> : adminUsers.map(account => (
                <article className="admin-account-row" key={account.username}>
                  <div><strong>{account.username}</strong><small>{account.role.replaceAll('_', ' ')}{account.managed ? ' · added here' : ' · server account'}</small></div>
                  {account.managed && <button className="admin-danger-link" onClick={() => removeAdminUser(account.username)} disabled={busy}>Remove</button>}
                </article>
              ))}
            </section>
            <form className="admin-editor admin-account-form" onSubmit={addAdminUser}>
              <h2>Add team access</h2>
              <p className="admin-muted">Only a Super Admin can add accounts. Assign Super Admin to give someone the same full portal access as you. Each person gets their own password.</p>
              <label>Email or username<input autoComplete="off" value={newAccount.username} onChange={event => setNewAccount({ ...newAccount, username: event.target.value })} required /></label>
              <label>Role<select value={newAccount.role} onChange={event => setNewAccount({ ...newAccount, role: event.target.value })}><option value="content_editor">Content Editor</option><option value="event_organizer">Event Organizer</option><option value="evaluator">Evaluator</option><option value="read_only">Read Only</option><option value="super_admin">Super Admin — full access</option></select></label>
              <label>Initial password<input type="password" autoComplete="new-password" minLength={14} value={newAccount.password} onChange={event => setNewAccount({ ...newAccount, password: event.target.value })} required /></label>
              <div className="admin-editor-actions"><span>Use at least 14 characters. Share it securely.</span><button className="admin-primary" disabled={busy}>{busy ? 'Adding…' : 'Add account'}</button></div>
            </form>
          </div>
        ) : selectedType === 'build-in-public' ? (
          <>
            <div className="admin-callout"><strong>Manage public projects and review private requests.</strong><span>Published projects and their guidelines appear on the public Build in Public page. Draft and archived projects stay hidden. Applicant details and attachments are visible only to Super Admins. PDF/Word attachments are stored as private chunks in Upstash Redis for 90 days; deleting a request also deletes its attachment.</span></div>
            <nav className="admin-bip-tabs" aria-label="Build in Public sections">
              <button type="button" className={bipSection === 'projects' ? 'active' : ''} onClick={() => { setBipSection('projects'); setError(''); setNotice('') }}>Projects</button>
              <button type="button" className={bipSection === 'applications' ? 'active' : ''} onClick={() => { setBipSection('applications'); setError(''); setNotice('') }}>Contribution requests <span>{submissions.length}</span></button>
            </nav>
            {bipSection === 'projects' ? <div className="admin-bip-project-layout">
              <section className="admin-document-list">
                <div className="admin-list-heading"><h2>Public projects</h2><button type="button" onClick={() => beginProjectEdit()}>＋ New project</button></div>
                {busy && projects.length === 0 ? <p className="admin-muted">Loading projects…</p> : projects.length ? projects.map(project => <article className="admin-bip-project-row" key={project.id}>
                  <div><span className={`admin-status admin-status-${project.status === 'published' ? 'accepted' : 'pending'}`}>{project.status}</span><h3>{project.title}</h3><p>{project.summary}</p><small>{project.tags?.join(' · ') || 'No tags'}</small></div>
                  <div className="admin-bip-project-actions"><button type="button" className="admin-secondary" onClick={() => beginProjectEdit(project)}>Edit</button><button type="button" className="admin-danger-link" onClick={() => deleteProject(project)} disabled={busy}>Delete</button></div>
                </article>) : <p className="admin-muted">No projects yet. Add one to publish an opportunity.</p>}
              </section>
              <form className="admin-editor admin-bip-project-form" onSubmit={saveProject}>
                <h2>{editingProjectId ? 'Edit project' : 'Create a project'}</h2>
                <p className="admin-muted">Published projects appear on the public page. Contribution guidelines are shown with the project and in its request form.</p>
                <label>Project name<input value={projectDraft.title} maxLength={140} onChange={event => setProjectDraft({ ...projectDraft, title: event.target.value })} required /></label>
                <label>Project summary<textarea value={projectDraft.summary} maxLength={1200} rows={4} onChange={event => setProjectDraft({ ...projectDraft, summary: event.target.value })} required /></label>
                <label>Contribution guidelines<textarea value={projectDraft.guidelines} maxLength={1200} rows={4} onChange={event => setProjectDraft({ ...projectDraft, guidelines: event.target.value })} required /></label>
                <label>Track / category <span className="admin-muted">Groups the project on the public ledger.</span><input value={projectDraft.category} maxLength={40} onChange={event => setProjectDraft({ ...projectDraft, category: event.target.value })} placeholder="AI &amp; Agents, Systems &amp; Tools, Web &amp; Product…" /></label>
                <label>Difficulty<select value={projectDraft.difficulty} onChange={event => setProjectDraft({ ...projectDraft, difficulty: event.target.value })}><option value="">Not set</option><option value="Beginner">Beginner</option><option value="Intermediate">Intermediate</option><option value="Advanced">Advanced</option></select></label>
                <label>Owner name <span className="admin-muted">Shown as the project byline.</span><input value={projectDraft.authorName} maxLength={80} onChange={event => setProjectDraft({ ...projectDraft, authorName: event.target.value })} placeholder="Binary Minds Core, Riya S.…" /></label>
                <label>Owner role<input value={projectDraft.authorRole} maxLength={80} onChange={event => setProjectDraft({ ...projectDraft, authorRole: event.target.value })} placeholder="Maintainers, Project lead…" /></label>
                <label>Owner avatar Google Drive link <span className="admin-muted">Optional. Set the Drive image to “Anyone with the link can view.”</span><input type="url" value={projectDraft.authorAvatarUrl || ''} onChange={event => setProjectDraft({ ...projectDraft, authorAvatarUrl: event.target.value })} placeholder="https://drive.google.com/file/d/…" /></label>
                <label>Tags <span className="admin-muted">Separate tags with commas.</span><input value={projectDraft.tags} onChange={event => setProjectDraft({ ...projectDraft, tags: event.target.value })} placeholder="Python, React, AI / ML" /></label>
                <label>Git repository link <span className="admin-muted">Optional HTTPS link to the project repository.</span><input type="url" value={projectDraft.repositoryUrl || ''} onChange={event => setProjectDraft({ ...projectDraft, repositoryUrl: event.target.value })} placeholder="https://github.com/organization/project" /></label>
                <label>Project image Google Drive link <span className="admin-muted">Optional. Set the Drive image to “Anyone with the link can view.”</span><input type="url" value={projectDraft.imageDriveUrl || ''} onChange={event => setProjectDraft({ ...projectDraft, imageDriveUrl: event.target.value })} placeholder="https://drive.google.com/file/d/…" /></label>
                <label>Visibility<select value={projectDraft.status} onChange={event => setProjectDraft({ ...projectDraft, status: event.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                <div className="admin-editor-actions"><button type="button" className="admin-secondary" onClick={() => beginProjectEdit()}>Clear</button><button className="admin-primary" disabled={busy}>{busy ? 'Saving…' : editingProjectId ? 'Save project' : 'Create project'}</button></div>
              </form>
            </div> : <section className="admin-submissions">
              {busy && submissions.length === 0 ? <p className="admin-muted">Loading applications…</p> : submissions.length ? submissions.map(submission => (
                <article className="admin-submission" key={submission.id}>
                  <div className="admin-submission-content">
                    <div className="admin-submission-heading"><span className={`admin-status admin-status-${submission.status}`}>{submission.status}</span><time>{new Date(submission.createdAt).toLocaleDateString()}</time></div>
                    {submission.status === 'accepted' && <p className={`admin-email-status ${submission.emailNotificationStatus === 'sent' ? 'is-sent' : 'is-failed'}`}>{submission.emailNotificationStatus === 'sent' ? 'Acceptance email sent' : submission.emailNotificationStatus === 'failed' ? `Acceptance email failed: ${submission.emailNotificationError || 'Retry after checking email setup.'}` : 'Acceptance email has not been sent yet.'}</p>}
                    <h2>{submission.fullName}</h2>
                    <p><strong>Project:</strong> {submission.project || 'Binary Minds Open AI Agent Framework'}<br /><strong>Student email:</strong> <a href={`mailto:${submission.studentEmail}`}>{submission.studentEmail}</a></p>
                    <div className="admin-submission-meta">
                      {safeExternalUrl(submission.githubProfile)
                        ? <a href={safeExternalUrl(submission.githubProfile)} target="_blank" rel="noopener noreferrer">GitHub profile ↗</a>
                        : <span>GitHub profile unavailable</span>}
                      {safeExternalUrl(submission.linkedinProfile)
                        ? <a href={safeExternalUrl(submission.linkedinProfile)} target="_blank" rel="noopener noreferrer">LinkedIn profile ↗</a>
                        : <span>LinkedIn profile unavailable</span>}
                    </div>
                    <h3>Why they want to contribute</h3><p>{submission.motivation}</p>
                    <h3>Contribution idea</h3><p>{submission.contributionIdea}</p>
                    {submission.attachment && <button className="admin-secondary admin-attachment-button" disabled={busy} onClick={() => downloadAttachment(submission)}>Download {submission.attachment.fileName} ({(submission.attachment.size / 1024 / 1024).toFixed(1)} MB)</button>}
                    <div className="admin-submission-actions">
                      {submission.status === 'accepted' && submission.emailNotificationStatus !== 'sent' && <button className="admin-secondary admin-email-retry" disabled={busy} onClick={() => reviewSubmission(submission.id, 'accepted')}>Retry acceptance email</button>}
                      {submission.status !== 'accepted' && <button className="admin-primary" disabled={busy} onClick={() => reviewSubmission(submission.id, 'accepted')}>Accept request</button>}
                      {submission.status !== 'rejected' && <button className="admin-danger-link" disabled={busy} onClick={() => reviewSubmission(submission.id, 'rejected')}>Reject</button>}
                      <button className="admin-danger-link admin-delete-submission" disabled={busy} onClick={() => deleteSubmission(submission)}>Delete request</button>
                    </div>
                  </div>
                </article>
              )) : <div className="admin-empty-state"><h2>No contribution requests yet</h2><p>Requests for published Build in Public projects will appear here for Super Admin review.</p></div>}
            </section>}
          </>
        ) : selectedType === 'audit' ? (
          <section className="admin-audit-list">
            <div className="admin-list-heading"><h2>Recent security and content actions</h2><button onClick={() => request('/api/admin/audit').then(result => setAuditEntries(result.entries || [])).catch(reason => setError(reason.message))}>Refresh</button></div>
            {busy ? <p className="admin-muted">Loading audit entries…</p> : auditEntries.length ? auditEntries.map((entry, index) => (
              <article key={`${entry.at}-${index}`} className="admin-audit-entry">
                <strong>{entry.action}</strong><span>{entry.actor} · {entry.role}</span>
                <small>{entry.contentType ? `${entry.contentType}${entry.documentId ? ` · ${entry.documentId}` : ''}` : 'Authentication'}</small>
                <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
              </article>
            )) : <p className="admin-muted">No audit events have been recorded yet.</p>}
          </section>
        ) : <div className="admin-workspace">
          <section className="admin-document-list" aria-label="Documents">
            <div className="admin-list-heading"><h2>Documents</h2><button onClick={() => loadDocuments(selectedType)} disabled={busy}>Refresh</button></div>
            {busy && documents.length === 0 ? <p className="admin-muted">Loading…</p> : documents.length ? documents.map(document => (
              <button key={document._id} className={`admin-document-row ${selectedId === document._id ? 'selected' : ''}`} onClick={() => selectDocument(document)}>
                <span>{document.title || document.name || '(Untitled document)'}</span>
                <small>{document.publicationStatus || 'No status'} · {document._id}</small>
              </button>
            )) : <p className="admin-muted">No documents in this collection yet.</p>}
          </section>

          <form className="admin-editor" onSubmit={saveDocument}>
            <div className="admin-list-heading"><h2>{selectedId ? 'Edit document' : 'Document editor'}</h2>{selectedId && user.role === 'super_admin' && <button type="button" className="admin-danger-link" onClick={deleteDocument} disabled={busy}>Delete</button>}</div>
            <p className="admin-muted">Edit the Sanity document as JSON. Keep `_type` as <code>{selectedType}</code>. New records should start as drafts.</p>
            <textarea aria-label="Sanity document JSON" spellCheck="false" readOnly={!canEditCollection(user.role, selectedType)} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Choose a document or create a new one" />
            {canEditCollection(user.role, selectedType) && <div className="admin-editor-actions"><span>Changes are saved to Sanity through the server.</span><button className="admin-primary" disabled={busy || !draft}>{busy ? 'Saving…' : 'Save changes'}</button></div>}
          </form>
        </div>}

        {['siteEvent', 'siteResult', 'siteAnnouncement'].includes(selectedType) && <section className="admin-integration-note"><strong>Managed in Sanity.</strong><span>Events, results, and announcements continue to use Sanity. Their workflow can be revised separately.</span></section>}
      </section>
    </main>
  )
}
