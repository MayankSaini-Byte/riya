// Form schemas for the admin portal.
//
// Every option an organizer can pick is listed here instead of being hidden in a
// placeholder, so the fields offer real choices and the public site keeps getting
// the values it already reads in src/lib/events.js and src/lib/resultsData.js.

export const PUBLICATION_STAGES = [
  { value: 'draft', label: 'Draft', tone: 'hold', note: 'Only visible here.' },
  { value: 'review', label: 'In review', tone: 'review', note: 'Ready for a second pair of eyes.' },
  { value: 'published', label: 'Published', tone: 'go', note: 'Live on the public site.' },
  { value: 'archived', label: 'Archived', tone: 'off', note: 'Taken down, kept on record.' },
]

export const EVENT_STATUSES = [
  { value: 'Upcoming', label: 'Upcoming', tone: 'review' },
  { value: 'Ongoing', label: 'Ongoing', tone: 'go' },
  { value: 'Completed', label: 'Completed', tone: 'off' },
  { value: 'Cancelled', label: 'Cancelled', tone: 'stop' },
]

export const EVENT_TYPES = ['HACKATHON', 'IDEA-THON', 'BLITZ', 'WORKSHOP', 'CODE SPRINT', 'SEMINAR']

export const SECTION_TAGS = ['INFO', 'RULES', 'PRESENTATION', 'SUBMISSION', 'PRIZE', 'CHALLENGES', 'TOOLS', 'JUDGING']

export const PODIUM_RANKS = [
  { value: 1, label: '1st', rankTitle: '1st Place', badgeIcon: '\u{1F947}', score: '1st' },
  { value: 2, label: '2nd', rankTitle: '2nd Place', badgeIcon: '\u{1F948}', score: '2nd' },
  { value: 3, label: '3rd', rankTitle: '3rd Place', badgeIcon: '\u{1F949}', score: '3rd' },
]

export const MENTION_TAGS = ['Best Innovation', 'Best Tech', 'Best Design', 'Best Pitch', 'Community Choice']

export const PROJECT_CATEGORIES = ['AI & Agents', 'Systems & Tools', 'Web & Product', 'Data & Research', 'Developer Experience']

export const PROJECT_DIFFICULTIES = [
  { value: 'Beginner', label: 'Beginner', tone: 'go' },
  { value: 'Intermediate', label: 'Intermediate', tone: 'hold' },
  { value: 'Advanced', label: 'Advanced', tone: 'stop' },
]

export const PROJECT_VISIBILITY = [
  { value: 'draft', label: 'Draft', tone: 'hold', note: 'Hidden from the public page.' },
  { value: 'published', label: 'Published', tone: 'go', note: 'Open for contribution requests.' },
  { value: 'archived', label: 'Archived', tone: 'off', note: 'Closed, kept on record.' },
]

export const TAG_SUGGESTIONS = ['Python', 'React', 'AI / ML', 'TypeScript', 'Node.js', 'Rust', 'Go', 'Docker', 'Design', 'Docs', 'Testing', 'Good first issue']

export const ADMIN_ROLES = [
  { value: 'content_editor', label: 'Content Editor', note: 'Writes and publishes announcements.' },
  { value: 'event_organizer', label: 'Event Organizer', note: 'Runs events, results and announcements.' },
  { value: 'evaluator', label: 'Evaluator', note: 'Reads submissions to judge them.' },
  { value: 'read_only', label: 'Read Only', note: 'Can look, cannot change anything.' },
  { value: 'super_admin', label: 'Super Admin', note: 'Full access to the whole portal, like you.' },
]

const LINK_HINT = 'Full https:// link.'

// A group renders as one collapsible section. `open: true` groups start expanded so
// a new document shows a handful of fields instead of forty.
export const FORMS = {
  siteEvent: {
    label: 'Event',
    plural: 'Events',
    blurb: 'Events drive the public events page, its countdown and its rule books.',
    groups: [
      {
        title: 'Basics',
        open: true,
        fields: [
          { key: 'title', label: 'Event name', type: 'text', required: true, max: 140, placeholder: 'Let the Ideas Flow' },
          { key: 'slug.current', label: 'URL slug', type: 'slug', mono: true, required: true, from: 'title', hint: 'Used in the public link. Lowercase letters, numbers and hyphens.' },
          { key: 'type', label: 'Event format', type: 'combo', options: EVENT_TYPES, hint: 'Pick one or type your own.' },
          { key: 'status', label: 'Live status', type: 'segmented', options: EVENT_STATUSES, hint: 'Shown as the badge on the event card.' },
        ],
      },
      {
        title: 'Schedule',
        fields: [
          { key: 'startDate', label: 'Starts', type: 'datetime' },
          { key: 'endDate', label: 'Ends', type: 'datetime', hint: 'Drives the deadline countdown on the public page.' },
        ],
      },
      {
        title: 'Links and image',
        fields: [
          { key: 'registrationLink', label: 'Registration link', type: 'url', hint: LINK_HINT },
          { key: 'ruleBookLink', label: 'Rule book link', type: 'url', hint: LINK_HINT },
          { key: 'image', label: 'Cover image', type: 'text', hint: 'A file in /public such as /Ideathone.jpeg, or a full image link.' },
          { key: 'footerText', label: 'Footer note', type: 'textarea', rows: 2, max: 240, placeholder: 'Event concluded. Thanks for participating.' },
        ],
      },
      {
        title: 'Detail sections',
        array: {
          key: 'details',
          itemLabel: 'Section',
          summary: item => item.sectionTitle || 'Untitled section',
          blank: () => ({ sectionTitle: '', tag: 'INFO', content: [] }),
          fields: [
            { key: 'sectionTitle', label: 'Section heading', type: 'text', required: true, placeholder: 'About the Event' },
            { key: 'tag', label: 'Label', type: 'combo', options: SECTION_TAGS },
            { key: 'content', label: 'Points', type: 'lines', rows: 5, hint: 'One point per line.' },
            { key: 'isSubmissionSection', label: 'This is the submission section', type: 'switch', hint: 'Shows the submission box on the public page.' },
            { key: 'submissionLink', label: 'Submission link', type: 'url' },
            { key: 'ruleBookLink', label: 'Rule book link', type: 'url' },
            { key: 'documentLink', label: 'Document link', type: 'url' },
          ],
        },
      },
      {
        title: 'Problem statements',
        array: {
          key: 'problemStatements',
          itemLabel: 'Statement',
          summary: item => item.text || 'Untitled statement',
          blank: () => ({ text: '', url: '' }),
          fields: [
            { key: 'text', label: 'Statement', type: 'textarea', rows: 2, required: true },
            { key: 'url', label: 'Reference link', type: 'url' },
          ],
        },
      },
    ],
  },

  siteResult: {
    label: 'Result',
    plural: 'Results',
    blurb: 'Results publish the podium and honorable mentions for a finished event.',
    groups: [
      {
        title: 'Basics',
        open: true,
        fields: [
          { key: 'title', label: 'Headline', type: 'text', required: true, placeholder: 'Winners & Results' },
          { key: 'slug.current', label: 'URL slug', type: 'slug', mono: true, required: true, from: 'title' },
          { key: 'eventId', label: 'Event', type: 'combo', mono: true, source: 'events', required: true, hint: 'Matches the event these results belong to.' },
          { key: 'eyebrow', label: 'Eyebrow', type: 'text', max: 60, placeholder: 'IDEATHON 2026' },
          { key: 'subtitle', label: 'Standfirst', type: 'textarea', rows: 2, max: 240 },
        ],
      },
      {
        title: 'Podium',
        open: true,
        array: {
          key: 'top3',
          itemLabel: 'Place',
          max: 3,
          summary: item => item.teamName || PODIUM_RANKS.find(rank => rank.value === item.rank)?.rankTitle || 'Empty place',
          blank: items => {
            const taken = new Set(items.map(item => item.rank))
            const next = PODIUM_RANKS.find(rank => !taken.has(rank.value)) || PODIUM_RANKS[0]
            return { rank: next.value, rankTitle: next.rankTitle, badgeIcon: next.badgeIcon, score: next.score, teamName: '', projectTitle: '', description: '' }
          },
          fields: [
            { key: 'rank', label: 'Place', type: 'rank', options: PODIUM_RANKS, hint: 'The medal and label fill themselves in.' },
            { key: 'teamName', label: 'Team or participant', type: 'text', required: true },
            { key: 'projectTitle', label: 'Project', type: 'text', required: true },
            { key: 'description', label: 'One-line description', type: 'textarea', rows: 2 },
          ],
        },
      },
      {
        title: 'Honorable mentions',
        array: {
          key: 'honorableMentions',
          itemLabel: 'Mention',
          summary: item => item.teamName || 'Empty mention',
          blank: items => ({ id: `hm-${items.length + 1}`, rankNumber: items.length + 4, teamName: '', projectTitle: '', tag: '' }),
          fields: [
            { key: 'teamName', label: 'Team or participant', type: 'text', required: true },
            { key: 'projectTitle', label: 'Project', type: 'text' },
            { key: 'tag', label: 'Award', type: 'combo', options: MENTION_TAGS },
            { key: 'rankNumber', label: 'Position', type: 'number', mono: true },
          ],
        },
      },
    ],
  },

  siteAnnouncement: {
    label: 'Announcement',
    plural: 'Announcements',
    blurb: 'Announcements appear as a banner on the public site between their two dates.',
    groups: [
      {
        title: 'Announcement',
        open: true,
        fields: [
          { key: 'title', label: 'Headline', type: 'text', required: true, max: 140, placeholder: 'Ideathon results are out' },
          { key: 'slug.current', label: 'URL slug', type: 'slug', mono: true, required: true, from: 'title' },
          { key: 'body', label: 'Message', type: 'textarea', rows: 6, required: true, max: 1200, hint: 'Write it the way you would say it out loud.' },
        ],
      },
      {
        title: 'Show between',
        open: true,
        fields: [
          { key: 'startsAt', label: 'Starts showing', type: 'datetime' },
          { key: 'endsAt', label: 'Stops showing', type: 'datetime', hint: 'Leave empty to keep it up until archived.' },
        ],
      },
    ],
  },
}

export function blankDocument(type) {
  const base = { _type: type, title: '', slug: { _type: 'slug', current: '' }, publicationStatus: 'draft' }
  if (type === 'siteEvent') return { ...base, type: '', status: 'Upcoming', startDate: '', endDate: '', registrationLink: '', ruleBookLink: '', image: '', footerText: '', details: [], problemStatements: [] }
  if (type === 'siteResult') return { ...base, eventId: '', eyebrow: '', subtitle: '', top3: [], honorableMentions: [] }
  return { ...base, body: '', startsAt: '', endsAt: '' }
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}

export function getPath(source, path) {
  return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), source)
}

export function setPath(source, path, next) {
  const keys = path.split('.')
  const copy = Array.isArray(source) ? [...source] : { ...source }
  let cursor = copy
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index]
    const existing = cursor[key]
    cursor[key] = Array.isArray(existing) ? [...existing] : { ...(existing || {}) }
    cursor = cursor[key]
  }
  cursor[keys[keys.length - 1]] = next
  return copy
}

// Sanity stores plain ISO strings like 2026-08-01T00:00:00; datetime-local wants
// exactly the first sixteen characters of that.
export function toLocalInput(value) {
  if (!value) return ''
  const text = String(value)
  return text.length >= 16 ? text.slice(0, 16) : text
}

export function fromLocalInput(value) {
  if (!value) return ''
  return value.length === 16 ? `${value}:00` : value
}

export function listRequiredGaps(form, document) {
  const gaps = []
  for (const group of form.groups) {
    for (const field of group.fields || []) {
      if (!field.required) continue
      const value = getPath(document, field.key)
      if (value == null || String(value).trim() === '') gaps.push(field.label)
    }
  }
  return gaps
}
