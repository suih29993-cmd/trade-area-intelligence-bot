# Methodology · Synthetic District Metrics

This document explains how the demo calculates district metrics from store-level synthetic data. Every formula is a portfolio demonstration rule, not an industry standard, and must not be used directly for real operating decisions.

## 1. Data layers

### Raw layer

Each district contains store records with:

- `role`: `focus` for the focus brand or `competitor` for a competitor.
- `x`, `y`: local planar coordinates in km, with the district center as origin.
- `monthlyOrders`: synthetic monthly order volume.
- `channels`: two fictional channels, each with a delivery fee, promotion depth, promotion label, and coupon value.

### Metric layer

The analysis engine first calculates:

- Total, core-ring, and outer-ring focus-store counts.
- Total competitor stores, competitor brand count, and aggregated brand orders.
- Simulated order share for the focus brand and competitors.
- Average delivery fee, promotion coverage, promotion depth, and coupon coverage across two channels.

### Scoring layer

Metrics are normalized into five dimensions from 0 to 100, then weighted into the district health score.

## 2. Distance and segmentation

Distance from a store to the district center:

```text
d = sqrt(x² + y²)
```

- `d ≤ 1`: core ring.
- `1 < d ≤ 3`: outer coverage ring.
- Data validation rejects records with `d > 3.05`.

## 3. Five dimensions

### Store coverage

```text
coverage = clamp(
  30 + focusCount × 14 + coreCount × 12
     − max(0, competitorCount − focusCount) × 2,
  0, 100
)
```

Interpretation: core-ring stores receive more weight, while a large competitor advantage reduces the score.

### Low competitor pressure

```text
competition = clamp(
  100 − competitorCount × 5 − topBrandCount × 6 + focusCount × 4,
  0, 100
)
```

Interpretation: a higher score means lower competitor pressure. `topBrandCount` is the number of stores belonging to the competitor brand with the most stores.

### Promotion intensity

```text
promotion = clamp(
  55 + (focusPromoCoverage − competitorPromoCoverage) × 70
     + (focusPromoDepth − competitorPromoDepth) × 1.2,
  0, 100
)
```

- `*PromoCoverage`: share of stores with at least one active channel promotion.
- `*PromoDepth`: average promotion percentage across all channels.

Interpretation: the model compares relative coverage and depth rather than encouraging indiscriminate subsidies.

### Sales volume

```text
focusShare = focusOrders / (focusOrders + competitorOrders)
sales = clamp(focusShare × 180, 0, 100)
```

Interpretation: simulated order share approximates sales volume. A 55.6% share maps to approximately 100 points.

### Delivery experience

```text
delivery = clamp(
  100 − focusAvgFee × 10
     − max(0, focusAvgFee − competitorAvgFee) × 10,
  0, 100
)
```

Interpretation: lower delivery fees score better; fees above the competitor average receive an additional penalty.

## 4. Overall health

```text
health = round(
  coverage × 0.20 +
  competition × 0.20 +
  promotion × 0.20 +
  sales × 0.25 +
  delivery × 0.15
)
```

Bands:

- 85-100: Strong.
- 70-84: Stable.
- 55-69: Watch.
- 0-54: Weak.

## 5. Synthetic data generation

`tools/generate_demo_data.py` uses:

- Fixed district parameters for fictional traffic intensity, competitive intensity, promotion intensity, and delivery-fee baseline.
- A deterministic pseudo-random stream derived from SHA-256.
- Formulas for store role, distance, brand factor, promotion factor, and order noise.

Generation reads no real data files and calls no external service. Repeated runs produce the same JSON.

## 6. Interpretation boundaries

- The score is a heuristic demonstration model and has not been calibrated against real business data.
- Different weights can change rankings; the weights represent configurable product assumptions.
- Promotions and delivery fees reflect synthetic channel fields only and do not represent real platform rules.
- Multi-district comparison demonstrates interaction and analysis methods; it does not replace market research.
