# Security Notes

## Scope

This repository is a local, synthetic-data portfolio demo. It is not intended to be exposed to the public internet.

This edition was independently rebuilt from a neutral synthetic dataset. It does not include the source project's business records, credentials, runtime logs, local configuration or Git history. See `SECURITY_AUDIT.md` for the source-retention audit and remaining manual checks.

## Default posture

- The server binds to `127.0.0.1` only.
- No API keys, tokens, webhooks, or credentials are included.
- The browser does not store provider credentials.
- The only browser-persisted state is up to three imported synthetic districts under `dhs_imports_v1`.
- No external map tiles, search APIs, fonts, scripts, or telemetry are loaded.
- The local rule engine handles diagnosis by default.
- Live AI is opt-in through server-side environment variables and is disabled unless `ENABLE_LIVE_AI=1` plus a complete configuration is present.

## Server controls

- Static files are limited by extension and directory allow-lists.
- Resolved paths must remain inside the project root.
- `.env`, source files, tests, tools, scripts, runtime data, and dotfiles are not served.
- Request bodies are limited to 16 KB.
- The chat message is limited to 500 characters.
- CORS is not enabled.
- Responses include a restrictive Content Security Policy and related headers.
- Request logs omit query strings, headers, bodies, and credentials.
- Credential-bearing GET endpoints from the legacy prototype are not implemented.

## Front-end controls

- Data is rendered with `textContent`, not `innerHTML`.
- Imported strings reject HTML angle brackets and control characters.
- Imported records are validated for length, numeric ranges, coordinate bounds, role, channels, and store count.
- Imported data stays in browser `localStorage` and is never sent to the live adapter.

## Optional live adapter

- Reads credentials only from server-side environment variables.
- Requires an HTTPS base URL.
- Rejects localhost, link-local, and private IP targets.
- Rejects URL-embedded usernames or passwords.
- Sends only the selected synthetic district summary and the user question.
- Returns generic error codes and falls back to the local rule engine.

## Reporting

If you find a security issue, use the private security-reporting feature of the code hosting platform rather than opening a public issue with exploit details.
