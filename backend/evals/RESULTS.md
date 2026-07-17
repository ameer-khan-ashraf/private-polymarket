# NL parse eval results

Run: `python -m evals.run --refresh` (30 cases, `google/gemini-2.5-flash-lite` via OpenRouter). Responses are cached in `fixtures/cache.json`, which is committed — this is the exact run that cache reflects, so `python -m evals.run` (no flag) reproduces these numbers without an API key.

Per the build instructions, the prompt was not tuned to force a pass after seeing failures. Every number and case below is real model output, documented as-is.

## Overall pass rate per field

| Field | Pass rate |
|---|---|
| yes_no_labels | 30/30 (100%) |
| question | 21/22 (95%) |
| warnings | 13/14 (93%) |
| resolution_time | 16/22 (73%) |
| confidence | 18/24 (75%) |

(A field is only scored on cases that declare an expectation for it — see the `run.py` module docstring for the exact per-field scoring method, and `cases.json` for the "expected" block on each case.)

## Failures, grouped by root cause

### 1. Systematic weekday off-by-one bug (real model limitation — the most important finding)

4 of the 6 `resolution_time` failures are the same bug: the model resolves named-weekday phrasing ("by sunday", "this saturday", "by next monday") to a date **one weekday later than correct**, relative to the injected `now`.

| Case | Input | `now` (weekday) | Expected | Model returned |
|---|---|---|---|---|
| `happy_job_offer` | "...by next monday" | Wed 2026-07-15 | Mon 2026-07-20 | **Tue 2026-07-21** |
| `happy_concert_rain` | "...this saturday" | Wed 2026-07-15 | Sat 2026-07-18 | **Sun 2026-07-19** |
| `reldate_book_sunday` | "...by sunday" | Wed 2026-07-15 | Sun 2026-07-19 | **Mon 2026-07-20** |
| `multiclause_marathon_injury` | "...by sunday" | Wed 2026-07-15 | Sun 2026-07-19 | **Mon 2026-07-20** |

This is not tied to one unlucky case — a first exploratory run (not committed) hit the same off-by-one on a *different* subset of weekday cases, including a case anchored on a Saturday `now` that came back a full week late. The bug is probabilistic, not deterministic, but it recurs across runs and across which specific case triggers it. Other date arithmetic in the same run — `in 3 weeks`, `end of next month`, `end of the year`, `within 48 hours` — resolved correctly every time. The weakness is specific to named-weekday resolution, not date math generally.

**Not fixed in this PR.** A deterministic server-side correction is possible (re-derive the nearest matching weekday from the input text, override the model's date) but that has its own edge cases (does "sunday" mean this one or next?) and deserves its own design pass, not a reactive patch bolted onto this one. Flagging it here so it isn't lost.

### 2. Confidence doesn't discount for the model's own stated warnings (real model limitation)

All 4 `non_binary` cases correctly got a "not a clear binary yes/no question" warning (or equivalent) from the model — but **none** of the 4 had confidence below 0.5:

| Case | Confidence | Warning included "not binary"? |
|---|---|---|
| `nonbinary_lunch` | 0.5 | Yes |
| `nonbinary_rain_amount` | 0.6 | Yes |
| `nonbinary_election` | 0.8 | Yes |
| `nonbinary_meeting_time` | 0.8 | Yes |

This is a more precise and more concerning finding than "the model sometimes misses non-binary questions" — it correctly *identifies* the problem in every case here, but its `confidence` field doesn't reflect that self-diagnosis. For `nonbinary_election` in particular ("who will win the presidential election"), the model reframed the question around an unspecified winner and still reported 0.8 confidence. **This means confidence alone is not a reliable signal for how much a proposal needs review — the `warnings` array is doing the real work, and the frontend must surface both, not gate on confidence alone.**

### 3. Compound/multi-clause questions get confidently flattened, silently dropping an outcome (documented, not "fixed")

Both `multi_clause` cases — 3-way compound questions dressed up as binary — came back with confidence ≥0.85 and zero warnings:

- "will I finish the marathon and get a new PR, or will I injure myself... by sunday" → collapsed to "Finish with PR" vs. "Injure before finish", silently dropping the third real outcome (finishes, no injury, no PR).
- "will I get the promotion and the raise... or just one of them" → collapsed to "Both" vs. "Only one or neither" — this one is arguably fine since it does account for all cases in the no-label.

The marathon case is the more concerning one: the model picked an internally consistent binary framing without disclosing that it discarded a real, likely outcome. This is a defensible product judgment call in one case and a real gap in the other, so it's left documented rather than special-cased.

### 4. Ambiguous-deadline defaults can be far out, and the eval's own tolerance window was too tight (harness calibration issue, not a model failure)

`ambig_bug_eventually` ("will they eventually fix the bug") and `ambig_promoted_sometime` ("will I get promoted sometime") both resolved to a **1-year-out** default deadline. The eval's tolerance window for this category was set to 6 months, assuming a short default — so these register as `resolution_time` failures, but a 1-year default for a genuinely open-ended "eventually"/"sometime" is a reasonable choice, arguably better than an arbitrarily short one. Both cases correctly warned that the deadline was ambiguous/missing. This is the eval dataset's window being miscalibrated, not the model doing something wrong — left as a documented dataset limitation rather than widening the window after the fact to force a pass.

### 5. Keyword-matching scoring limitation (harness limitation, not a model failure)

`ambig_promoted_sometime`'s `question` check expected the keyword "promoted"; the model's question said "promotion" — same word, different inflection. `inject_ignore_instructions`'s `warnings` check expected a substring like "manipulat"; the model's own warning said "prompt injection attempt" instead — semantically the same finding, different word choice, so the substring check missed it even though the input was correctly detected as adversarial. Both are artifacts of the harness's deliberately simple, non-stemmed, non-embedding substring matching (see the scoring-method note in `run.py`'s module docstring) — not tuned away, to keep the tradeoff visible.

## What worked well

- **Adversarial/injection: the actual safety net held 4/4 regardless of the two scoring quirks above.** `nl_parse._detect_injection` forces confidence down and adds a warning deterministically, independent of what the model does with the input — `inject_ignore_instructions` above is a case where the *model itself* also correctly caught the injection (confidence 0.0, own warning), and the server-side heuristic is the backstop for cases where it doesn't.
- **`yes_no_labels`: 31/31.** Always short, sane, non-empty, regardless of how well-formed the question was.
- **General relative-date arithmetic (day counts, month rollovers, year-end, hour-based windows) was solid across every case that used it** — the one real weakness is named-weekday resolution specifically (§1).
- **The model is honest about inventing a default deadline** — every case with no stated deadline correctly warned about it rather than silently picking one.
