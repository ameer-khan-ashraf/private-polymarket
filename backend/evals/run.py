"""Eval harness for the /markets/parse NL extraction endpoint.

Run from `backend/`:
    python -m evals.run              # uses cached responses where available
    python -m evals.run --refresh    # re-calls the real provider for every case

Scoring is per-field, not exact-match on the whole object:
  - resolution_time: pass if it falls within a case's expected [min, max] window.
  - question: pass if at least half of a case's expected_keywords appear (case-insensitive
    substring match). This is a crude keyword-overlap proxy for "semantic closeness," not
    true semantic similarity — no embedding model is used, to keep the harness free,
    deterministic, and dependency-free. See RESULTS.md for the documented limitation.
  - yes_label/no_label: non-empty and a reasonable length.
  - confidence: pass if it's on the expected side of 0.5 per expect_low_confidence.
  - warnings: pass if any warning contains one of the expected substrings.
A field is only scored for a case if that case declares an expectation for it.
"""

import argparse
import asyncio
import hashlib
import json
import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from schemas import ParsedMarketProposal
from services.nl_parse import ProviderError, parse_market_text

CASES_FILE = Path(__file__).parent / "cases.json"
CACHE_FILE = Path(__file__).parent / "fixtures" / "cache.json"


def _load_cases() -> list[dict]:
    with open(CASES_FILE) as f:
        return json.load(f)["cases"]


def _load_cache() -> dict:
    if CACHE_FILE.exists():
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {}


def _save_cache(cache: dict) -> None:
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2, sort_keys=True)
        f.write("\n")


def _cache_key(text: str, now_iso: str, model: str) -> str:
    return hashlib.sha256(f"{model}|{now_iso}|{text}".encode()).hexdigest()


def _parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


async def _run_case(case: dict, cache: dict, refresh: bool, model: str):
    now = _parse_iso(case["now"])
    key = _cache_key(case["input_text"], case["now"], model)

    if not refresh and key in cache:
        cached = cache[key]
        if "error" in cached:
            return None, cached["error"]
        return ParsedMarketProposal(**cached), None

    try:
        result = await parse_market_text(case["input_text"], now=now)
        cache[key] = result.model_dump(mode="json")
        return result, None
    except ProviderError as e:
        cache[key] = {"error": str(e)}
        return None, str(e)


def _score_case(case: dict, result: ParsedMarketProposal) -> dict:
    expected = case.get("expected", {})
    scores = {}

    if expected.get("resolution_window"):
        lo, hi = (_parse_iso(x) for x in expected["resolution_window"])
        scores["resolution_time"] = lo <= result.resolution_time <= hi

    if expected.get("expected_keywords"):
        question_lower = result.question.lower()
        keywords = expected["expected_keywords"]
        hits = sum(1 for kw in keywords if kw.lower() in question_lower)
        scores["question"] = (hits / len(keywords)) >= 0.5

    if "expect_low_confidence" in expected:
        scores["confidence"] = (
            result.confidence < 0.5 if expected["expect_low_confidence"] else result.confidence >= 0.5
        )

    if expected.get("expect_warning_substrings"):
        joined_warnings = " | ".join(result.warnings).lower()
        scores["warnings"] = any(sub.lower() in joined_warnings for sub in expected["expect_warning_substrings"])

    scores["yes_no_labels"] = (
        bool(result.yes_label.strip())
        and bool(result.no_label.strip())
        and len(result.yes_label) <= 40
        and len(result.no_label) <= 40
    )

    return scores


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="re-call the real provider and rebuild the cache")
    args = parser.parse_args()

    model = os.getenv("OPENROUTER_MODEL_PARSE", "google/gemini-2.5-flash-lite")
    cases = _load_cases()
    cache = _load_cache()

    field_totals: dict[str, int] = {}
    field_passes: dict[str, int] = {}
    rows = []

    for case in cases:
        result, error = await _run_case(case, cache, args.refresh, model)
        if error:
            rows.append((case["id"], case["category"], None, error))
            continue
        scores = _score_case(case, result)
        for field, passed in scores.items():
            field_totals[field] = field_totals.get(field, 0) + 1
            field_passes[field] = field_passes.get(field, 0) + (1 if passed else 0)
        rows.append((case["id"], case["category"], scores, None))

    _save_cache(cache)

    print(f"{'CASE':<32} {'CATEGORY':<18} RESULT")
    for case_id, category, scores, error in rows:
        if error:
            print(f"{case_id:<32} {category:<18} ERROR: {error}")
        else:
            summary = ", ".join(f"{k}={'PASS' if v else 'FAIL'}" for k, v in scores.items())
            print(f"{case_id:<32} {category:<18} {summary}")

    print("\n--- Overall pass rate per field ---")
    for field in sorted(field_totals):
        total = field_totals[field]
        passed = field_passes[field]
        pct = round(100 * passed / total)
        print(f"{field:<16} {passed}/{total} ({pct}%)")


if __name__ == "__main__":
    asyncio.run(main())
