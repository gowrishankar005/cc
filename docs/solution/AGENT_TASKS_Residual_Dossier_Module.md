# AGENT TASK — Build the shared evidence-assembly module + opt-in Evidence Dossier pass (T-2)

**Lane:** Independent · **After** T-1 (closed 2026-08-23)
**Governance/DoD:** `docs/solution/Architect_Residual_Review_Session.md` §3 (the Tier/Dossier design) and `docs/solution/AGENT_TASKS_Residual_Assist_Redesign.md`'s own T-2 row (this file executes that row — read both if you want the full history, but everything you need to build is below)
**Why this file exists:** T-1 (real live-model runs, 2026-08-23) closed the open question this task used to have — the dossier pass is opt-in, not automatic, and the network boundary (`_call_llm`) already exists, tested, and bug-fixed in both `draft_tier_b.py` and `advisory.py`. This is a real, scoped, one-session build, not a design task.

## What you're building

1. `tools/review-session/llm_common.py` — a new shared module holding the evidence-assembly + network-boundary logic `advisory.py` and `draft_tier_b.py` currently duplicate. Both files call it; neither keeps its own copy after this lands.
2. An opt-in `pack.py --with-dossier` flag that runs an Evidence Dossier pass over every open residual (any tier) when set, attaching an additive `dossier` field to each in `residuals.json`.

## Non-negotiable constraints (violating any of these is not "done, with a caveat" — it's not done)

- **No `ANTHROPIC_API_KEY` fallback, anywhere, ever.** The backend is the `claude` CLI only. This is an owner directive (2026-08-23): this project's fintech target-customer profile doesn't leave API keys in environment variables for an LLM to pick up. Do not add one back "for flexibility."
- **`user_prompt` is piped via `subprocess.run`'s `input=`, never passed as a positional argv value.** Real evidence snippets from the scanned repo live in that string — argv values are visible to other processes on the machine (`ps`, `/proc/<pid>/cmdline`), which would undermine this suite's own redaction discipline (S8). This was a real bug found and fixed on 2026-08-23; do not regress it while moving the code.
- **The dossier pass is opt-in, not automatic.** T-1 measured $0.08–$0.32 and 40–132s per residual via the `claude` CLI backend — running it unprompted on every `pack.py` build is the wrong default, the same reasoning `--auto-codeql` already established in this repo. `pack.py` with no `--with-dossier` flag must behave exactly as it does today.
- **A dossier is never a second corroborating signal for a fact.** A human accepting a dossier hypothesis via a card is one human judgment, same rule `advisory.py`'s existing system prompt already states — don't weaken it when consolidating.

## Step 1 — extract `llm_common.py`

Move these (near-identical today across the two files — verify the small differences below before assuming they're truly identical):

- `_llm_backend_available()` (`draft_tier_b.py:94`, `advisory.py:138`) — identical, `bool(shutil.which("claude"))`.
- `_call_llm(system_prompt, user_prompt, model=...)` (`draft_tier_b.py:151`, `advisory.py:146`) — check the default `model` value in each (`draft_tier_b.py` defaults to `"claude-sonnet-4-5-20250929"`; `advisory.py` defaults to its own `MODEL` constant, currently the same string) before collapsing to one default. Keep the `input=user_prompt` stdin behavior exactly as-is (see constraints above) and the `CLAUDE_CLI_TIMEOUT_SECONDS = 240` constant (currently duplicated as a bare `240` in `advisory.py` — bring both under one named constant in the shared module).
- `_strip_markdown_json_fence(text)` and its `_FENCED_JSON_RE` regex (`draft_tier_b.py:172`, `advisory.py:190`) — identical, keep the two-round comment explaining why (bare fence, then prose-before-fence).

`advisory.py` and `draft_tier_b.py` then `from llm_common import _llm_backend_available, _call_llm, _strip_markdown_json_fence` (or import the module and reference `llm_common.X` — match this suite's existing import style, check `pack.py`'s own `from consequence import annotate_residuals` for the convention already in use). Each file's own `parse_and_validate_response` stays where it is — the response *shape* each expects is different (decision/override vs. explanation/hypotheses), only the *call mechanism* is shared.

## Step 2 — the dossier pass

New function in `llm_common.py` (or a new small `dossier.py` if you find the responsibility doesn't fit cleanly in a "network boundary" module — your call, but justify it in the commit message if you split it out): given a residual + its unit_index/packs context, build a prompt and call `_call_llm`, returning `{"explanation": ..., "hypotheses": [...], "evidenceRefsUsed": [...]}` or a `no_key`/`invalid_response`/`cannot_decide`-shaped outcome, same outcome-dict convention `draft_for_residual`/`advise_for_residual` already use. This is largely `advisory.py`'s existing `build_advisory_prompt` + `SYSTEM_PROMPT` + `parse_and_validate_response`, generalized to run on any tier (today it's already tier-agnostic in practice — confirm that's still true, don't assume).

Wire it into `pack.py`:
- New flag: `parser.add_argument("--with-dossier", action="store_true", help="...")` alongside the existing flags at `pack.py:58-63`.
- When set, after residuals are built (see `pack.py`'s existing `annotate_residuals` call around line 129-133 for where per-residual enrichment passes already run — the dossier pass belongs in the same neighborhood) and a `claude` CLI backend is available, run the dossier pass over every open residual and attach `dossier` to each, same shape `residuals-schema.json`'s existing `advisory`/`consequence` fields already use (see schema lines ~57 and ~69 for the pattern to mirror — add a new `dossier` property alongside them).
- No `claude` CLI on PATH (even with `--with-dossier` set) → log what would have been attempted, write a normal dossier-less pack. No `--with-dossier` at all → don't even check for a backend, behave exactly as `pack.py` does today.

## Step 3 — Tier B's `draftOutcome` state (from §3's redesign, not yet implemented anywhere)

When `draft_tier_b.py` (or the eventual dossier-aware equivalent) attempts a Tier B draft and the evidence bar isn't met, the residual should gain `draftOutcome: "bar-not-met"` in `residuals.json` rather than silently reading identically to a residual that was never Tier-B-eligible at all. Check `draft_tier_b.py`'s `parse_and_validate_response`'s `cannot_decide` outcome path and `main()`'s result-writing loop (`draft_tier_b.py:main`, the `for residual_id, outcome, detail in results:` loop) — this is where to record it.

## Verification

- `cd tools/review-session && python3 -m unittest discover -s . -p "test_*.py"` — full suite must stay green (182 tests before this task; expect it to grow with your new tests, never shrink coverage of existing behavior).
- New tests needed (synthetic responses, no live backend — same convention every existing test in this suite already uses): dossier attaches for a Tier A, a Tier B, and a Tier C residual alike; no-`claude`-CLI path still produces a normal pack with `--with-dossier` set; no-`--with-dossier` path never even calls `_llm_backend_available`; Tier B bar-not-met is recorded as `draftOutcome: "bar-not-met"`, not silently indistinguishable from never-eligible.
- **One real, live confirmation before calling this done** (per this repo's own "before claiming a fix works, run it against a real fixture" rule, and matching what T-1 already did): build a real Session Pack from a real fixture scan, run `pack.py --with-dossier` against it for real, and confirm a real `dossier` field lands in `residuals.json` with real evidence-grounded content — not just green synthetic-response tests. Paste real (redacted-of-nothing-sensitive, per T-1's own precedent) output into this file or a linked note when closing it.
- `grep -rn "ANTHROPIC_API_KEY" tools/review-session/` after this task — every remaining hit should be explaining why it's *not* used, never presenting it as a live option.

## Closed (2026-08-23)

Offline suite: 215 tests pass (182 baseline + 33 new across `test_llm_common.py`, `test_dossier.py`, `test_draft_tier_b.py`'s new `draftOutcome` tests, and `test_pack.py`'s new `--with-dossier` tests), 0 fail.

`llm_common.py` now holds `build_evidence_prompt`, `known_evidence_refs`, `_llm_backend_available`, `_call_llm` (stdin `input=`, `CLAUDE_CLI_TIMEOUT_SECONDS = 240`), and `_strip_markdown_json_fence`; `advisory.py` and `draft_tier_b.py` both import from it and no longer keep their own copies. `dossier.py` is a new file (not folded into `llm_common.py`) — its response shape (`explanation`/`hypotheses`/`evidenceRefsUsed`) and guardrail are distinct enough from `advisory.py`'s own `catalogue_rule_candidate` shape to warrant a separate module, same reasoning the task file's own step 2 anticipated. `pack.py --with-dossier` runs it over every open residual (any tier) after `evidence/packs.json` is built; no flag → pack.py never even imports/checks for a `claude` CLI backend (verified directly, not just by inspection: `test_pack.py`'s `test_without_with_dossier_flag_backend_check_never_invoked` mocks `_llm_backend_available` and asserts zero calls when the flag is absent).

**Real bug found during the required live confirmation, not by any synthetic test**: the first live `pack.py --with-dossier` run against the checked-in NestJS fixture came back `invalid_response` — the model correctly cited `src/users.controller.ts:3` (part of its own prompt's evidence_snippets), but the guardrail's `known_refs` set was built from `residual.evidenceRefs` alone, which is genuinely empty for the `S2-http-without-security-control` trigger class (the real evidence lives on the *unit's* own `evidenceRefs` in `unit_index`, which `build_evidence_prompt` does include). Fixed via `llm_common.known_evidence_refs(residual, unit_index)`, a union of both sources; `dossier.py`'s guardrail now takes `unit_index` as a parameter. **This same gap exists in `advisory.py`'s `parse_and_validate_response` (only checks `residual.get("evidenceRefs", [])`)** — flagged here as a known, disclosed follow-up rather than silently patched over; out of this task's own declared scope (T-1 already closed advisory.py's live-run gap), so not changed by this task.

Live confirmation (2026-08-23, `claude` CLI, real NestJS fixture, ~62s wall-clock for the one real residual after the fix above):

```
$ python3 pack.py --out-dir /tmp/dossier-live-out --session-dir /tmp/dossier-live-session --with-dossier
[pack] --with-dossier: backend claude CLI
[pack] dossier R-001: dossiered
[pack] wrote Session Pack to /tmp/dossier-live-session (1 residual(s))
```

Real `dossier` field that landed in `residuals.json` (`R-001`, trigger `S2-http-without-security-control`):

```json
{
  "explanation": "The NestJS controller exposes three HTTP endpoints (@Get, @Post) for user operations with no visible security decorators such as @UseGuards or @Auth. The pipeline's catalogue detected HTTP-entry-point evidence but found no matching security-control patterns in the scanned code.",
  "hypotheses": [
    "Authentication/authorization controls are genuinely absent from these endpoints, leaving them unprotected",
    "Security controls exist but use patterns outside the pipeline's current catalogue detection scope (custom decorators, specific middleware configurations, or framework mechanisms not yet mapped)",
    "Protection is enforced at a layer external to this file (API gateway, global NestJS guards, or infrastructure-level auth) that the pipeline's file-scoped analysis cannot observe",
    "The endpoints are intentionally public, though this would be atypical for operations that create and retrieve user data"
  ],
  "evidenceRefsUsed": [],
  "model": "claude-sonnet-4-5-20250929",
  "generatedAt": "2026-08-23T17:46:08.389712+00:00"
}
```

`grep -rn "ANTHROPIC_API_KEY" tools/review-session/` after this task: every hit is in a docstring/comment explaining why it's deliberately not used (`llm_common.py`, `advisory.py`, `dossier.py`, plus the pre-existing `draft_tier_b.py`/README hits) — none present it as a live option.
