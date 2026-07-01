#!/usr/bin/env python3
"""Täglicher Flugpreis-Abruf für Open-Jaw-Routen (Google Flights via fli)."""

from __future__ import annotations

import json
import time
from datetime import date, datetime, timezone
from pathlib import Path

import yaml
from fli.core import (
    build_multi_city_segments,
    normalize_date,
    parse_airlines,
    parse_cabin_class,
    resolve_airport,
)
from fli.models import FlightSearchFilters, PassengerInfo
from fli.search import SearchFlights

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
HISTORY_FILE = DATA_DIR / "history.json"
LATEST_FILE = DATA_DIR / "latest.json"
CONFIG_FILE = ROOT / "config.yaml"


def load_config() -> dict:
    with CONFIG_FILE.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def search_open_jaw(
    origin: str,
    departure: str,
    return_date: str,
    cabin: str,
    adults: int,
    airline_code: str | None,
    currency: str,
    language: str,
    country: str,
) -> dict | None:
    parsed_legs = [
        (resolve_airport(origin), resolve_airport("BKK"), normalize_date(departure)),
        (resolve_airport("HKT"), resolve_airport(origin), normalize_date(return_date)),
    ]
    segments, trip_type = build_multi_city_segments(legs=parsed_legs)
    airlines = parse_airlines([airline_code]) if airline_code else None

    filters = FlightSearchFilters(
        trip_type=trip_type,
        passenger_info=PassengerInfo(adults=adults),
        flight_segments=segments,
        seat_type=parse_cabin_class(cabin),
        airlines=airlines,
    )

    client = SearchFlights()
    data = client.search(
        filters,
        top_n=5,
        currency=currency,
        language=language,
        country=country,
    )
    if not data:
        return None

    best_price = float("inf")
    best_airlines: set[str] = set()

    for item in data[:8]:
        if not isinstance(item, tuple):
            continue
        total = sum(getattr(leg, "price", 0) or 0 for leg in item)
        airlines_found: set[str] = set()
        for leg in item:
            for seg in getattr(leg, "segments", []) or []:
                code = getattr(seg, "airline_code", "") or ""
                if code:
                    airlines_found.add(code[:2])
        if airline_code and airline_code not in airlines_found:
            continue
        if total < best_price:
            best_price = total
            best_airlines = airlines_found

    if best_price == float("inf"):
        return None

    return {
        "origin": origin,
        "route": f"{origin}→BKK / HKT→{origin}",
        "departure": departure,
        "return": return_date,
        "cabin": cabin,
        "airline_filter": airline_code,
        "airlines": sorted(best_airlines),
        "price_eur_total": round(best_price, 2),
        "price_eur_per_person": round(best_price / adults, 2),
    }


def append_history(entry: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    history: list[dict] = []
    if HISTORY_FILE.exists():
        with HISTORY_FILE.open(encoding="utf-8") as f:
            history = json.load(f)
    history.append(entry)
    with HISTORY_FILE.open("w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def main() -> int:
    cfg = load_config()
    adults = int(cfg.get("passengers", 2))
    currency = cfg.get("currency", "EUR")
    language = cfg.get("language", "de")
    country = cfg.get("country", "DE")
    origins = cfg["origins"]
    date_pairs = cfg["date_pairs"]
    cabins = cfg["cabins"]
    preferred = cfg.get("preferred_airlines", [])
    search_all = cfg.get("search_all_airlines", True)

    today = date.today().isoformat()
    fetched_at = datetime.now(timezone.utc).isoformat()
    results: list[dict] = []

    airline_filters: list[str | None] = []
    if search_all:
        airline_filters.append(None)
    airline_filters.extend(preferred)

    for origin in origins:
        for pair in date_pairs:
            dep = pair["departure"]
            ret = pair["return"]
            for cabin in cabins:
                for airline in airline_filters:
                    try:
                        row = search_open_jaw(
                            origin=origin,
                            departure=dep,
                            return_date=ret,
                            cabin=cabin,
                            adults=adults,
                            airline_code=airline,
                            currency=currency,
                            language=language,
                            country=country,
                        )
                        if row:
                            results.append(row)
                            print(
                                f"✓ {row['origin']} {row['cabin']} "
                                f"{row.get('airline_filter') or 'ANY'}: "
                                f"{row['price_eur_total']} EUR"
                            )
                    except Exception as exc:  # noqa: BLE001
                        print(f"✗ {origin} {cabin} {airline}: {exc}")
                    time.sleep(cfg.get("request_delay_seconds", 0.35))

    snapshot = {
        "fetched_at": today,
        "fetched_at_utc": fetched_at,
        "route_description": "Open Jaw: Abflughafen → Bangkok (BKK), Rückflug ab Phuket (HKT)",
        "passengers": adults,
        "preferred_airlines": preferred,
        "results": results,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with LATEST_FILE.open("w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2, ensure_ascii=False)

    # Preisverlauf: ein Eintrag pro Tag und Kombination (niedrigster Preis)
    for row in results:
        append_history(
            {
                "date": today,
                "fetched_at_utc": fetched_at,
                **row,
            }
        )

    print(f"\n{len(results)} Angebote gespeichert → {LATEST_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
