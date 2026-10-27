import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { imageUrl } from './media'

// Shared controls for the admin portal. Each one does a single job and states the
// consequence of using it, so an organizer never has to guess what a field accepts.

export function Field({ label, hint, required, optional, htmlFor, children, wide }) {
  return (
    <div className={`afield${wide ? ' afield-wide' : ''}`}>
      <label className="afield-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="afield-req" title="Required">Required</span>}
        {optional && !required && <span className="afield-opt">Optional</span>}
      </label>
      {children}
      {hint && <p className="afield-hint">{hint}</p>}
    </div>
  )
}

export function TextInput({ mono, ...props }) {
  return <input className={`actrl${mono ? ' actrl-mono' : ''}`} {...props} />
}

export function TextArea({ rows = 4, ...props }) {
  return <textarea className="actrl actrl-area" rows={rows} {...props} />
}

// Password field with a show/hide toggle, so you can check what you typed
// before submitting. Defaults to hidden.
export function PasswordInput({ id, value, onChange, autoComplete, minLength, required, placeholder }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="apass">
      <input
        id={id}
        className="actrl"
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        className="apass-toggle"
        aria-pressed={shown}
        aria-label={shown ? 'Hide password' : 'Show password'}
        title={shown ? 'Hide password' : 'Show password'}
        onClick={() => setShown(value => !value)}
      >
        {shown ? (
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 2.5l15 15" />
            <path d="M8.1 4.4A8 8 0 0110 4.3c4.4 0 7.4 4 8.3 5.7a1 1 0 010 .9 15 15 0 01-2 2.8" />
            <path d="M12.2 12.5A3 3 0 017.6 8" />
            <path d="M5.3 5.5A14 14 0 001.7 9.9a1 1 0 000 .9c.9 1.7 3.9 5.7 8.3 5.7a8 8 0 003.1-.6" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.7 10.4a1 1 0 010-.9C2.6 7.8 5.6 3.8 10 3.8s7.4 4 8.3 5.7a1 1 0 010 .9c-.9 1.7-3.9 5.7-8.3 5.7s-7.4-4-8.3-5.7z" />
            <circle cx="10" cy="10" r="2.6" />
          </svg>
        )}
      </button>
    </div>
  )
}

export function Counter({ value, max }) {
  if (!max) return null
  const used = String(value || '').length
  return <span className={`acount${used > max * 0.9 ? ' is-near' : ''}`}>{used}/{max}</span>
}

// A pill row instead of a dropdown: every choice and its colour are visible at once.
export function Segmented({ value, options, onChange, name, disabled }) {
  return (
    <div className="aseg" role="radiogroup" aria-label={name}>
      {options.map(option => {
        const active = String(value) === String(option.value)
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={`aseg-item${active ? ' is-on' : ''}`}
            data-tone={option.tone || 'signal'}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ checked, onChange, label, id, disabled }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={Boolean(checked)}
      className={`aswitch${checked ? ' is-on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="aswitch-track"><span className="aswitch-knob" /></span>
      <span className="aswitch-text">{label}</span>
    </button>
  )
}

// Type to filter, or open the list and pick. Free text is always allowed, because
// a new event format should not need a code change.
export function Combo({ value, options, onChange, placeholder, mono, id }) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const [typed, setTyped] = useState(null)
  const wrapRef = useRef(null)
  const text = typed == null ? (value || '') : typed

  const matches = useMemo(() => {
    const needle = (typed || '').trim().toLowerCase()
    if (!needle) return options
    return options.filter(option => option.toLowerCase().includes(needle))
  }, [options, typed])

  useEffect(() => {
    if (!open) return
    function onDocDown(event) {
      if (!wrapRef.current?.contains(event.target)) { setOpen(false); setTyped(null) }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  function commit(next) {
    onChange(next)
    setTyped(null)
    setOpen(false)
    setCursor(-1)
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setCursor(index => Math.min(index + 1, matches.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor(index => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && open && cursor >= 0 && matches[cursor]) {
      event.preventDefault()
      commit(matches[cursor])
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      setTyped(null)
    }
  }

  return (
    <div className="acombo" ref={wrapRef}>
      <input
        id={id}
        className={`actrl${mono ? ' actrl-mono' : ''}`}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onChange={event => { setTyped(event.target.value); onChange(event.target.value); setOpen(true); setCursor(-1) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <button type="button" className="acombo-toggle" aria-label={open ? 'Hide choices' : 'Show choices'} onClick={() => setOpen(value => !value)}>
        <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
      {open && matches.length > 0 && (
        <ul className="acombo-list" role="listbox">
          {matches.map((option, index) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                className={`acombo-option${index === cursor ? ' is-cursor' : ''}${option === value ? ' is-on' : ''}`}
                onMouseEnter={() => setCursor(index)}
                onClick={() => commit(option)}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Tags as removable tokens with one-tap suggestions, instead of a comma-separated
// string the writer has to punctuate correctly.
export function Chips({ value, onChange, suggestions = [], placeholder, id, disabled }) {
  const [entry, setEntry] = useState('')
  const tags = Array.isArray(value) ? value : []
  const open = suggestions.filter(tag => !tags.includes(tag))

  function add(tag) {
    const clean = tag.trim()
    if (!clean || tags.includes(clean)) { setEntry(''); return }
    onChange([...tags, clean])
    setEntry('')
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add(entry)
    } else if (event.key === 'Backspace' && !entry && tags.length) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="achips">
      <div className="achips-well">
        {tags.map(tag => (
          <span className="achip" key={tag}>
            {tag}
            {!disabled && <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(tags.filter(item => item !== tag))}>&times;</button>}
          </span>
        ))}
        <input
          id={id}
          className="achips-entry"
          disabled={disabled}
          value={entry}
          placeholder={tags.length ? '' : placeholder}
          onChange={event => setEntry(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => entry && add(entry)}
        />
      </div>
      {open.length > 0 && !disabled && (
        <div className="achips-suggest">
          <span>Add</span>
          {open.slice(0, 8).map(tag => (
            <button type="button" key={tag} onClick={() => add(tag)}>+ {tag}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export function RankPicker({ value, options, onChange, disabled }) {
  return (
    <div className="arank" role="radiogroup" aria-label="Place">
      {options.map(option => {
        const active = Number(value) === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={`arank-item${active ? ' is-on' : ''}`}
            disabled={disabled}
            onClick={() => onChange(option)}
          >
            <span className="arank-medal" aria-hidden="true">{option.badgeIcon}</span>
            <span>{option.rankTitle}</span>
          </button>
        )
      })}
    </div>
  )
}

// Controlled when given `open` and `onToggle`; otherwise it keeps its own state
// from `defaultOpen`, so a fixed form can use it without wiring up a reducer.
export function Section({ title, count, open, onToggle, defaultOpen = false, children, tone }) {
  const id = useId()
  const [ownOpen, setOwnOpen] = useState(defaultOpen)
  const controlled = onToggle != null && open != null
  const isOpen = controlled ? open : ownOpen
  const toggle = controlled ? onToggle : () => setOwnOpen(value => !value)

  return (
    <section className={`asection${isOpen ? ' is-open' : ''}`} data-tone={tone}>
      <h3>
        <button type="button" className="asection-head" aria-expanded={isOpen} aria-controls={id} onClick={toggle}>
          <svg className="asection-caret" viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          <span>{title}</span>
          {count != null && <span className="asection-count">{count}</span>}
        </button>
      </h3>
      <div className="asection-body" id={id} hidden={!isOpen}>{children}</div>
    </section>
  )
}

// The publish rail: status display, status control and workflow explanation in one
// element. Publication is the only field with public consequence, so it is not
// allowed to hide inside a dropdown.
export function PublishRail({ value, stages, onChange, readOnly, locked = [], lockedNote }) {
  const current = stages.findIndex(stage => stage.value === value)
  const active = stages[current] || stages[0]
  return (
    <div className="arail" data-tone={active.tone}>
      <div className="arail-track" role="radiogroup" aria-label="Publication stage">
        {stages.map((stage, index) => {
          const isOn = stage.value === value
          const isLocked = readOnly || locked.includes(stage.value)
          return (
            <button
              key={stage.value}
              type="button"
              role="radio"
              aria-checked={isOn}
              className={`arail-stop${isOn ? ' is-on' : ''}${index < current ? ' is-past' : ''}`}
              data-tone={stage.tone}
              disabled={isLocked}
              title={isLocked ? lockedNote : stage.note}
              onClick={() => onChange(stage.value)}
            >
              <span className="arail-dot" aria-hidden="true" />
              <span className="arail-name">{stage.label}</span>
            </button>
          )
        })}
      </div>
      <p className="arail-note">{locked.length > 0 && !readOnly ? lockedNote : active.note}</p>
    </div>
  )
}

// Choices that each need a sentence of explanation, such as what a role may do.
export function OptionCards({ value, options, onChange, name }) {
  return (
    <div className="acards" role="radiogroup" aria-label={name}>
      {options.map(option => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={`acard${active ? ' is-on' : ''}`}
            onClick={() => onChange(option.value)}
          >
            <span className="acard-mark" aria-hidden="true" />
            <span className="acard-text">
              <strong>{option.label}</strong>
              <small>{option.note}</small>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function StatusDot({ tone, title }) {
  return <span className="adot" data-tone={tone} title={title} aria-hidden="true" />
}

export function Pill({ tone, children }) {
  return <span className="apill" data-tone={tone}>{children}</span>
}

// Two-step destructive action. Replaces window.confirm, which cannot say what is
// about to happen in the product's own words.
export function Confirm({ children, onConfirm, label = 'Delete', confirmLabel = 'Yes, delete', disabled, className = 'adanger' }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const timer = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(timer)
  }, [armed])

  if (!armed) {
    return (
      <button type="button" className={className} disabled={disabled} onClick={() => setArmed(true)}>
        {children || label}
      </button>
    )
  }
  return (
    <span className="aconfirm">
      <button type="button" className="aconfirm-yes" disabled={disabled} onClick={() => { setArmed(false); onConfirm() }}>{confirmLabel}</button>
      <button type="button" className="aconfirm-no" onClick={() => setArmed(false)}>Keep</button>
    </span>
  )
}

export function Toasts({ items, onDismiss }) {
  return (
    <div className="atoasts" role="status" aria-live="polite">
      {items.map(toast => (
        <div key={toast.id} className="atoast" data-tone={toast.tone}>
          <span>{toast.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>&times;</button>
        </div>
      ))}
    </div>
  )
}

export function Search({ value, onChange, placeholder, count }) {
  return (
    <div className="asearch">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      <input value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} aria-label={placeholder} />
      {value && <button type="button" aria-label="Clear search" onClick={() => onChange('')}>&times;</button>}
      {count != null && <span className="asearch-count">{count}</span>}
    </div>
  )
}

export function Empty({ title, children, action }) {
  return (
    <div className="aempty">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

// Image upload with a live preview. Click or drop a file; it is resized in the
// browser, uploaded to Sanity, and stored either as a Sanity image reference
// (mode "asset", for Sanity documents) or as its CDN URL (mode "url").
export function ImageField({ value, mode = 'asset', onChange, onUpload, disabled, id, aspect = '16 / 9' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const input = useRef(null)
  const preview = imageUrl(value, 720)

  async function take(file) {
    if (!file || disabled) return
    setBusy(true)
    setError('')
    try {
      const image = await onUpload(file)
      onChange(mode === 'url' ? image.url : { _type: 'image', asset: { _type: 'reference', _ref: image.assetId } })
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="aimage">
      <div
        className={`aimage-drop${dragging ? ' is-drag' : ''}${preview ? ' has-image' : ''}`}
        style={{ aspectRatio: aspect }}
        onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); take(event.dataTransfer.files?.[0]) }}
      >
        {preview ? <img src={preview} alt="" /> : (
          <button type="button" className="aimage-empty" disabled={disabled || busy} onClick={() => input.current?.click()}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5.5-5.5L5 21" strokeLinejoin="round" /></svg>
            <span>{busy ? 'Uploading…' : 'Drop an image or click to upload'}</span>
            <small>JPEG, PNG, WebP or GIF · stored in Sanity</small>
          </button>
        )}
        {busy && preview && <span className="aimage-busy">Uploading…</span>}
      </div>
      <input ref={input} id={id} type="file" accept="image/*" hidden onChange={event => take(event.target.files?.[0])} />
      {preview && !disabled && (
        <div className="aimage-actions">
          <button type="button" className="aimage-btn" disabled={busy} onClick={() => input.current?.click()}>Replace</button>
          <button type="button" className="aimage-btn is-danger" disabled={busy} onClick={() => onChange(mode === 'url' ? '' : null)}>Remove</button>
        </div>
      )}
      {error && <p className="aimage-error" role="alert">{error}</p>}
    </div>
  )
}

// An article URL with a button that fills the rest of the form from the
// article itself. The parent decides which fields the fetched preview fills.
export function ArticleLink({ value, onChange, onFetch, disabled, id, placeholder }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState({ tone: '', text: '' })

  async function run() {
    if (!value || busy) return
    setBusy(true)
    setMessage({ tone: '', text: '' })
    try {
      const note = await onFetch(value)
      setMessage(note ? { tone: 'warn', text: note } : { tone: 'ok', text: 'Filled in from the article.' })
    } catch (reason) {
      setMessage({ tone: 'error', text: reason.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="alink">
      <div className="alink-row">
        <input
          id={id}
          className="actrl"
          type="url"
          inputMode="url"
          value={value || ''}
          placeholder={placeholder}
          disabled={disabled}
          onChange={event => onChange(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); run() } }}
        />
        <button type="button" className="alink-fetch" disabled={disabled || busy || !value} onClick={run}>
          {busy ? 'Fetching…' : 'Fetch details'}
        </button>
      </div>
      {message.text && <p className={`alink-msg is-${message.tone}`} role="status">{message.text}</p>}
    </div>
  )
}
