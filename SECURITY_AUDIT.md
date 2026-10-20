# Security Audit · Public Portfolio Edition

Audit date: 2026-10-20
Scope: original local project snapshot, related local runtime traces, public copy, and English conversion

## Executive summary

- The original project's tracked source, README, configuration example, and local Git history contained **no hardcoded valid API key, `securityJsCode`, Bearer token, or other published credential**.
- The original project contained real district names, real coordinates, real-brand and platform context, plus live flows that sent business context to external map, search, and AI services. It was **not suitable for direct public release**.
- This public copy uses synthetic data only, a local SVG map, deterministic rule-based chat, and optional server-side AI that is disabled by default. It copies no original data, configuration, logs, or Git history.
- A Chrome profile contained key-name traces from the legacy site's `localStorage`. No key value was read or printed. If that browser profile has been backed up, shared, or copied, treat the related credentials as exposed and rotate them.
- Read-only history scans of Chrome and Edge found no URL that called the legacy `/api/chat` endpoint with a credential query parameter.
- The English conversion was validated with an ASCII-source CJK regex. All text sources in the public copy are now expected to contain no CJK characters.

This report includes no complete credential, credential fragment, or reusable authentication value.

## Scope and method

Original snapshot:

- Branch state: `main` and the locally recorded `origin/main` pointed to the same commit; the worktree had no uncommitted changes.
- Git shape: one initial commit, 11 tracked files, 11 blobs, 3 trees, and no unreachable objects.
- Reviewed source, README, `.gitignore`, start/stop scripts, ignored local service logs, Git configuration, refs, objects, and reflog.
- The original directory had no `.env`, import/export data files, screenshot directory, or dependency lock file.
- Used file inventory, Git object enumeration, `git fsck`, reflog inspection, regular-expression credential scans, and manual code review.
- Credential scan results record only type and location, never matched values.

Local traces:

- Searched Chrome and Edge `Local Storage` and `Session Storage` for legacy key-name markers.
- Ran read-only queries against Chrome and Edge History databases for legacy chat endpoint URLs and credential query parameters.
- Called no external API and did not test whether historical keys remain valid.

Public-copy conversion:

- Scanned all text files for CJK characters with the ASCII source pattern `[\u4e00-\u9fff]`.
- Replaced UI labels, runtime messages, diagnostic text, health labels, server prompts, tests, and documentation with English.
- Regenerated screenshots from the English UI, not from the legacy screenshots.
- The original local project directory was not modified.

## Key findings

| ID | Area | Observation | Risk | Public-copy handling |
| --- | --- | --- | --- | --- |
| A1 | Source credentials | No hardcoded key found; legacy code read keys from browser input, process environment, or local storage | Medium: a real key could enter the client and runtime | Browser stores no credentials; live mode uses server-side environment variables only and is off by default |
| A2 | Browser storage | Legacy front end wrote map, map-security, search, AI keys, and store data to `localStorage` | High: a shared browser profile or screenshot could expose credentials | New front end stores only imported synthetic data; no credentials |
| A3 | Local residue | A Chrome profile contained the legacy Amap security-key marker | High: the value may still be stored locally | Site-data clearing and key rotation remain required manual actions; this report reads no value |
| A4 | Request parameters | Legacy endpoints accepted AI, search, and Amap keys in GET query parameters | High: keys could enter browser history, terminal logs, proxies, or error pages | New API accepts only a JSON request without credentials; credentials never enter the browser |
| A5 | Logging | Legacy request logging recorded full request lines, including possible query parameters | High: GET-based credential exposure path | New server records only redacted paths and omits query strings, headers, and bodies |
| A6 | Error responses | Legacy code could return remote exception strings to the page | Medium: internal endpoints or provider details could leak | New server returns fixed error codes and falls back to the local rule engine |
| A7 | CORS and static serving | Legacy code allowed arbitrary origins and served files from the project root | Medium: expanded local API and project-file exposure | New server has no CORS, binds locally, and uses static allow-lists plus path-boundary checks |
| A8 | External data flow | With keys configured, legacy flows sent district context and store information to map, search, and AI services | High: real business data could leave the machine | External calls are off by default; live mode sends only aggregate metrics for the selected synthetic district |
| A9 | Real business data | Built-in real district names, coordinates, brand/platform context, and sample store language | High: could reveal areas of internal interest and business methods | Replaced with fixed-seed fictional districts, brands, points, and metrics |
| A10 | Runtime logs | The ignored legacy service log contained only start/stop times and no credential or operating record | Low | No runtime log is copied |
| A11 | Git history | One initial commit and no unreachable objects; no hardcoded credential found, but content included real business context | High: publishing the history would disclose data | `.git` history is not copied; the legacy repository is to remain private |
| A12 | Local paths | Legacy scripts located Python through environment variables; no hardcoded user-home path was found in the snapshot | Low | New copy removes personal paths and adds automated checks |
| A13 | Screenshots/imports | The original snapshot contained no screenshots or import/export files | Low | New screenshots are generated solely from synthetic data |

## Public-copy hardening

- All data is marked `synthetic`: 4 fictional districts and 42 fictional stores. No real latitude or longitude is used; only local `x/y` coordinates.
- The focus brand and competitors use neutral fictional names; channels are `Marketplace A/B`; addresses explicitly end with `(fictional)`.
- The map is local SVG with no tiles, CDN, font, telemetry, or third-party script.
- Chat uses a local deterministic rule engine by default and returns Summary, Evidence, Risks, and Recommendations.
- Optional live AI is enabled only when `ENABLE_LIVE_AI=1` is set and the server configuration is complete. Credentials do not enter the browser, source, or logs.
- The live endpoint accepts only aggregate context for a built-in synthetic district. Imported districts never use the live path.
- The server binds only to `127.0.0.1` and applies CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and a static-file allow-list.
- Request bodies are limited to 16 KB and messages to 500 characters. Logs exclude query strings, headers, and bodies. Errors use fixed codes.
- Imports validate length, coordinates, fields, HTML angle brackets, and control characters. At most 3 imported districts are retained.
- The public copy ships no `.env`, runtime log, cache, database, or original business file. The local Git repository created for publishing is not part of the remote file tree.

## English conversion verification

- `index.html` declares `lang="en"`.
- UI labels, dialogs, errors, map labels, comparison tables, recommendations, and accessibility text are English.
- `js/advisor.js` uses English intent keywords only; no Chinese regex alternatives remain.
- `server.py` instructs the optional live model to reply in English with Summary, Evidence, Risks, and Recommendations.
- Python and Node test fixtures and assertions are English.
- README, data card, methodology, portfolio notes, security audit, and test report are English.
- Screenshots were captured from the English interface.
- `tools/check_public_safety.py` fails on any CJK text in scanned sources.

## Remaining manual actions

1. **Rotate credentials:** revoke and recreate every Amap, search, and AI key previously used by the original project in the provider consoles. Deleting local files does not invalidate a leaked key. This cannot be completed from source code alone.
2. **Clear browser site data:** clear site data for `http://127.0.0.1:8123`, especially legacy map-security and provider key values. If Chrome is running, close it and clear the site data from the correct profile, or use the browser's site-settings controls. The conversion did not terminate the user's browser.
3. **Keep the legacy repository private:** do not change the old repository's visibility, branches, tags, forks, cache, or mirrors. If it was ever public, evaluate disclosure as a real-business-data incident rather than assuming the current branch is clean.
4. **Review terminal and screenshot history:** check any shared terminal output, browser history, proxy logs, or screenshots that may contain query parameters. Treat confirmed exposure as a credential incident.
5. **Use live mode deliberately:** enable it only with an operator-owned HTTPS endpoint. Never enable it after importing real data.
6. **Re-check before publishing:** run `python tools\check_public_safety.py`, inspect screenshots and the repository root, and confirm that the published tree contains no runtime or cache directories.

## Uncovered items

- The legacy repository was not modified during this task; its remote visibility, forks, issues, Actions logs, and release assets were not changed.
- Historical keys were not tested for validity, and no external provider was called.
- Other browser profiles, cloud backups, recycle bins, clipboards, and terminal history were not exhaustively audited.
- No production-grade penetration test, TLS review, DNS review, or hosting-platform access-control review was performed.
