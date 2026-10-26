# Environment Setup

This documents the configuration currently consumed by the app and serverless functions. No secret values are included.

## Local setup

1. Install a Node.js/npm version compatible with Vite 8.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set the values below.
4. Use `npx vercel dev` to run the Vite frontend and API functions together. `npm run dev` serves only the frontend, so admin API requests will not work there.
5. Run `npm run build` for the production build and `npm run preview` to preview the built frontend.

## Public browser variables

| Variable | Purpose | Sensitivity |
|---|---|---|
| `VITE_SITE_NAME` | Site label | Public |
| `VITE_SITE_HOUSE` | Footer label | Public |
| `VITE_BRAND_LOGO` | Binary Minds brand logo path (Kaziranga House logo remains separately shown in the navbar) | Public |
| `VITE_SOCIALS` | Public social link JSON | Public |
| `VITE_IDEATHON_SUBMISSION_API_URL` | Public submission endpoint URL | Public URL, not a secret |
| `VITE_SANITY_PROJECT_ID` | Sanity browser read client project ID | Public |
| `VITE_SANITY_DATASET` | Sanity browser read dataset | Public |

## Server-only admin variables

Set these in local `.env.local` for `vercel dev` and in the Vercel secret manager for deployments. Never prefix them with `VITE_`.

| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | HMAC key for session signing; generate with `npm run admin:session-secret` |
| `ADMIN_USERS_JSON` | JSON array with username, role, and scrypt password hash |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL used for distributed login throttling and audit records |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only Upstash token |
| `SANITY_PROJECT_ID` | Sanity server project ID; defaults to the current project ID |
| `SANITY_DATASET` | Sanity server dataset; defaults to `production` |
| `SANITY_API_WRITE_TOKEN` | Server-only Sanity token with minimum required write permissions |
| `GOOGLE_APPS_SCRIPT_EMAIL_URL` | Server-only deployed Google Apps Script web app URL ending in `/exec` |
| `GOOGLE_APPS_SCRIPT_EMAIL_SECRET` | Shared secret stored in the Apps Script project and Vercel; never expose it with a `VITE_` prefix |

Supported roles are `super_admin`, `content_editor`, `event_organizer`, `evaluator`, and `read_only`. The environment variable bootstraps Super Admin accounts. A signed-in Super Admin can add managed accounts of any supported role, including another Super Admin with equal portal permissions; managed accounts are stored in Upstash and combined with the environment bootstrap accounts. The last remaining Super Admin cannot be removed. Minds are no longer editable in this portal and remain managed through Sanity. Events, results, and announcements remain Sanity-backed for now. Build in Public projects and their public guidelines are managed by Super Admins and stored in Upstash; only published projects are public. Contribution applications remain private until reviewed; Super Admins can accept, reject, or delete them. Deleting a request also deletes its attachment data from Upstash. Optional PDF/DOC/DOCX attachments are limited to 5 MB and stored as 512 KiB chunks with a 90-day expiry.

## Bootstrap the first Super Admin

1. Run `npm run admin:hash-password` in an interactive terminal. Password input is masked and must be at least 14 characters.
2. Store the resulting `scrypt$...` hash in an `ADMIN_USERS_JSON` entry, for example the JSON shape `[{"username":"owner","role":"super_admin","passwordHash":"<generated hash>"}]`.
3. Generate a random session secret with `npm run admin:session-secret`.
4. Create an Upstash Redis database and configure its REST URL/token.
5. Create a Sanity API token with the minimum required write access.
6. Save all values in `.env.local` or the deployment secret manager. Never commit them.

The login API fails closed if the session secret, user record, or rate-limit service is missing. Sanity document writes require the Sanity write token. Build in Public attachment chunks are uploaded through the server to Upstash; application data and files are not exposed on the public site. When a Super Admin accepts a contribution request, the server calls a Google Apps Script web app that sends the message from the Google account that owns the script. Follow [Google Apps Script acceptance email setup](./google-apps-script-email-setup.md), then set `GOOGLE_APPS_SCRIPT_EMAIL_URL` and `GOOGLE_APPS_SCRIPT_EMAIL_SECRET` in Vercel. If sending fails, the request remains accepted and the admin can retry the email from the application card.

If the deployed admin page shows “Admin sign-in is not configured,” add `SESSION_SECRET`, `ADMIN_USERS_JSON`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` to the Vercel project's server-side environment settings for the deployment environment, then redeploy. The account hash from a local `.env.local` file is not uploaded by Git and does not configure the deployed site.

## External setup requiring an account owner

- Vercel project deployment and secret configuration.
- Upstash Redis account/database.
- Sanity schema/Studio, dataset permissions, write token, and backups.
- Google Apps Script source and submission storage configuration.
