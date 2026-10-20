# Security Notes

## Scope

This repository is a public, synthetic-data portfolio demo. It can run through the local Python service or the public Cloudflare Pages deployment. Neither mode connects to an internal database, an internal API, or real business records.

This edition was independently rebuilt from a neutral synthetic dataset. It does not include the source project's business records, credentials, runtime logs, local configuration or Git history. See `SECURITY_AUDIT.md` for the source-retention audit and remaining manual checks.

## Deployment modes

- The public Cloudflare Pages demo serves static assets and four read-only Pages Functions. It has no database, admin route, upload route, or writable server state.
- The local Python service is intended for development and testing and binds to `127.0.0.1` only.
- Live AI is disabled in the public Pages deployment. The Pages chat endpoint returns `409 live_disabled`; the browser uses the local rule engine.

## Default posture

- The local Python server binds to `127.0.0.1` only; the public Pages deployment exposes only allow-listed static assets and read-only demo endpoints.
- No API keys, tokens, webhooks, or credentials are included.
- The browser does not store provider credentials.
- The only browser-persisted state is up to three imported synthetic districts under `dhs_imports_v1`.
- No external map tiles, search APIs, fonts, scripts, or telemetry are loaded.
- The local rule engine handles diagnosis by default.
- Live AI is opt-in through server-side environment variables and is disabled unless `ENABLE_LIVE_AI=1` plus a complete configuration is present.

## Local Python server controls

- Static files are limited by extension and directory allow-lists.
- Resolved paths must remain inside the project root.
- `.env`, source files, tests, tools, scripts, runtime data, and dotfiles are not served.
- Request bodies are limited to 16 KB.
- The chat message is limited to 500 characters.
- CORS is not enabled.
- Responses include a restrictive Content Security Policy and related headers.
- Request logs omit query strings, headers, bodies, and credentials.
- Credential-bearing GET endpoints from the legacy prototype are not implemented.

## Cloudflare Pages controls

- The build publishes only the public front end, synthetic data, example import file, security headers, and Pages Functions.
- Python source, tests, tools, scripts, documentation sources, environment files, runtime state, and Git history are excluded from the upload.
- Static responses include CSP, HSTS, frame denial, MIME sniffing protection, referrer policy, permissions policy, COOP, and CORP headers.
- API responses use `no-store`, a denial CSP, HSTS, and the same browser hardening headers.
- `/api/chat` is read-only and intentionally returns `409 live_disabled`.
- No Cloudflare account token, API key, or provider secret is present in the repository, deployment bundle, browser storage, or browser code.

## Front-end controls

- Data is rendered with `textContent`, not `innerHTML`.
- Imported strings reject HTML angle brackets and control characters.
- Imported records are validated for length, numeric ranges, coordinate bounds, role, channels, and store count.
- Imported data stays in browser `localStorage` and is never sent to the live adapter.

## Optional live adapter

- Applies only to the local Python service; the public Pages chat endpoint is intentionally disabled.
- Reads credentials only from server-side environment variables.
- Requires an HTTPS base URL.
- Rejects localhost, link-local, and private IP targets.
- Rejects URL-embedded usernames or passwords.
- Sends only the selected synthetic district summary and the user question.
- Returns generic error codes and falls back to the local rule engine.

## Reporting

If you find a security issue, use the private security-reporting feature of the code hosting platform rather than opening a public issue with exploit details.
