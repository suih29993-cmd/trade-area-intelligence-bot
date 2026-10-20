#!/usr/bin/env python3
"""Generate deterministic synthetic district data for the public demo.

The generator does not read any external file, database, API, or private
dataset. Every value is derived from the fictional profiles below and a
deterministic hash-based pseudo-random stream.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "demo_districts.json"

CHANNELS = ("Marketplace A", "Marketplace B")
FOCUS_BRAND = "Northstar Tea"
COMPETITOR_BRANDS = ("Cedar & Co.", "Mori Tea", "Pine Cup", "Cloudleaf", "Daily Draft")


def unit(seed: str) -> float:
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") / 2**32


def between(seed: str, low: float, high: float) -> float:
    return low + (high - low) * unit(seed)


def money(value: float) -> float:
    return round(value * 2) / 2


def promotion_label(pct: int) -> str:
    if pct <= 0:
        return "No promotion"
    threshold = 25 if pct < 14 else 30
    discount = max(2, round(threshold * pct / 100))
    return f"Spend {threshold} save {discount}"


def store_record(
    district: dict,
    role: str,
    brand: str,
    index: int,
    core: bool,
    angle: float,
    radius: float,
) -> dict:
    profile = district["profile"]
    seed = f'{district["id"]}:{role}:{brand}:{index}'
    traffic = profile["traffic"]
    competition = profile["competition"]
    promo = profile["promo"]
    base_fee = profile["deliveryFee"]

    distance_factor = 1.0 - min(radius, 3.0) * 0.08
    brand_factor = 1.08 if role == "focus" else between(seed + ":brand", 0.82, 1.12)
    promo_factor = 1.0 + promo * between(seed + ":promo-lift", 0.06, 0.18)
    order_noise = between(seed + ":orders", 0.86, 1.14)
    orders = 560 * traffic * distance_factor * brand_factor * promo_factor * order_noise
    monthly_orders = max(60, int(round(orders / 10) * 10))

    has_promo = unit(seed + ":has-promo") >= 0.18
    store_promo = 0 if not has_promo else int(round(
        promo * between(seed + ":promo-depth", 11, 24)
    ))
    store_promo = max(0, min(32, store_promo))

    channels = {}
    for channel_index, channel in enumerate(CHANNELS):
        fee = base_fee - channel_index * 0.5 + between(seed + f":fee:{channel}", -0.8, 0.8)
        if role == "focus":
            fee -= 0.3
        depth = 0 if not has_promo else max(
            0, store_promo + (channel_index * 2 - 1) + int(between(seed + f":depth:{channel}", -2, 2))
        )
        depth = max(0, min(35, depth))
        coupon_roll = unit(seed + f":coupon:{channel}")
        coupon = 0 if coupon_roll < 0.25 else 2 if coupon_roll < 0.55 else 3 if coupon_roll < 0.82 else 5
        channels[channel] = {
            "deliveryFee": money(max(0.0, fee)),
            "promotionPct": depth,
            "promotionLabel": promotion_label(depth),
            "couponValue": coupon,
        }

    role_label = "Core" if core else "Edge"
    if role == "focus":
        name = f"{FOCUS_BRAND} · {district['shortName']} {role_label} {index + 1}"
    else:
        name = f"{brand} · {district['shortName']} {index + 1}"

    return {
        "id": f'{district["id"]}-{"ns" if role == "focus" else "cp"}-{index + 1:02d}',
        "role": role,
        "brand": brand,
        "name": name,
        "x": round(math.cos(angle) * radius, 2),
        "y": round(math.sin(angle) * radius, 2),
        "distanceKm": round(radius, 2),
        "address": f'Unit {12 + index * 7}, {district["shortName"]} Walk (fictional)',
        "monthlyOrders": monthly_orders,
        "channels": channels,
        "source": "synthetic",
    }


def make_district(spec: dict) -> dict:
    district = dict(spec)
    stores = []

    focus_count = spec["profile"]["focusStores"]
    core_count = spec["profile"]["coreStores"]
    for index in range(focus_count):
        seed = f'{spec["id"]}:focus:{index}'
        core = index < core_count
        radius = between(seed + ":radius", 0.22, 0.86) if core else between(seed + ":radius", 1.25, 2.65)
        angle = between(seed + ":angle", -math.pi, math.pi)
        stores.append(store_record(district, "focus", FOCUS_BRAND, index, core, angle, radius))

    competitor_index = 0
    for brand, count in spec["profile"]["competitorCounts"].items():
        for _ in range(count):
            seed = f'{spec["id"]}:competitor:{brand}:{competitor_index}'
            core = unit(seed + ":zone") < 0.32
            radius = between(seed + ":radius", 0.3, 0.92) if core else between(seed + ":radius", 1.2, 2.85)
            angle = between(seed + ":angle", -math.pi, math.pi)
            stores.append(store_record(district, "competitor", brand, competitor_index, core, angle, radius))
            competitor_index += 1

    stores.sort(key=lambda item: (item["role"] != "focus", item["distanceKm"], item["id"]))
    district["stores"] = stores
    district.pop("profile", None)
    return district


SPECS = [
    {
        "id": "harbor-central",
        "name": "Harbor Central",
        "shortName": "Harbor",
        "description": "Fictional waterfront office and retail cluster with a lunch peak and evening footfall.",
        "center": {"x": 0, "y": 0},
        "coverageRadiusKm": 3,
        "profileNote": "High traffic · high competition · high promotion intensity",
        "profile": {
            "traffic": 1.16, "competition": 1.1, "promo": 1.0, "deliveryFee": 3.4,
            "focusStores": 4, "coreStores": 2,
            "competitorCounts": {"Cedar & Co.": 3, "Mori Tea": 2, "Pine Cup": 2, "Cloudleaf": 1, "Daily Draft": 2},
        },
    },
    {
        "id": "riverside-commons",
        "name": "Riverside Commons",
        "shortName": "Riverside",
        "description": "Fictional mixed-use neighbourhood with family weekend demand and moderate delivery density.",
        "center": {"x": 0, "y": 0},
        "coverageRadiusKm": 3,
        "profileNote": "Medium traffic · medium competition · balanced promotion intensity",
        "profile": {
            "traffic": 0.92, "competition": 0.8, "promo": 0.85, "deliveryFee": 2.8,
            "focusStores": 3, "coreStores": 1,
            "competitorCounts": {"Cedar & Co.": 2, "Mori Tea": 2, "Pine Cup": 1, "Cloudleaf": 1, "Daily Draft": 1},
        },
    },
    {
        "id": "maple-square",
        "name": "Maple Square",
        "shortName": "Maple",
        "description": "Fictional suburban town centre with low competitor density and stable repeat demand.",
        "center": {"x": 0, "y": 0},
        "coverageRadiusKm": 3,
        "profileNote": "Medium traffic · low competition · light promotion intensity",
        "profile": {
            "traffic": 1.0, "competition": 0.55, "promo": 0.55, "deliveryFee": 2.2,
            "focusStores": 3, "coreStores": 2,
            "competitorCounts": {"Cedar & Co.": 1, "Mori Tea": 1, "Pine Cup": 1, "Cloudleaf": 1, "Daily Draft": 0},
        },
    },
    {
        "id": "northgate-park",
        "name": "Northgate Park",
        "shortName": "Northgate",
        "description": "Fictional transit-adjacent district with strong competitor activity and lower resident density.",
        "center": {"x": 0, "y": 0},
        "coverageRadiusKm": 3,
        "profileNote": "Lower traffic · high competition · high promotion intensity",
        "profile": {
            "traffic": 0.75, "competition": 1.15, "promo": 1.1, "deliveryFee": 3.8,
            "focusStores": 2, "coreStores": 1,
            "competitorCounts": {"Cedar & Co.": 3, "Mori Tea": 2, "Pine Cup": 2, "Cloudleaf": 1, "Daily Draft": 1},
        },
    },
]


def main() -> None:
    districts = [make_district(spec) for spec in SPECS]
    payload = {
        "schemaVersion": 1,
        "dataClass": "synthetic",
        "generatedBy": "tools/generate_demo_data.py",
        "focusBrand": FOCUS_BRAND,
        "competitorBrands": list(COMPETITOR_BRANDS),
        "channels": list(CHANNELS),
        "disclaimer": (
            "Synthetic demonstration data. District names, brands, stores, addresses, "
            "orders, fees and promotions are fictional and must not be interpreted as real business results."
        ),
        "districts": districts,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT} ({len(districts)} districts, {sum(len(d['stores']) for d in districts)} stores)")


if __name__ == "__main__":
    main()
