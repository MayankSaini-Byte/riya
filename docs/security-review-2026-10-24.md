# Security review — 24 October 2026

Scope: every file under `api/`, `server/`, `src/`, plus `vercel.json` and dependency audit.
Not covered: the deployed Vercel configuration, Sanity project permissions, the Google Apps
Script source, and live environment variables — none of those are in this repository.

## Summary

The authentication and session design is genuinely solid — notably better than typical for a
project this size. The main gaps were **not** in auth: missing browser security headers on HTML
responses, and arbitrary code execution from CMS content.

`npm audit --omit=dev`: **0 vulnerabilities**.

**Status:** findings 1, 2 and 8 are fixed. Finding 3 was a mistake in the first version of this
review and is corrected in place. Findings 4 and 6 remain open; 5, 7 and 9 are accepted or
informational.

## What is already done well (verified in code)

| Area | Implementation |
|---|---|
| Password storage | scrypt, 32-byte random salt, 64-byte output, `timingSafeEqual` compare. Minimum 14 characters. |
| Sessions | `__Host-` prefixed cookie, `HttpOnly`, `Secure`, `SameSite=Strict`, 8-hour expiry, HMAC-SHA256 signed, constant-time signature check. |
| Session revocation | The token embeds a fingerprint of the password hash, so changing a password or role invalidates every live session. |
| CSRF | `SameSite=Strict` *and* an explicit `Origin` check (`requireSameOrigin`) on every state-changing request. |
| Fails closed | `assertAuthConfig()` refuses to run without a ≥32-char `SESSION_SECRET`, at least one user, a super admin, and well-formed hashes. The login throttle returns 503 rather than allowing login if Redis is unreachable. |
| Username enumeration | `authenticate()` always performs a hash verification, even for unknown usernames. |
| Authorization | Role checks are enforced server-side per route, not only in the UI. Privilege escalation is blocked: `api/admin/users.js` cannot create `super_admin`, cannot delete env-defined accounts, and cannot delete your own account. |
| Secrets | Write tokens and secrets are server-only; `VITE_*` is correctly limited to public config. |
| Audit log | Authentication and content mutations are recorded with actor, role and timestamp. |
| Injection / XSS | No `dangerouslySetInnerHTML` anywhere. Submitted GitHub/LinkedIn values are rebuilt as `https://github.com/<captured-username>` from a validated capture group, which removes `javascript:` style payloads at write time. |
| Uploads | Extension→MIME allowlist, 5 MB cap, base64 charset validation, exact per-chunk length check, UUID session, TTL. |

## Findings

### 1. No security headers on HTML responses — MEDIUM — **fixed**

`setSecurityHeaders()` was applied only inside API handlers. The actual pages (served as static
assets by Vercel) carried none, so the app had no clickjacking, MIME-sniffing or referrer
protection in the browser.

Added to `vercel.json` for all routes: `X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`,
and a **`Content-Security-Policy-Report-Only`** policy covering the real external origins
(Google Fonts, `cdn.jsdelivr.net` for Pyodide, `cdn.sanity.io`, `drive.google.com`).

It is deliberately **Report-Only** so it cannot break the site. After a deploy, check the browser
console for violation reports, then rename the header to `Content-Security-Policy` to enforce it.

### 2. CMS content could execute JavaScript in the site's origin — MEDIUM — **fixed**

`src/components/CodePlayground.jsx` ran `new Function(code)` directly in the page, and the Python
path was **equally exploitable**: the Pyodide setup did `import js`, which hands Python the page's
real `window` and DOM. Snippets come from Sanity article content, so anyone able to publish an
article could run script in every reader's browser, in the site's own origin. The session cookie is
`HttpOnly` and so not directly readable, but same-origin script can still issue authenticated
`fetch` calls to `/api/admin/*` while an admin is signed in.

Both languages now run inside an iframe created with `sandbox="allow-scripts"` and **without**
`allow-same-origin`, defined in `src/components/playgroundSandbox.js`. The iframe therefore has an
opaque origin. Pyodide is loaded *inside* the sandbox, so `import js` reaches the sandbox's window
rather than the page's. Results travel back over `postMessage`, and messages are matched on the
frame's `contentWindow` reference (the origin is `"null"`, so it cannot be compared).

Verified in the browser from inside the sandbox:

| Attempt | Result |
|---|---|
| `parent.__SECRET_ON_PAGE` | `SecurityError` |
| `document.cookie` | `SecurityError` |
| `document.location.origin` | `"null"` |
| `console.log("hello", 1+1)` | still works — `hello 2` |

The parent page also sets a timeout (10s for JavaScript, 90s for Python) and discards the iframe if
it stops responding. That fixes a second, pre-existing bug: `while(true){}` used to freeze the whole
tab. Confirmed that an endless loop in the sandbox now leaves the page fully responsive.

### 3. Client IP parsing — **the original recommendation in this review was wrong** — corrected

The first version of this review claimed `.split(',').at(-1)` read the *wrong* end of
`x-forwarded-for` and recommended switching to the leftmost entry. **That recommendation was
incorrect and would have introduced a rate-limit bypass.** It is recorded here rather than quietly
removed.

`x-forwarded-for` is ordered `client, proxy1, proxy2…`, but a caller can send their *own*
`x-forwarded-for` header, and the edge appends the address it actually observed. So the leftmost
entry is attacker-controlled, while the **rightmost** is the one the trusted edge saw. Reading the
first entry would let anyone rotate invented addresses and walk straight past both limiters. The
original `.at(-1)` was the safe choice.

What was genuinely worth changing, and has been:

- The logic was duplicated in two places and is now one documented helper, `clientAddress(req)`,
  which explains *why* the last entry is used so it does not get "fixed" into a bypass later.
- It now prefers `x-real-ip`, which the platform sets as a single unambiguous value.
- Empty and whitespace-only segments (`"  ,  "`) previously produced an empty key; they are now
  filtered out.
- A missing address previously fell through to the literal string `'unknown'`. For the login
  throttle the key also contains the username, so the per-account limit still held; that is now
  explicit. For `checkPublicSubmissionLimit` the key is the address *alone*, so every anonymous
  caller shared one bucket — it still limits (rather than opening the endpoint up) but the shared
  bucket is now named `no-address` so the misconfiguration is visible in Redis.

Four regression tests covering spoofing, `x-real-ip` precedence, and malformed headers are in
`tests/security.test.js`.

### 4. Rate-limit key falls back to a hardcoded secret — LOW — open

`checkPublicSubmissionLimit` derives its key with `process.env.SESSION_SECRET || 'binary-minds'`.
If `SESSION_SECRET` is ever unset, the keys become predictable. It should require the secret
rather than falling back.

### 5. Upload chunks are not separately rate-limited — LOW — accepted

Quota is consumed by `action: 'init'` only, not by `chunk`. The exposure is bounded (≤10 chunks ×
512 KB per init, 5 inits/hour ≈ 25 MB/hour per key), so this is acceptable — but it is worth
knowing, and finding 3 makes the per-key assumption weaker than intended.

### 6. Applicant attachments are kept for 90 days regardless of outcome — LOW — open

Chunks are re-written with a 90-day TTL on submission. Rejected applicants' CVs persist for the
full period. Consider deleting the chunks when a request is rejected, and documenting the
retention period where applicants can see it.

### 7. Admin content API writes arbitrary document fields to Sanity — LOW — accepted

`api/admin/content.js` validates `_type`, `_id` and `publicationStatus`, then passes the rest of
the body through to `client.create` / `patch().set`. This is normal for a CMS editor and is
constrained by role checks and the audit log, but a compromised editor account can write arbitrary
document shapes.

### 8. Admin rendered applicant URLs without validation — LOW — **fixed**

`AdminPortal.jsx` rendered `submission.githubProfile` / `linkedinProfile` straight into `href`.
Server-side normalisation already made this safe, but legacy or hand-edited records would not be.
Now passed through `safeExternalUrl()` (http/https only) with `rel="noopener noreferrer"`, and a
plain label shown when a stored value is not a usable link.

### 9. Verify API routes are not shadowed by the SPA rewrite — INFO

`vercel.json` rewrites `/(.*)` to `/index.html`. Vercel evaluates functions before rewrites, so
`/api/*` should still resolve, but this is worth confirming on a preview deployment now that a
`headers` block has been added alongside the rewrite.

## Remaining work

1. Deploy, read the `Content-Security-Policy-Report-Only` violations in the console, then rename
   the header to `Content-Security-Policy` to enforce it (finding 1). Now that snippets run in a
   sandboxed frame, check whether `'unsafe-eval'` can be dropped from the page's own policy.
2. Require `SESSION_SECRET` instead of falling back to a constant (finding 4).
3. Delete attachment chunks when a request is rejected, and state the retention period where
   applicants can see it (finding 6).
4. Confirm on a preview deployment that `/api/*` is not shadowed by the SPA rewrite now that a
   `headers` block sits alongside it (finding 9).
