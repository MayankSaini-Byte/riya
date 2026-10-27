import { useState } from 'react'
import {
  ArticleLink, ImageField,
  Chips, Combo, Confirm, Counter, Field, RankPicker, Section, Segmented, Switch, TextArea, TextInput,
} from './fields'
import { fromLocalInput, getPath, setPath, slugify, toLocalInput } from './schema'

// Walks a form schema from schema.js and renders real controls for it. The JSON
// textarea this replaces is still available behind the editor's Raw JSON toggle.

function Control({ field, value, document, onField, sources, readOnly, id }) {
  const common = { id, disabled: readOnly }

  // `sources` also carries the upload and preview services from the portal.
  if (field.type === 'image') {
    return <ImageField id={id} value={value} mode={field.mode} disabled={readOnly} onUpload={sources?.uploadImage} onChange={next => onField(field.key, next)} />
  }

  if (field.type === 'articleLink') {
    return (
      <ArticleLink
        id={id}
        value={value}
        placeholder={field.placeholder}
        disabled={readOnly}
        onChange={next => onField(field.key, next)}
        onFetch={async url => {
          const { preview, note } = await sources.fetchPreview(url)
          const extra = {}
          for (const key of ['title', 'excerpt', 'siteName', 'authorName', 'publishedAt']) {
            if (preview[key]) extra[key] = preview[key]
          }
          if (preview.image) extra.mainImage = { _type: 'image', asset: { _type: 'reference', _ref: preview.image.assetId } }
          if (!document.slug?.current && preview.title) extra.slug = { _type: 'slug', current: slugify(preview.title) }
          onField(field.key, preview.articleUrl || url, extra)
          return note
        }}
      />
    )
  }

  if (field.type === 'segmented') {
    return <Segmented name={field.label} value={value || ''} options={field.options} disabled={readOnly} onChange={next => onField(field.key, next)} />
  }

  if (field.type === 'switch') {
    return <Switch id={id} checked={Boolean(value)} label={field.label} disabled={readOnly} onChange={next => onField(field.key, next)} />
  }

  if (field.type === 'rank') {
    return (
      <RankPicker
        value={value}
        options={field.options}
        disabled={readOnly}
        onChange={option => onField(field.key, option.value, { rankTitle: option.rankTitle, badgeIcon: option.badgeIcon, score: option.score })}
      />
    )
  }

  if (field.type === 'combo') {
    const options = field.source ? (sources?.[field.source] || []) : field.options
    return <Combo {...common} value={value || ''} options={options} mono={field.mono} placeholder={field.placeholder} onChange={next => onField(field.key, next)} />
  }

  if (field.type === 'chips') {
    return <Chips {...common} value={value} suggestions={field.options} placeholder={field.placeholder} onChange={next => onField(field.key, next)} />
  }

  if (field.type === 'lines') {
    const text = Array.isArray(value) ? value.join('\n') : value || ''
    return (
      <TextArea
        {...common}
        rows={field.rows}
        value={text}
        placeholder={field.placeholder}
        onChange={event => onField(field.key, event.target.value.split('\n'))}
      />
    )
  }

  if (field.type === 'datetime') {
    return <TextInput {...common} type="datetime-local" mono value={toLocalInput(value)} onChange={event => onField(field.key, fromLocalInput(event.target.value))} />
  }

  if (field.type === 'number') {
    return <TextInput {...common} type="number" mono={field.mono} value={value ?? ''} onChange={event => onField(field.key, event.target.value === '' ? '' : Number(event.target.value))} />
  }

  if (field.type === 'textarea') {
    return (
      <>
        <TextArea {...common} rows={field.rows} maxLength={field.max} value={value || ''} placeholder={field.placeholder} onChange={event => onField(field.key, event.target.value)} />
        <Counter value={value} max={field.max} />
      </>
    )
  }

  if (field.type === 'slug') {
    const source = field.from ? getPath(document, field.from) : ''
    const suggestion = slugify(source)
    // Only offered while the slug is still empty. Changing the slug of a document
    // that is already out there breaks its public link, so that stays deliberate.
    return (
      <div className="aslug">
        <TextInput {...common} mono value={value || ''} placeholder="event-name" onChange={event => onField(field.key, slugify(event.target.value))} />
        {suggestion && !value && (
          <button type="button" className="aslug-fill" disabled={readOnly} onClick={() => onField(field.key, suggestion)}>
            Use <code>{suggestion}</code>
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <TextInput
        {...common}
        type={field.type === 'url' ? 'url' : 'text'}
        mono={field.mono}
        maxLength={field.max}
        value={value || ''}
        placeholder={field.placeholder}
        onChange={event => onField(field.key, event.target.value)}
      />
      <Counter value={value} max={field.max} />
    </>
  )
}

function FieldRow({ field, document, value, onField, sources, readOnly, idPrefix }) {
  const id = `${idPrefix}-${field.key.replace(/\./g, '-')}`
  if (field.type === 'switch') {
    return (
      <div className="afield afield-wide">
        <Control field={field} value={value} document={document} onField={onField} sources={sources} readOnly={readOnly} id={id} />
        {field.hint && <p className="afield-hint">{field.hint}</p>}
      </div>
    )
  }
  const wide = ['textarea', 'lines', 'chips', 'rank', 'image', 'articleLink'].includes(field.type) || field.key === 'slug.current'
  return (
    <Field label={field.label} hint={field.hint} required={field.required} htmlFor={id} wide={wide}>
      <Control field={field} value={value} document={document} onField={onField} sources={sources} readOnly={readOnly} id={id} />
    </Field>
  )
}

function ArrayEditor({ spec, items, onChange, sources, readOnly }) {
  const [openIndex, setOpenIndex] = useState(items.length ? 0 : -1)
  const atMax = spec.max != null && items.length >= spec.max

  function updateItem(index, key, next, extra) {
    const patched = items.map((item, position) => {
      if (position !== index) return item
      return { ...setPath(item, key, next), ...(extra || {}) }
    })
    onChange(patched)
  }

  function add() {
    const blank = spec.blank(items)
    onChange([...items, blank])
    setOpenIndex(items.length)
  }

  function move(index, direction) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
    setOpenIndex(target)
  }

  return (
    <div className="aarray">
      {items.length === 0 && <p className="aarray-empty">Nothing here yet.</p>}
      {items.map((item, index) => {
        const open = openIndex === index
        return (
          <article className={`aarray-item${open ? ' is-open' : ''}`} key={index}>
            <div className="aarray-bar">
              <button type="button" className="aarray-grip" aria-expanded={open} onClick={() => setOpenIndex(open ? -1 : index)}>
                <span className="aarray-index">{index + 1}</span>
                <span className="aarray-summary">{spec.summary(item)}</span>
              </button>
              <div className="aarray-tools">
                <button type="button" aria-label="Move up" disabled={readOnly || index === 0} onClick={() => move(index, -1)}>&uarr;</button>
                <button type="button" aria-label="Move down" disabled={readOnly || index === items.length - 1} onClick={() => move(index, 1)}>&darr;</button>
                <Confirm
                  className="aarray-remove"
                  disabled={readOnly}
                  confirmLabel="Remove"
                  onConfirm={() => { onChange(items.filter((_, position) => position !== index)); setOpenIndex(-1) }}
                >
                  Remove
                </Confirm>
              </div>
            </div>
            {open && (
              <div className="aarray-fields">
                {spec.fields.map(field => (
                  <FieldRow
                    key={field.key}
                    field={field}
                    document={item}
                    value={getPath(item, field.key)}
                    onField={(key, next, extra) => updateItem(index, key, next, extra)}
                    sources={sources}
                    readOnly={readOnly}
                    idPrefix={`${spec.key}-${index}`}
                  />
                ))}
              </div>
            )}
          </article>
        )
      })}
      {!readOnly && (
        <button type="button" className="aarray-add" disabled={atMax} onClick={add}>
          {atMax ? `All ${spec.max} ${spec.itemLabel.toLowerCase()}s added` : `+ Add ${spec.itemLabel.toLowerCase()}`}
        </button>
      )}
    </div>
  )
}

export default function DocumentForm({ form, document, onChange, sources, readOnly }) {
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {}
    form.groups.forEach((group, index) => { initial[index] = Boolean(group.open) })
    return initial
  })

  function onField(key, next, extra) {
    let updated = setPath(document, key, next)
    if (extra) updated = { ...updated, ...extra }
    onChange(updated)
  }

  return (
    <div className="aform">
      {form.groups.map((group, index) => {
        const spec = group.array
        const items = spec ? (getPath(document, spec.key) || []) : null
        return (
          <Section
            key={group.title}
            title={group.title}
            count={spec ? items.length : undefined}
            open={openGroups[index]}
            onToggle={() => setOpenGroups(state => ({ ...state, [index]: !state[index] }))}
          >
            {spec ? (
              <ArrayEditor
                spec={spec}
                items={items}
                sources={sources}
                readOnly={readOnly}
                onChange={next => onField(spec.key, next)}
              />
            ) : (
              <div className="afield-grid">
                {group.fields.map(field => (
                  <FieldRow
                    key={field.key}
                    field={field}
                    document={document}
                    value={getPath(document, field.key)}
                    onField={onField}
                    sources={sources}
                    readOnly={readOnly}
                    idPrefix="doc"
                  />
                ))}
              </div>
            )}
          </Section>
        )
      })}
    </div>
  )
}
