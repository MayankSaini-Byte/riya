# Architecture

**Status labels:** Verified = visible in this repository; Needs external access = cannot be confirmed without the connected service/account; Recommendation = proposed direction.

## Verified architecture

Binary Minds is a React 19 single-page app built with Vite and React Router. `src/main.jsx` mounts the app; `src/App.jsx` declares public routes and `/kazi_binary_admins`. Route pages live in `src/pages/`, reusable UI in `src/components/`, shared integration/data code in `src/lib/`, and static assets in `public/`. Vercel rewrites browser routes to the SPA while `/api/*` routes run as Node functions.

Public Minds pages read from Sanity. The former Blitz route now redirects to Build in Public; its old Sanity records remain stored but are no longer routed or managed by this portal. Build in Public project cards and contribution guidelines are managed by Super Admins in the portal and stored in Upstash; only published projects appear publicly. Project records may include an HTTPS repository link and a publicly shared Google Drive image link. Contribution applications attach to a project ID and title snapshot. Optional PDF/Word attachments are stored privately as chunked data in Upstash Redis, expire after 90 days, and are removed immediately when the related application is deleted by a Super Admin. Applicant details are never listed publicly. Event content can be managed as Sanity `siteEvent` records and is served through a public projection once managed records exist. Results are read from published `siteResult` records; placeholder local results are no longer displayed. Published `siteAnnouncement` documents are shown in a public banner. Minds remain in Sanity and are no longer editable through this portal.

Vercel functions under `api/` provide authentication, account management, Build in Public moderation, and privileged Sanity writes. Shared server helpers live outside `api/` so they are not deployed as endpoints. Admin sessions use a signed HttpOnly cookie. Roles are checked by the server. Login throttling, managed accounts, submissions, and a limited audit history use Upstash Redis. Sanity write credentials remain server-side. Super Admin bootstrap accounts and required Upstash/Sanity configuration remain deployment settings.

Ideathon submissions still POST to an external Google Apps Script endpoint. Its implementation and storage are not present in this repository. Legacy Blitz source files remain in the repository but have no active route and are not part of the public experience.

## Route and integration map

| Route/area | Source and behavior | Status |
|---|---|---|
| Home `/` | `src/pages/Hero.jsx`; recent Minds from Sanity | Verified |
| Minds `/minds` | `src/pages/Minds.jsx`; list/search from Sanity | Verified |
| Mind detail `/minds/:slug` | `MindDetail.jsx` and `MindViewer.jsx` | Verified |
| Events `/events` | Published Sanity events when managed records exist; legacy data fallback otherwise | Implemented; requires content setup |
| Results | Published Sanity results; placeholder local records hidden | Implemented; requires verified records |
| Announcements | Published Sanity announcements in shared public banner | Implemented; requires records |
| Build in Public `/build-in-public` | Open project listing and contribution application form | Implemented; Upstash required for private applications and attachments |
| Legacy `/blitz` and `/blitz/:slug` | Redirects to `/build-in-public` | Verified |
| Admin `/kazi_binary_admins` | React workspace, auth, account management, moderation, Sanity document CRUD | Implemented; secrets/services required |
| Contribution application review | Super Admin acceptance/rejection queue in Upstash | Implemented |
| Sanity schemas/Studio | Not in repository | Needs external access |
| Vercel runtime/secrets | Function handlers are in repository; deployment settings not visible | Needs external access |

## Important files

- `src/pages/AdminPortal.jsx` and `AdminPortal.css`: protected content, access, and moderation workspace.
- `api/auth/` and `server/security.js`: sessions, role validation, login rate limiting, password verification, Upstash storage.
- `api/admin/content.js`: role-checked Sanity document reads/writes (Minds excluded).
- `api/admin/users.js`, `api/admin/build-in-public.js`, `api/admin/build-in-public-projects.js`: Super Admin account management, application moderation, and Build in Public project management.
- `api/public/build-in-public.js`: published project listing and project-specific contribution submission API.
- `server/build-in-public-projects.js`: Upstash-backed project store and initial Open AI Agent Framework record.
- `api/public/content.js`: public projections limited to published event/result/announcement fields.
- `scripts/create-password-hash.mjs`: interactive masked scrypt hash generator.
- `scripts/generate-session-secret.mjs`: session secret generator.
- `src/lib/events.js`, `eventSpecificData.json`, `resultsData.js`: legacy local content/fallback inputs.

## Remaining risks and external setup

- **Needs external access:** Sanity schemas/Studio, write token scope, dataset permissions, and backups.
- **Needs external access:** Upstash Redis provisioning and Vercel secret configuration.
- **Needs external access:** Google Apps Script implementation, private storage, and retention behavior.
- **Recommendation:** Configure the functions and secrets on a preview deployment, verify roles and public projections, then migrate/verify content before relying on the portal operationally.
- **Verified:** Existing Blitz source files and Sanity records have not been deleted; routes redirect and admin content access is disabled.

## Build result

**Verified on 23 October 2026:** `npm run build` succeeds. Vite warns the main bundle is about 2.29 MB minified (about 713 KB gzip), above the 500 KB advisory threshold.
