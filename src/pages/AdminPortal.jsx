import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { safeExternalUrl } from '../lib/buildInPublic'
import DocumentForm from './admin/DocumentForm'
import {
  Chips, Combo, Confirm, Counter, Empty, Field, OptionCards, PasswordInput, Pill, PublishRail, Search,
  Segmented, StatusDot, TextArea, TextInput, Toasts,
} from './admin/fields'
import {
  ADMIN_ROLES, FORMS, PROJECT_CATEGORIES, PROJECT_DIFFICULTIES, PROJECT_VISIBILITY, PUBLICATION_STAGES,
  TAG_SUGGESTIONS, blankDocument, listRequiredGaps,
} from './admin/schema'
import './AdminPortal.css'

const CONTENT_TYPES = ['siteEvent', 'siteResult', 'siteAnnouncement']

const VIEWERS = {
  siteEvent: ['super_admin', 'event_organizer', 'read_only'],
  siteResult: ['super_admin', 'event_organizer', 'read_only'],
  siteAnnouncement: ['super_admin', 'content_editor', 'event_organizer', 'read_only'],
}
const EDITORS = {
  siteEvent: ['super_admin', 'event_organizer'],
  siteResult: ['super_admin', 'event_organizer'],
  siteAnnouncement: ['super_admin', 'content_editor', 'event_organizer'],
}

const EMPTY_PROJECT = {
  title: '', summary: '', guidelines: '', tags: [], category: '', difficulty: '',
  authorName: '', authorRole: '', authorAvatarUrl: '', repositoryUrl: '', imageDriveUrl: '', status: 'draft',
}

function canView(role, type) { return (VIEWERS[type] || []).includes(role) }
function canEdit(role, type) { return (EDITORS[type] || []).includes(role) }
function canPublish(role) { return role === 'super_admin' || role === 'event_organizer' }

function stageTone(value) { return PUBLICATION_STAGES.find(stage => stage.value === value)?.tone || 'off' }
function stageLabel(value) { return PUBLICATION_STAGES.find(stage => stage.value === value)?.label || 'Draft' }

function describe(list) {
  if (list.length === 1) return list[0]
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
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

/* --- Small inline icons ------------------------------------------------- */
const Ic = {
  moon: <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16.5 11.2A6.5 6.5 0 018.8 3.5a6.5 6.5 0 107.7 7.7z" strokeLinejoin="round" /></svg>,
  sun: <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="3.5" /><path d="M10 1.5v2M10 16.5v2M3.3 3.3l1.4 1.4M15.3 15.3l1.4 1.4M1.5 10h2M16.5 10h2M3.3 16.7l1.4-1.4M15.3 4.7l1.4-1.4" strokeLinecap="round" /></svg>,
  plus: <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M10 4v12M4 10h12" /></svg>,
  trash: <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 5.5h13M8 5.5V4a1 1 0 011-1h2a1 1 0 011 1v1.5M6 5.5l.7 10a1 1 0 001 1h4.6a1 1 0 001-1l.7-10" /></svg>,
  back: <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11.5 5l-5 5 5 5" /></svg>,
}

export default function AdminPortal() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [view, setView] = useState('dashboard')
  const [busy, setBusy] = useState(false)
  const [toasts, setToasts] = useState([])

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('bm-admin-theme') || 'light' } catch { return 'light' }
  })

  const [counts, setCounts] = useState({})
  const [documents, setDocuments] = useState([])
  const [eventIds, setEventIds] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [original, setOriginal] = useState(null)
  const [draft, setDraft] = useState(null)
  const [rawMode, setRawMode] = useState(false)
  const [rawText, setRawText] = useState('')
  const [rawError, setRawError] = useState('')
  const [docQuery, setDocQuery] = useState('')

  const [submissions, setSubmissions] = useState([])
  const [projects, setProjects] = useState([])
  const [bipSection, setBipSection] = useState('projects')
  const [projectDraft, setProjectDraft] = useState(EMPTY_PROJECT)
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [projectQuery, setProjectQuery] = useState('')
  const [requestFilter, setRequestFilter] = useState('pending')
  const [openRequest, setOpenRequest] = useState(null)

  const [adminUsers, setAdminUsers] = useState([])
  const [newAccount, setNewAccount] = useState({ username: '', role: 'content_editor', password: '' })
  const [auditEntries, setAuditEntries] = useState([])
  const [auditQuery, setAuditQuery] = useState('')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const toastTimers = useRef(new Map())
  const pendingNew = useRef(null)

  const say = useCallback((message, tone = 'go') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts(list => [...list.slice(-2), { id, message, tone }])
    const timer = window.setTimeout(() => {
      setToasts(list => list.filter(toast => toast.id !== id))
      toastTimers.current.delete(id)
    }, tone === 'stop' ? 9000 : 4500)
    toastTimers.current.set(id, timer)
  }, [])

  const dismiss = useCallback(id => {
    window.clearTimeout(toastTimers.current.get(id))
    toastTimers.current.delete(id)
    setToasts(list => list.filter(toast => toast.id !== id))
  }, [])

  useEffect(() => () => {
    toastTimers.current.forEach(timer => window.clearTimeout(timer))
    toastTimers.current.clear()
  }, [])

  useEffect(() => { try { localStorage.setItem('bm-admin-theme', theme) } catch { /* ignore */ } }, [theme])

  const form = CONTENT_TYPES.includes(view) ? FORMS[view] : null
  const editing = Boolean(form) && Boolean(draft)
  const readOnly = Boolean(form) && !canEdit(user?.role, view)
  const dirty = Boolean(draft) && (!original || JSON.stringify(original) !== JSON.stringify(draft))
  const gaps = form && draft ? listRequiredGaps(form, draft) : []

  const clearEditor = useCallback(() => {
    setSelectedId(null)
    setOriginal(null)
    setDraft(null)
    setRawMode(false)
    setRawError('')
  }, [])

  const loadDocuments = useCallback(async type => {
    setBusy(true)
    try {
      const result = await request(`/api/admin/content?type=${encodeURIComponent(type)}`)
      setDocuments(result.documents || [])
    } catch (reason) {
      setDocuments([])
      say(reason.message, 'stop')
    } finally {
      setBusy(false)
    }
  }, [say])

  useEffect(() => {
    request('/api/auth/session')
      .then(result => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true))
  }, [])

  // Keep every role on a view it may open.
  useEffect(() => {
    if (!user || view === 'dashboard') return
    const allowed = ['build-in-public', 'accounts', 'audit'].includes(view)
      ? user.role === 'super_admin'
      : CONTENT_TYPES.includes(view) ? canView(user.role, view) : true
    if (!allowed) setView('dashboard')
  }, [user, view])

  useEffect(() => {
    if (!user) return
    clearEditor()
    setDocQuery('')
    setProjectFormOpen(false)

    if (view === 'dashboard') {
      const types = CONTENT_TYPES.filter(type => canView(user.role, type))
      setBusy(true)
      Promise.all(types.map(type =>
        request(`/api/admin/content?type=${type}`).then(result => [type, (result.documents || []).length]).catch(() => [type, 0]),
      ))
        .then(entries => setCounts(Object.fromEntries(entries)))
        .finally(() => setBusy(false))
      if (user.role === 'super_admin') {
        Promise.all([
          request('/api/admin/build-in-public').then(result => setSubmissions(result.submissions || [])).catch(() => {}),
          request('/api/admin/build-in-public-projects').then(result => setProjects(result.projects || [])).catch(() => {}),
        ])
      }
      return
    }
    if (view === 'build-in-public') {
      if (user.role !== 'super_admin') return
      setBusy(true)
      Promise.all([request('/api/admin/build-in-public'), request('/api/admin/build-in-public-projects')])
        .then(([applications, projectResult]) => {
          setSubmissions(applications.submissions || [])
          setProjects(projectResult.projects || [])
        })
        .catch(reason => { setSubmissions([]); setProjects([]); say(reason.message, 'stop') })
        .finally(() => setBusy(false))
      return
    }
    if (view === 'accounts') {
      if (user.role !== 'super_admin') return
      setBusy(true)
      request('/api/admin/users')
        .then(result => setAdminUsers(result.users || []))
        .catch(reason => { setAdminUsers([]); say(reason.message, 'stop') })
        .finally(() => setBusy(false))
      return
    }
    if (view === 'audit') {
      if (user.role !== 'super_admin') return
      setBusy(true)
      request('/api/admin/audit')
        .then(result => setAuditEntries(result.entries || []))
        .catch(reason => { setAuditEntries([]); say(reason.message, 'stop') })
        .finally(() => setBusy(false))
      return
    }
    if (CONTENT_TYPES.includes(view)) {
      loadDocuments(view)
      // Opened via a dashboard "+" — start a blank draft once we land here.
      if (pendingNew.current === view) {
        pendingNew.current = null
        setSelectedId(null)
        setOriginal(null)
        setDraft(blankDocument(view))
      }
    }
  }, [user, view, loadDocuments, clearEditor, say])

  useEffect(() => {
    if (view !== 'siteResult' || !user) return
    request('/api/admin/content?type=siteEvent')
      .then(result => setEventIds((result.documents || []).map(doc => doc.eventId || doc.slug?.current || doc._id).filter(Boolean)))
      .catch(() => setEventIds([]))
  }, [view, user])

  useEffect(() => {
    if (!dirty) return
    function onBeforeUnload(event) { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        if (!dirty || readOnly || !draft) return
        event.preventDefault()
        saveDocument()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  async function signIn(event) {
    event.preventDefault()
    setBusy(true)
    setLoginError('')
    try {
      const result = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      setUser(result.user)
      setPassword('')
    } catch (reason) {
      setLoginError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    try { await request('/api/auth/logout', { method: 'POST', body: '{}' }) }
    finally {
      setUser(null)
      setView('dashboard')
      setDocuments([])
      clearEditor()
      navigate('/kazi_binary_admins', { replace: true })
    }
  }

  function openDocument(doc) {
    setSelectedId(doc._id)
    setOriginal(doc)
    setDraft(doc)
    setRawMode(false)
    setRawError('')
  }

  function startNew() {
    setSelectedId(null)
    setOriginal(null)
    setDraft(blankDocument(view))
    setRawMode(false)
    setRawError('')
  }

  // Create a new doc in another collection, from the dashboard.
  function startNewIn(type) {
    if (type === view) { startNew(); return }
    pendingNew.current = type
    setView(type)
  }

  function leaveEditor() {
    if (dirty && !window.confirm('Leave this document? Your unsaved changes will be lost.')) return
    clearEditor()
  }

  function updateDraft(next) {
    setDraft(next)
    if (rawMode) setRawText(JSON.stringify(next, null, 2))
  }

  function toggleRaw() {
    if (!rawMode) setRawText(JSON.stringify(draft, null, 2))
    setRawError('')
    setRawMode(mode => !mode)
  }

  function onRawChange(text) {
    setRawText(text)
    try {
      setDraft(JSON.parse(text))
      setRawError('')
    } catch {
      setRawError('Not valid JSON yet, so the form still shows the last good version.')
    }
  }

  async function saveDocument(event) {
    event?.preventDefault()
    if (!draft || readOnly) return
    if (rawError) { say('Fix the JSON before saving.', 'stop'); return }
    const missing = listRequiredGaps(form, draft)
    if (missing.length) { say(`Add ${describe(missing)} before saving.`, 'stop'); return }
    if (draft.publicationStatus === 'published' && !canPublish(user.role)) {
      say('Your role cannot publish. Save it in review and ask an organizer to publish.', 'stop')
      return
    }

    setBusy(true)
    try {
      const isUpdate = Boolean(selectedId)
      const path = `/api/admin/content?type=${encodeURIComponent(view)}${isUpdate ? `&id=${encodeURIComponent(selectedId)}` : ''}`
      const result = await request(path, { method: isUpdate ? 'PUT' : 'POST', body: JSON.stringify(draft) })
      const saved = result.document
      say(isUpdate ? `${form.label} saved.` : `${form.label} created as a draft.`)
      await loadDocuments(view)
      if (saved?._id) {
        setSelectedId(saved._id)
        setOriginal(saved)
        setDraft(saved)
        if (rawMode) setRawText(JSON.stringify(saved, null, 2))
      }
    } catch (reason) {
      say(reason.message, 'stop')
    } finally {
      setBusy(false)
    }
  }

  async function deleteDocument() {
    if (!selectedId) return
    setBusy(true)
    try {
      await request(`/api/admin/content?type=${encodeURIComponent(view)}&id=${encodeURIComponent(selectedId)}`, { method: 'DELETE' })
      say(`${form.label} deleted.`)
      clearEditor()
      await loadDocuments(view)
    } catch (reason) {
      say(reason.message, 'stop')
    } finally {
      setBusy(false)
    }
  }

  async function refreshProjects() {
    try { setProjects((await request('/api/admin/build-in-public-projects')).projects || []) }
    catch (reason) { say(reason.message, 'stop') }
  }

  async function refreshSubmissions() {
    setBusy(true)
    try { setSubmissions((await request('/api/admin/build-in-public')).submissions || []) }
    catch (reason) { say(reason.message, 'stop') }
    finally { setBusy(false) }
  }

  function openProjectForm(project = null) {
    setEditingProjectId(project?.id || null)
    setProjectDraft(project
      ? { ...EMPTY_PROJECT, ...project, tags: Array.isArray(project.tags) ? project.tags : [] }
      : { ...EMPTY_PROJECT })
    setProjectFormOpen(true)
  }

  function closeProjectForm() {
    setEditingProjectId(null)
    setProjectDraft({ ...EMPTY_PROJECT })
    setProjectFormOpen(false)
  }

  async function saveProject(event) {
    event.preventDefault()
    setBusy(true)
    try {
      await request('/api/admin/build-in-public-projects', {
        method: editingProjectId ? 'PUT' : 'POST',
        body: JSON.stringify(editingProjectId ? { ...projectDraft, id: editingProjectId } : projectDraft),
      })
      await refreshProjects()
      say(editingProjectId ? 'Project saved.' : 'Project created.')
      closeProjectForm()
    } catch (reason) { say(reason.message, 'stop') }
    finally { setBusy(false) }
  }

  async function deleteProject(project) {
    setBusy(true)
    try {
      await request('/api/admin/build-in-public-projects', { method: 'DELETE', body: JSON.stringify({ id: project.id }) })
      await refreshProjects()
      if (editingProjectId === project.id) closeProjectForm()
      say('Project deleted.')
    } catch (reason) { say(reason.message, 'stop') }
    finally { setBusy(false) }
  }

  async function downloadAttachment(application) {
    if (!application.attachment) return
    setBusy(true)
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
      const link = window.document.createElement('a')
      link.href = url
      link.download = application.attachment.fileName
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (reason) { say(reason.message, 'stop') }
    finally { setBusy(false) }
  }

  async function reviewSubmission(id, status) {
    setBusy(true)
    try {
      const result = await request('/api/admin/build-in-public', { method: 'PATCH', body: JSON.stringify({ id, status }) })
      await refreshSubmissions()
      if (status === 'accepted' && !result.notification?.sent) {
        say(`Accepted, but the email did not go out. ${result.notification?.message || 'Check the email setup and retry.'}`, 'stop')
      } else if (status === 'accepted') {
        say(result.notification?.alreadySent ? 'Accepted. The email had already gone out.' : 'Accepted and email sent.')
      } else {
        say(`Request ${status}.`)
      }
    } catch (reason) { say(reason.message, 'stop') }
    finally { setBusy(false) }
  }

  async function deleteSubmission(submission) {
    setBusy(true)
    try {
      await request('/api/admin/build-in-public', { method: 'DELETE', body: JSON.stringify({ id: submission.id }) })
      await refreshSubmissions()
      say(`Request${submission.attachment ? ' and attachment' : ''} deleted.`)
    } catch (reason) { say(reason.message, 'stop') }
    finally { setBusy(false) }
  }

  async function addAdminUser(event) {
    event.preventDefault()
    setBusy(true)
    try {
      await request('/api/admin/users', { method: 'POST', body: JSON.stringify(newAccount) })
      setNewAccount({ username: '', role: 'content_editor', password: '' })
      setAdminUsers((await request('/api/admin/users')).users || [])
      say('Account added. Share the password with them securely.')
    } catch (reason) { say(reason.message, 'stop') }
    finally { setBusy(false) }
  }

  async function removeAdminUser(name) {
    setBusy(true)
    try {
      await request('/api/admin/users', { method: 'DELETE', body: JSON.stringify({ username: name }) })
      setAdminUsers((await request('/api/admin/users')).users || [])
      say(`${name} no longer has access.`)
    } catch (reason) { say(reason.message, 'stop') }
    finally { setBusy(false) }
  }

  const visibleDocuments = useMemo(() => {
    const needle = docQuery.trim().toLowerCase()
    if (!needle) return documents
    return documents.filter(doc => `${doc.title || ''} ${doc._id} ${doc.publicationStatus || ''}`.toLowerCase().includes(needle))
  }, [documents, docQuery])

  const visibleProjects = useMemo(() => {
    const needle = projectQuery.trim().toLowerCase()
    if (!needle) return projects
    return projects.filter(project => `${project.title} ${project.summary} ${(project.tags || []).join(' ')}`.toLowerCase().includes(needle))
  }, [projects, projectQuery])

  const requestCounts = useMemo(() => submissions.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, {}), [submissions])

  const visibleRequests = useMemo(() => (
    requestFilter === 'all' ? submissions : submissions.filter(item => item.status === requestFilter)
  ), [submissions, requestFilter])

  const visibleAudit = useMemo(() => {
    const needle = auditQuery.trim().toLowerCase()
    if (!needle) return auditEntries
    return auditEntries.filter(entry => `${entry.action} ${entry.actor} ${entry.role} ${entry.contentType || ''} ${entry.documentId || ''}`.toLowerCase().includes(needle))
  }, [auditEntries, auditQuery])

  /* ---------------------------------------------------------------- boot */

  if (!authChecked) {
    return <main className="admin-boot" data-theme={theme}><span className="admin-spinner" />Checking your session</main>
  }

  if (!user) {
    return (
      <main className="admin-gate" data-theme={theme}>
        <section className="admin-gate-card" aria-labelledby="admin-gate-title">
          <a className="admin-gate-brand" href="/"><img src="/binary-minds-logo.jpg" alt="" /><span>Binary Minds</span></a>
          <h1 id="admin-gate-title">Sign in</h1>
          <p className="admin-lede">Manage events, results, announcements and Build in Public.</p>
          {loginError && <div className="admin-alert" role="alert">{loginError}</div>}
          <form onSubmit={signIn} className="admin-gate-form">
            <Field label="Username" htmlFor="admin-user">
              <TextInput id="admin-user" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required />
            </Field>
            <Field label="Password" htmlFor="admin-pass">
              <PasswordInput id="admin-pass" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
            </Field>
            <button className="ks-btn ks-btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <a className="admin-gate-back" href="/">← Back to the site</a>
        </section>
      </main>
    )
  }

  /* --------------------------------------------------------------- nav */

  const navGroups = [
    { items: [{ key: 'dashboard', label: 'Dashboard', show: true }] },
    { label: 'Content', items: CONTENT_TYPES.map(type => ({ key: type, label: FORMS[type].plural, show: canView(user.role, type) })) },
    { label: 'Community', items: [{ key: 'build-in-public', label: 'Build in Public', badge: requestCounts.pending, show: user.role === 'super_admin' }] },
    { label: 'Admin', items: [
      { key: 'accounts', label: 'Access', show: user.role === 'super_admin' },
      { key: 'audit', label: 'Activity log', show: user.role === 'super_admin' },
    ] },
  ]

  const title = view === 'dashboard' ? 'Dashboard'
    : view === 'build-in-public' ? 'Build in Public'
      : view === 'accounts' ? 'Access'
        : view === 'audit' ? 'Activity log'
          : form?.plural

  return (
    <main className="admin-shell" data-theme={theme}>
      <a className="admin-skip" href="#admin-work">Skip to content</a>

      <aside className="ks-rail">
        <div className="ks-rail-top">
          <a className="ks-brand" href="/">
            <span className="ks-brand-badge"><img src="/binary-minds-logo.jpg" alt="" /></span>
            <span className="ks-brand-name">Binary Minds</span>
          </a>
          <button className="ks-iconbtn ks-theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title="Toggle theme">
            {theme === 'dark' ? Ic.sun : Ic.moon}
          </button>
        </div>

        <nav className="ks-nav" aria-label="Sections">
          {navGroups.map((group, index) => {
            const items = group.items.filter(item => item.show)
            if (!items.length) return null
            return (
              <div className="ks-nav-group" key={group.label || index}>
                {group.label && <p className="ks-nav-label">{group.label}</p>}
                {items.map(item => (
                  <button
                    key={item.key}
                    type="button"
                    className={`ks-nav-item${view === item.key ? ' is-on' : ''}`}
                    aria-current={view === item.key ? 'page' : undefined}
                    onClick={() => setView(item.key)}
                  >
                    <span>{item.label}</span>
                    {item.badge > 0 && <span className="ks-nav-badge">{item.badge}</span>}
                  </button>
                ))}
              </div>
            )
          })}
        </nav>

        <div className="ks-whoami">
          <span className="ks-whoami-name">{user.username}</span>
          <span className="ks-whoami-role">{user.role.replaceAll('_', ' ')}</span>
          <button type="button" className="ks-signout" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <div className="ks-main" id="admin-work">
        <div className="ks-main-inner">

          {/* ---------------- Dashboard ---------------- */}
          {view === 'dashboard' && (
            <>
              <div className="ks-head"><h1 className="ks-title">Dashboard</h1></div>

              <section className="ks-dash-group">
                <p className="ks-dash-label">Content</p>
                <div className="ks-dash-grid">
                  {CONTENT_TYPES.filter(type => canView(user.role, type)).map(type => (
                    <div className="ks-card" key={type} role="button" tabIndex={0}
                      onClick={() => setView(type)}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setView(type) } }}>
                      <span className="ks-card-main">
                        <span className="ks-card-title">{FORMS[type].plural}</span>
                        <span className="ks-card-meta">{counts[type] ?? '—'} {counts[type] === 1 ? 'entry' : 'entries'}</span>
                      </span>
                      {canEdit(user.role, type) && (
                        <button type="button" className="ks-card-add" aria-label={`New ${FORMS[type].label.toLowerCase()}`}
                          onClick={event => { event.stopPropagation(); startNewIn(type) }}>{Ic.plus}</button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {user.role === 'super_admin' && (
                <section className="ks-dash-group">
                  <p className="ks-dash-label">Community</p>
                  <div className="ks-dash-grid">
                    <div className="ks-card" role="button" tabIndex={0}
                      onClick={() => { setBipSection('projects'); setView('build-in-public') }}
                      onKeyDown={event => { if (event.key === 'Enter') setView('build-in-public') }}>
                      <span className="ks-card-main">
                        <span className="ks-card-title">Build in Public</span>
                        <span className="ks-card-meta">{projects.length} projects · {requestCounts.pending || 0} waiting</span>
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {user.role === 'super_admin' && (
                <section className="ks-dash-group">
                  <p className="ks-dash-label">Admin</p>
                  <div className="ks-dash-grid">
                    <div className="ks-card" role="button" tabIndex={0} onClick={() => setView('accounts')} onKeyDown={e => { if (e.key === 'Enter') setView('accounts') }}>
                      <span className="ks-card-main"><span className="ks-card-title">Access</span><span className="ks-card-meta">People who can sign in</span></span>
                    </div>
                    <div className="ks-card" role="button" tabIndex={0} onClick={() => setView('audit')} onKeyDown={e => { if (e.key === 'Enter') setView('audit') }}>
                      <span className="ks-card-main"><span className="ks-card-title">Activity log</span><span className="ks-card-meta">Recent actions</span></span>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {/* ---------------- Content: list ---------------- */}
          {form && !editing && (
            <>
              <div className="ks-head">
                <h1 className="ks-title">{form.plural}</h1>
                <div className="ks-head-actions">
                  <Search value={docQuery} onChange={setDocQuery} placeholder={`Search ${form.plural.toLowerCase()}`} />
                  {!readOnly && <button type="button" className="ks-btn ks-btn-primary" onClick={() => startNew()}>{Ic.plus} Add</button>}
                </div>
              </div>

              {busy && !documents.length ? <p className="admin-quiet">Loading…</p>
                : visibleDocuments.length ? (
                  <div className="ks-table-wrap">
                    <table className="ks-table">
                      <thead><tr><th>Title</th><th>Stage</th><th>Slug</th><th>On site</th></tr></thead>
                      <tbody>
                        {visibleDocuments.map(doc => (
                          <tr key={doc._id} onClick={() => openDocument(doc)}>
                            <td className="ks-cell-title">{doc.title || 'Untitled'}</td>
                            <td><Pill tone={stageTone(doc.publicationStatus)}>{stageLabel(doc.publicationStatus)}</Pill></td>
                            <td className="ks-cell-slug">{doc.slug?.current || doc._id}</td>
                            <td><span className="ks-live"><StatusDot tone={doc.publicationStatus === 'published' ? 'go' : 'off'} />{doc.publicationStatus === 'published' ? 'Live' : 'Hidden'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty title={docQuery ? 'Nothing matches that' : `No ${form.plural.toLowerCase()} yet`} action={!readOnly && !docQuery && <button type="button" className="ks-btn ks-btn-primary" onClick={() => startNew()}>{Ic.plus} Add {form.label.toLowerCase()}</button>}>
                    {form.blurb}
                  </Empty>
                )}
            </>
          )}

          {/* ---------------- Content: edit ---------------- */}
          {form && editing && (
            <form onSubmit={saveDocument} className="ks-edit">
              <div className="ks-head">
                <div className="ks-crumb">
                  <button type="button" className="ks-iconbtn" onClick={leaveEditor} aria-label="Back to list">{Ic.back}</button>
                  <button type="button" onClick={leaveEditor}>{form.plural}</button>
                  <span className="ks-crumb-sep">/</span>
                  <span className="ks-crumb-now">{draft.title || `New ${form.label.toLowerCase()}`}</span>
                </div>
                <div className="ks-edit-toolbar">
                  <button type="button" className={`ks-btn ks-btn-ghost ks-btn-sm${rawMode ? ' is-on' : ''}`} onClick={toggleRaw} aria-pressed={rawMode}>JSON</button>
                  {selectedId && user.role === 'super_admin' && (
                    <Confirm onConfirm={deleteDocument} disabled={busy} confirmLabel={`Delete this ${form.label.toLowerCase()}`}>{Ic.trash}</Confirm>
                  )}
                  {!readOnly && <button type="submit" className="ks-btn ks-btn-primary" disabled={busy || !dirty || gaps.length > 0}>{busy ? 'Saving…' : 'Save'}</button>}
                </div>
              </div>

              <div className="ks-stage-row">
                <span>Visibility</span>
                <PublishRail
                  value={draft.publicationStatus || 'draft'}
                  stages={PUBLICATION_STAGES}
                  readOnly={readOnly}
                  locked={canPublish(user.role) ? [] : ['published']}
                  lockedNote="You can take this to review. An organizer publishes it."
                  onChange={stage => updateDraft({ ...draft, publicationStatus: stage })}
                />
              </div>

              {readOnly && <p className="admin-alert" style={{ marginBottom: 24 }}>Your role can read this but not change it.</p>}

              {rawMode ? (
                <div className="ks-raw">
                  <TextArea rows={22} spellCheck="false" className="actrl actrl-area actrl-mono" value={rawText} onChange={event => onRawChange(event.target.value)} readOnly={readOnly} />
                  {rawError && <p className="ks-raw-error">{rawError}</p>}
                </div>
              ) : (
                <DocumentForm form={form} document={draft} onChange={updateDraft} sources={{ events: eventIds }} readOnly={readOnly} />
              )}

              {!readOnly && dirty && (
                <div className="ks-savebar">
                  <span className="ks-savebar-state">
                    Unsaved changes{gaps.length > 0 && <> · <em>needs {describe(gaps)}</em></>}
                  </span>
                  <div className="ks-savebar-actions">
                    {original && <button type="button" className="ks-btn ks-btn-ghost ks-btn-sm" onClick={() => updateDraft(original)}>Discard</button>}
                    <button type="submit" className="ks-btn ks-btn-primary ks-btn-sm" disabled={busy || gaps.length > 0}>{busy ? 'Saving…' : selectedId ? 'Save changes' : 'Create'}</button>
                  </div>
                </div>
              )}
            </form>
          )}

          {/* ---------------- Build in Public ---------------- */}
          {view === 'build-in-public' && (
            <>
              <div className="ks-head">
                <h1 className="ks-title">Build in Public</h1>
                <div className="ks-head-actions">
                  {bipSection === 'projects'
                    ? <button type="button" className="ks-btn ks-btn-primary" onClick={() => openProjectForm()}>{Ic.plus} Add project</button>
                    : <button type="button" className="ks-btn ks-btn-ghost" disabled={busy} onClick={refreshSubmissions}>Refresh</button>}
                </div>
              </div>

              <nav className="ks-tabs" aria-label="Build in Public sections">
                <button type="button" className={bipSection === 'projects' ? 'is-on' : ''} onClick={() => setBipSection('projects')}>Projects <span>{projects.length}</span></button>
                <button type="button" className={bipSection === 'applications' ? 'is-on' : ''} onClick={() => setBipSection('applications')}>Requests {requestCounts.pending > 0 && <span className="is-live">{requestCounts.pending}</span>}</button>
              </nav>

              {bipSection === 'projects' ? (
                projectFormOpen ? (
                  <form className="ks-edit" onSubmit={saveProject}>
                    <div className="ks-head">
                      <div className="ks-crumb">
                        <button type="button" className="ks-iconbtn" onClick={closeProjectForm} aria-label="Back">{Ic.back}</button>
                        <button type="button" onClick={closeProjectForm}>Projects</button>
                        <span className="ks-crumb-sep">/</span>
                        <span className="ks-crumb-now">{projectDraft.title || (editingProjectId ? 'Edit project' : 'New project')}</span>
                      </div>
                      <button type="submit" className="ks-btn ks-btn-primary" disabled={busy}>{busy ? 'Saving…' : editingProjectId ? 'Save' : 'Create'}</button>
                    </div>

                    <div className="ks-stage-row">
                      <span>Visibility</span>
                      <PublishRail value={projectDraft.status} stages={PROJECT_VISIBILITY} onChange={stage => setProjectDraft({ ...projectDraft, status: stage })} />
                    </div>

                    <div className="afield-grid">
                      <Field label="Project name" required htmlFor="bip-title" wide>
                        <TextInput id="bip-title" value={projectDraft.title} maxLength={140} required onChange={event => setProjectDraft({ ...projectDraft, title: event.target.value })} />
                        <Counter value={projectDraft.title} max={140} />
                      </Field>
                      <Field label="What it is" required htmlFor="bip-summary" wide hint="Shown on the public card.">
                        <TextArea id="bip-summary" rows={4} maxLength={1200} required value={projectDraft.summary} onChange={event => setProjectDraft({ ...projectDraft, summary: event.target.value })} />
                        <Counter value={projectDraft.summary} max={1200} />
                      </Field>
                      <Field label="How to contribute" required htmlFor="bip-guidelines" wide hint="Shown with the project and in its request form.">
                        <TextArea id="bip-guidelines" rows={4} maxLength={1200} required value={projectDraft.guidelines} onChange={event => setProjectDraft({ ...projectDraft, guidelines: event.target.value })} />
                        <Counter value={projectDraft.guidelines} max={1200} />
                      </Field>
                      <Field label="Track" htmlFor="bip-category" hint="Groups the project on the public ledger.">
                        <Combo id="bip-category" value={projectDraft.category} options={PROJECT_CATEGORIES} placeholder="Pick or type a track" onChange={next => setProjectDraft({ ...projectDraft, category: next })} />
                      </Field>
                      <Field label="Difficulty">
                        <Segmented name="Difficulty" value={projectDraft.difficulty} options={PROJECT_DIFFICULTIES} onChange={next => setProjectDraft({ ...projectDraft, difficulty: next === projectDraft.difficulty ? '' : next })} />
                      </Field>
                      <Field label="Tags" htmlFor="bip-tags" wide hint="Press Enter after each tag, or tap a suggestion.">
                        <Chips id="bip-tags" value={projectDraft.tags} suggestions={TAG_SUGGESTIONS} placeholder="Type a tag and press Enter" onChange={next => setProjectDraft({ ...projectDraft, tags: next })} />
                      </Field>
                      <Field label="Owner name" htmlFor="bip-owner" hint="Shown as the project byline.">
                        <TextInput id="bip-owner" value={projectDraft.authorName} maxLength={80} placeholder="Binary Minds Core" onChange={event => setProjectDraft({ ...projectDraft, authorName: event.target.value })} />
                      </Field>
                      <Field label="Owner role" htmlFor="bip-owner-role">
                        <TextInput id="bip-owner-role" value={projectDraft.authorRole} maxLength={80} placeholder="Maintainers" onChange={event => setProjectDraft({ ...projectDraft, authorRole: event.target.value })} />
                      </Field>
                      <Field label="Repository" htmlFor="bip-repo" wide hint="Full https:// link to the code.">
                        <TextInput id="bip-repo" type="url" value={projectDraft.repositoryUrl} placeholder="https://github.com/organization/project" onChange={event => setProjectDraft({ ...projectDraft, repositoryUrl: event.target.value })} />
                      </Field>
                      <Field label="Cover image" htmlFor="bip-image" wide hint="Google Drive image set to “anyone with the link can view”.">
                        <TextInput id="bip-image" type="url" value={projectDraft.imageDriveUrl} placeholder="https://drive.google.com/file/d/…" onChange={event => setProjectDraft({ ...projectDraft, imageDriveUrl: event.target.value })} />
                      </Field>
                      <Field label="Owner avatar" htmlFor="bip-avatar" wide hint="Optional Google Drive image link.">
                        <TextInput id="bip-avatar" type="url" value={projectDraft.authorAvatarUrl} placeholder="https://drive.google.com/file/d/…" onChange={event => setProjectDraft({ ...projectDraft, authorAvatarUrl: event.target.value })} />
                      </Field>
                    </div>

                    <div className="ks-savebar">
                      <span className="ks-savebar-state">{editingProjectId ? 'Editing a project' : 'New project — saved as a draft'}</span>
                      <div className="ks-savebar-actions">
                        <button type="button" className="ks-btn ks-btn-ghost ks-btn-sm" onClick={closeProjectForm}>Cancel</button>
                        <button type="submit" className="ks-btn ks-btn-primary ks-btn-sm" disabled={busy}>{busy ? 'Saving…' : editingProjectId ? 'Save' : 'Create'}</button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <>
                    <div style={{ marginBottom: 16 }}><Search value={projectQuery} onChange={setProjectQuery} placeholder="Search projects" /></div>
                    {busy && !projects.length ? <p className="admin-quiet">Loading…</p>
                      : visibleProjects.length ? (
                        <div className="ks-table-wrap">
                          <table className="ks-table">
                            <thead><tr><th>Project</th><th>Stage</th><th>Track</th><th /></tr></thead>
                            <tbody>
                              {visibleProjects.map(project => (
                                <tr key={project.id} onClick={() => openProjectForm(project)}>
                                  <td className="ks-cell-title">{project.title}</td>
                                  <td><Pill tone={PROJECT_VISIBILITY.find(stage => stage.value === project.status)?.tone || 'off'}>{project.status}</Pill></td>
                                  <td className="ks-cell-muted">{project.category || '—'}</td>
                                  <td onClick={event => event.stopPropagation()} style={{ textAlign: 'right' }}>
                                    <Confirm onConfirm={() => deleteProject(project)} disabled={busy} confirmLabel="Delete">Delete</Confirm>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <Empty title={projectQuery ? 'Nothing matches that' : 'No projects yet'} action={!projectQuery && <button type="button" className="ks-btn ks-btn-primary" onClick={() => openProjectForm()}>{Ic.plus} Add project</button>}>Published projects appear on the public Build in Public page.</Empty>}
                  </>
                )
              ) : (
                <section className="ks-queue">
                  <div className="ks-queue-filters" role="group" aria-label="Filter requests">
                    {[{ key: 'pending', label: 'Waiting' }, { key: 'accepted', label: 'Accepted' }, { key: 'rejected', label: 'Rejected' }, { key: 'all', label: 'All' }].map(option => (
                      <button key={option.key} type="button" className={requestFilter === option.key ? 'is-on' : ''} onClick={() => setRequestFilter(option.key)}>
                        {option.label}<span>{option.key === 'all' ? submissions.length : requestCounts[option.key] || 0}</span>
                      </button>
                    ))}
                  </div>

                  {busy && !submissions.length ? <p className="admin-quiet">Loading…</p>
                    : visibleRequests.length ? visibleRequests.map(submission => {
                      const expanded = openRequest === submission.id
                      const github = safeExternalUrl(submission.githubProfile)
                      const linkedin = safeExternalUrl(submission.linkedinProfile)
                      return (
                        <article className="ks-request" key={submission.id}>
                          <div className="ks-request-who">
                            <Pill tone={submission.status === 'accepted' ? 'go' : submission.status === 'rejected' ? 'stop' : 'hold'}>{submission.status}</Pill>
                            <h2>{submission.fullName}</h2>
                            <time>{new Date(submission.createdAt).toLocaleDateString()}</time>
                          </div>
                          <p className="ks-request-for">wants to work on <strong>{submission.project || 'Binary Minds Open AI Agent Framework'}</strong></p>
                          <p className="ks-request-contact">
                            <a href={`mailto:${submission.studentEmail}`}>{submission.studentEmail}</a>
                            {github && <a href={github} target="_blank" rel="noopener noreferrer">GitHub</a>}
                            {linkedin && <a href={linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>}
                          </p>
                          {submission.status === 'accepted' && (
                            <p className={`ks-request-email ${submission.emailNotificationStatus === 'sent' ? 'is-sent' : 'is-failed'}`}>
                              {submission.emailNotificationStatus === 'sent' ? 'Acceptance email sent.'
                                : submission.emailNotificationStatus === 'failed' ? `Acceptance email failed. ${submission.emailNotificationError || 'Check the email setup and retry.'}`
                                  : 'Acceptance email has not gone out yet.'}
                            </p>
                          )}
                          <button type="button" className="ks-request-more" aria-expanded={expanded} onClick={() => setOpenRequest(expanded ? null : submission.id)}>
                            {expanded ? 'Hide what they wrote' : 'Read what they wrote'}
                          </button>
                          {expanded && (
                            <div className="ks-request-body">
                              <h3>Why they want to contribute</h3><p>{submission.motivation}</p>
                              <h3>What they would build</h3><p>{submission.contributionIdea}</p>
                              {submission.attachment && <button type="button" className="ks-btn ks-btn-ghost ks-btn-sm" disabled={busy} onClick={() => downloadAttachment(submission)}>Download {submission.attachment.fileName} ({(submission.attachment.size / 1024 / 1024).toFixed(1)} MB)</button>}
                            </div>
                          )}
                          <div className="ks-request-actions">
                            {submission.status !== 'accepted' && <button type="button" className="ks-btn ks-btn-primary ks-btn-sm" disabled={busy} onClick={() => reviewSubmission(submission.id, 'accepted')}>Accept &amp; email</button>}
                            {submission.status === 'accepted' && submission.emailNotificationStatus !== 'sent' && <button type="button" className="ks-btn ks-btn-ghost ks-btn-sm" disabled={busy} onClick={() => reviewSubmission(submission.id, 'accepted')}>Retry email</button>}
                            {submission.status !== 'rejected' && <Confirm onConfirm={() => reviewSubmission(submission.id, 'rejected')} disabled={busy} confirmLabel="Reject">Reject</Confirm>}
                            <Confirm onConfirm={() => deleteSubmission(submission)} disabled={busy} confirmLabel={submission.attachment ? 'Delete + attachment' : 'Delete permanently'}>Delete</Confirm>
                          </div>
                        </article>
                      )
                    }) : <Empty title={requestFilter === 'pending' ? 'Nothing waiting on you' : 'Nothing here'}>{requestFilter === 'pending' ? 'New contribution requests show up here.' : 'Try another filter.'}</Empty>}
                </section>
              )}
            </>
          )}

          {/* ---------------- Access ---------------- */}
          {view === 'accounts' && (
            <>
              <div className="ks-head"><h1 className="ks-title">Access</h1></div>
              <div className="ks-table-wrap" style={{ marginBottom: 26 }}>
                {busy && !adminUsers.length ? <p className="admin-quiet" style={{ padding: 18 }}>Loading…</p> : adminUsers.map(account => (
                  <div className="ks-account" key={account.username}>
                    <span className="ks-account-id">
                      <strong>{account.username}</strong>
                      <small>{account.role.replaceAll('_', ' ')} · {account.managed ? 'added here' : 'server account'}</small>
                    </span>
                    {account.managed && <Confirm onConfirm={() => removeAdminUser(account.username)} disabled={busy} confirmLabel="Remove">Remove</Confirm>}
                  </div>
                ))}
              </div>

              <form className="ks-edit" onSubmit={addAdminUser}>
                <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 650 }}>Give someone access</h2>
                <div className="afield-grid">
                  <Field label="Email or username" required htmlFor="acc-name" wide>
                    <TextInput id="acc-name" autoComplete="off" value={newAccount.username} required onChange={event => setNewAccount({ ...newAccount, username: event.target.value })} />
                  </Field>
                  <Field label="Initial password" required htmlFor="acc-pass" wide hint="At least 14 characters. Share it with them securely.">
                    <PasswordInput id="acc-pass" autoComplete="new-password" minLength={14} value={newAccount.password} required onChange={event => setNewAccount({ ...newAccount, password: event.target.value })} />
                  </Field>
                  <div className="afield afield-wide">
                    <span className="afield-label">What they can do</span>
                    <OptionCards name="Role" value={newAccount.role} options={ADMIN_ROLES} onChange={role => setNewAccount({ ...newAccount, role })} />
                  </div>
                </div>
                <div className="ks-savebar">
                  <span className="ks-savebar-state">Only a Super Admin can add accounts.</span>
                  <button type="submit" className="ks-btn ks-btn-primary ks-btn-sm" disabled={busy}>{busy ? 'Adding…' : 'Add account'}</button>
                </div>
              </form>
            </>
          )}

          {/* ---------------- Activity log ---------------- */}
          {view === 'audit' && (
            <>
              <div className="ks-head">
                <h1 className="ks-title">Activity log</h1>
                <div className="ks-head-actions">
                  <Search value={auditQuery} onChange={setAuditQuery} placeholder="Search actions" />
                  <button type="button" className="ks-btn ks-btn-ghost" disabled={busy} onClick={() => request('/api/admin/audit').then(result => setAuditEntries(result.entries || [])).catch(reason => say(reason.message, 'stop'))}>Refresh</button>
                </div>
              </div>
              {busy && !auditEntries.length ? <p className="admin-quiet">Loading…</p>
                : visibleAudit.length ? (
                  <div className="ks-log">
                    {visibleAudit.map((entry, index) => (
                      <div className="ks-log-row" key={`${entry.at}-${index}`}>
                        <code className="ks-log-action">{entry.action}</code>
                        <span className="ks-log-actor">{entry.actor}<small>{entry.role?.replaceAll('_', ' ')}</small></span>
                        <code className="ks-log-target">{entry.contentType ? `${entry.contentType}${entry.documentId ? ` · ${entry.documentId}` : ''}` : 'authentication'}</code>
                        <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
                      </div>
                    ))}
                  </div>
                ) : <p className="admin-quiet">{auditQuery ? 'Nothing matches that.' : 'No activity recorded yet.'}</p>}
            </>
          )}

        </div>
      </div>

      <Toasts items={toasts} onDismiss={dismiss} />
    </main>
  )
}
