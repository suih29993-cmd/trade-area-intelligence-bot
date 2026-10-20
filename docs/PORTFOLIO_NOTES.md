# Portfolio Notes

The text below describes implementation scope and technical capability only. It makes no claim about real business outcomes and uses no unverified quantitative results.

## One-sentence summary

Independently built an offline-runnable district health diagnostics demo covering synthetic data generation, metric modeling, SVG visualization, multi-district comparison, structured diagnostic chat, and local-service hardening.

## Three project highlights

- Designed and implemented a five-dimension district health model that decomposes store coverage, competitor pressure, promotion intensity, sales volume, and delivery experience into explainable metrics.
- Built single-district diagnostics, multi-district radar comparison, fictional map-point interaction, and responsive layouts with native JavaScript and SVG, without a third-party map or front-end framework.
- Implemented a local service with the Python standard library, including static-resource allow-lists, CSP, request-body limits, directory-traversal protection, and an opt-in AI adapter that is disabled by default.

## Six engineering highlights

- Constructed 4 fictional districts and 42 fictional stores with a deterministic generator, making the demo reproducible and free of real business records.
- Extracted analysis logic into an engine module shared by the browser and Node tests, keeping UI and metric calculation decoupled.
- Designed schema validation, length limits, coordinate checks, and unsafe-character rejection for imported data.
- Implemented intent detection and a four-part diagnostic response in the local rule engine: summary, evidence, risks, and recommendations.
- Added static-file extension allow-lists, path-boundary checks, secure response headers, disabled CORS, and request-body limits to the local service.
- Wrote Python API tests and Node analysis tests covering data, metrics, imports, routing, and security boundaries.

## Interview discussion angles

1. **Business question to metrics:** define which observable dimensions make up "health," then design a reproducible formula for each dimension.
2. **Metrics to interaction:** use a single-district view for diagnosis, multi-district comparison for benchmarking, and the map for coverage gaps.
3. **Demo to engineering:** add data validation, fallback behavior, log redaction, secure headers, and automated tests.
4. **Real project to public artifact:** replace real records with regenerated synthetic data, remove external dependencies, and run offline by default.
