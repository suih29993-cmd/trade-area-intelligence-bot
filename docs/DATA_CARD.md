# Data Card · Synthetic District Dataset

## Dataset identity

- Data class: `synthetic`
- Data file: `data/demo_districts.json`
- Generator: `tools/generate_demo_data.py`
- Scale: 4 fictional districts, 42 fictional stores, and 2 neutral channels
- Randomness: fixed seed and deterministic formulas; repeated generation produces the same result

## Provenance and construction

This dataset is not a renamed, perturbed, sampled, or aggregated copy of real store records. It was not exported from a map, delivery platform, web search, or AI service. The in-project generator starts from fictional district parameters and follows these steps:

1. Define four district names and descriptions that do not exist in real geographic databases.
2. Generate local planar coordinates for each district within roughly 3 km of its center.
3. Generate focus-brand and competitor roles, positions, simulated order volumes, and channel promotions.
4. Calculate distances, promotion coverage, delivery fees, and district health with deterministic formulas.
5. Validate field ranges, distance bounds, role distribution, and data-class markers in tests.

The page displays an SVG grid, not a latitude/longitude map. Points express relative position only and do not represent real places.

## Fields and units

| Field | Meaning |
| --- | --- |
| `x`, `y` | Local planar coordinates relative to the district center, in km |
| `distanceKm` | Distance from the district center, in km |
| `monthlyOrders` | Synthetic monthly order count |
| `deliveryFee` | Synthetic delivery fee in CNY |
| `promotionPct` | Synthetic promotion depth as a percentage |
| `couponValue` | Synthetic coupon value in CNY |
| `role` | `focus` or `competitor`, used only for demonstration analysis |

## Privacy and compliance

- Contains no names, phone numbers, addresses, accounts, order IDs, payment information, or other personal data.
- Contains no real store addresses, coordinates, monthly sales, delivery fees, or platform promotions.
- Contains no provider credentials, API keys, `securityJsCode`, or authentication tokens.
- Imported data stays in the current browser's `localStorage` and is not uploaded to external services.
- Anyone importing their own data is responsible for authorization, de-identification, and retention requirements.

## Limitations

- The health formula is a portfolio demonstration rule, not an industry standard, and must not drive real operating decisions.
- Store distribution and order volume are used only to demonstrate interaction and calculation.
- There is no real foot traffic, weather, holiday, membership, gross-margin, refund, or fulfillment data.
- There is no user system, authorization system, database, or multi-tenant isolation.

## Reproduction

```powershell
python tools\generate_demo_data.py
python -m unittest discover -s tests -v
node --test tests\engine.test.js
python tools\check_public_safety.py
```
