# AGENT TASK — Mechanical residual-taxonomy sync check (T-4)

**Lane:** Independent · **After** nothing
**Governance/DoD:** `docs/solution/Architect_Residual_Review_Session.md` §3 (the producer registry this check protects), `docs/solution/AGENT_TASKS_Residual_Assist_Redesign.md`'s own T-4 row (this file executes that row), `CLAUDE.md`'s "Working in this repo" rule (added 2026-08-23) that this check mechanically enforces
**Why this file exists:** §3's producer registry was built once, by hand, after finding this doc's own status line had drifted from the real code (`triage.py`'s `_TRIGGER_MAP` gained a new trigger without the doc being updated). Nothing currently stops that from happening again. This task builds the same class of guard `pipeline/scripts/check-generalization.js` already provides for a different drift class (sample-repo literals / untested detection logic).

## What you're building

`pipeline/scripts/check-residual-taxonomy-sync.js`, structurally modeled on `pipeline/scripts/check-generalization.js` (same file — read it in full first, this task is "copy the pattern, change what it watches for," not a redesign):

- Same `git diff --name-only <baseRef>...HEAD` / `addedLines(file)` helpers (`check-generalization.js`'s own `git()`, `changedFiles()`, `addedLines()` — reuse verbatim, don't reimplement).
- Same posture: flag it, `exit 1`, don't try to judge intent, print exactly what to do about it.
- **What it watches for** (three real producer locations, confirmed against current code — verify they still match before trusting this list, code drifts):
  - `pipeline/src/analysis/coverage-report.ts` — any added line matching a `silenceFlags.push(` call, or a new string literal that looks like a silence-flag id (the existing S1/S2/S5/S5-cfn/S6 naming convention: `` `S<n>-...` `` inside a template string).
  - `pipeline/src/types/typed-facts.ts` — any added line inside the `IgnoredItem.reason` union (the `'TEST_CODE' | 'GENERATED_CODE' | ...` block).
  - `tools/review-session/triage.py` — any added line inside `_TRIGGER_MAP` (a new dict key).
- **Required companion**: if any of the three above changed, the same diff must also touch `docs/solution/Architect_Residual_Review_Session.md`. If not, fail loud, same message shape `check-generalization.js` already uses (name the specific file that changed, point at §3, point at the `CLAUDE.md` rule).

## A real wiring problem, found researching this task — resolve it explicitly, don't let it hide

`check-generalization.js` runs via `.github/workflows/pipeline-test.yml`, which only triggers `on: push/pull_request: paths: ['pipeline/**', '.github/workflows/pipeline-test.yml']` (confirmed directly, `pipeline-test.yml:11-18`). **`tools/review-session/triage.py` is outside `pipeline/`** — a commit touching only `triage.py`'s `_TRIGGER_MAP` would never trigger this workflow at all, meaning the new check would silently never run for exactly the drift case that motivated it (this doc's own history: the original drift was a `triage.py`-only change).

Two ways to close this — pick one and say which, and why, when you close this task:
1. **Extend `pipeline-test.yml`'s `paths:` filters** to also include `tools/review-session/**` and `docs/solution/Architect_Residual_Review_Session.md`. Simplest, one CI file. Real tradeoff: this workflow is named/scoped "pipeline test" — widening its trigger paths means it now also runs (and blocks) on changes that have nothing to do with the pipeline itself (e.g. a `tools/review-session/README.md` typo fix), a scope change worth being deliberate about, not silent.
2. **A second, narrower workflow** scoped to `tools/review-session/**` + `docs/solution/Architect_Residual_Review_Session.md`, running only this new check (not the full `npm test` regression suite). More files, but keeps `pipeline-test.yml`'s existing scope/name honest.

Recommendation, not a mandate: option 2 — the two checks protect genuinely different things (pipeline regression correctness vs. this suite's own doc/code sync) and bundling them under "pipeline test" is itself a small naming/scope drift. But this is a real judgment call; state your reasoning when you close this task, don't just silently pick one.

## Verification

Same discipline `check-generalization.js`'s own `BACKLOG.md` row used (found via `git log`/`BACKLOG.md`, cited there as the verification bar to match) — a disposable scratch clone, three real scenarios:
- A producer change (e.g. add a line to `triage.py`'s `_TRIGGER_MAP`) with no doc change in the same diff → fails, clear message naming the file and pointing at §3.
- The identical producer change, `Architect_Residual_Review_Session.md` also touched in the same diff → passes.
- An unrelated change (e.g. a comment-only edit in an unrelated file) → passes, unaffected.
- Whichever CI wiring option you pick (see above): confirm with a real test push/PR (or at minimum, trace through the exact `paths:` glob logic by hand against the three producer file paths) that the workflow actually fires for a `triage.py`-only change — this is the one thing that must not be assumed working, it's the entire reason this task exists.
