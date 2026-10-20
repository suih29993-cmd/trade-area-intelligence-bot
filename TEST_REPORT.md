# Test Report · Public Portfolio Edition

Run date: 2026-10-20
Environment: Windows PowerShell, Python 3.12.10, Node.js v24.19.0

## Result summary

| Check | Result |
| --- | --- |
| Python server tests | 11 / 11 passed |
| Node analysis and chat tests | 6 / 6 passed |
| Python and JavaScript syntax checks | Passed |
| Synthetic-data deterministic reproduction | Passed; SHA-256 unchanged |
| Independent-process HTTP smoke test | Passed |
| Project launcher and stop scripts | Passed |
| Private-file static blocking | 4 / 4 returned 404 |
| Default live AI state | Disabled; `liveAIEnabled: false` |
| CORS | Not enabled |
| Security headers | CSP and related headers present |
| Public-safety checker | Passed in a clean export: 25 text files, 0 findings |
| CJK source scan | 0 CJK findings in text sources |
| English screenshots | Regenerated and visually reviewed |

## Executed checks

### Python tests

```powershell
python -m unittest discover -s tests -v
```

Covered and passed:

- Health check, CSP, and default demo mode.
- `/api/config` returns no credential material.
- Synthetic data class and four base districts.
- Live AI disabled by default.
- Request-body size limit.
- `.env`, source, runtime logs, tool scripts, and traversal paths are inaccessible.
- Static home page, dataset, and favicon are accessible.
- OPTIONS does not grant CORS.
- Unknown APIs return JSON 404.
- Query strings and Authorization headers are redacted from request logs.
- The legacy credential-bearing GET chat route is unsupported and returns 404.

### Node tests

```powershell
node --test tests\engine.test.js
```

Covered and passed:

- Dataset schema, 42 stores, and `synthetic` markers.
- Deterministic single-district analysis, five dimensions, and core-ring segmentation.
- Multi-district ranking and best-value consistency.
- Import validation rejects HTML characters and over-limit store counts.
- The example import file is accepted.
- Local chat returns structured advice, English intent detection, and intent-specific evidence.

### Syntax and determinism

```powershell
python -m py_compile .\server.py .\tools\generate_demo_data.py .\tools\check_public_safety.py
node --check .\js\engine.js
node --check .\js\advisor.js
node --check .\js\app.js
python .\tools\generate_demo_data.py
```

Results:

- All syntax checks passed.
- The dataset SHA-256 before and after regeneration was `60A7CADD75707FC9B956A91021B58E8A3815434EC6853F98604C399A04A6E8DF`.
- The generator produced 4 fictional districts and 42 fictional stores.

### Public-safety check

```powershell
python tools\check_public_safety.py
```

The checker was run in a clean export of the published file tree, without `.git`, runtime state, caches, or local environment files. Result: `PASS`.

The 25 scanned text files produced no findings for:

- credential patterns;
- personal filesystem paths;
- disallowed external URL hosts;
- legacy private-state markers;
- `.env` or runtime state;
- CJK text.

### HTTP smoke test

The server was started as an independent process on a temporary port. Actual responses:

- `/api/health`: 200, `ok: true`, `mode: demo`, `liveAIEnabled: false`.
- `/index.html`: 200.
- `/api/config`: `{"liveAIEnabled": false}`.
- `/api/districts`: 200 with the synthetic dataset.
- `POST /api/chat`: 409 `live_disabled`.
- `/server.py`, `/.env`, `/runtime/server.log`, and `/tools/generate_demo_data.py`: all 404.
- Responses included CSP and no `Access-Control-Allow-Origin` header.

### Project launcher and stop scripts

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_demo.ps1 -NoBrowser
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop_demo.ps1
```

Results:

- The launcher printed `Demo service ready`.
- `/api/health` returned `ok: true`, `mode: demo`, and `liveAIEnabled: false`.
- The stop script stopped only the service process recorded by this project and printed `Demo service stopped`.

### English UI and screenshots

- The page was loaded in headless Chrome against the local service.
- Desktop single-district, desktop comparison, and mobile screenshots were recaptured from the English interface.
- Visual review confirmed English navigation, labels, charts, tables, recommendations, and footer text.
- The screenshots use fictional brands, districts, addresses, map points, and metrics only.
- The comparison screenshot used three synthetic districts and the single-district screenshots used two different synthetic districts.

## Not covered

- No real AI endpoint was enabled or called; the capability is disabled by default and requires operator configuration.
- Browser E2E assertions were limited to rendered screenshots and HTTP behavior; no interactive click-through regression suite is included.
- No cross-browser visual regression, accessibility audit, load test, or production penetration test was performed.
- The legacy repository and its remote visibility were not changed by this test run.

## Reproduction

```powershell
cd portfolio-ready\district-health-studio-public
python -m unittest discover -s tests -v
node --test tests\engine.test.js
python tools\check_public_safety.py
powershell -ExecutionPolicy Bypass -File .\scripts\run_demo.ps1
```
