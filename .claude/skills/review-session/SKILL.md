---
name: review-session
description: This skill should be used when the user wants to turn a Weaver run-slice scan (or a package-root they haven't scanned yet) into a reviewed, applied architecture.calm.json without hand-running the individual tools/review-session/ scripts. It orchestrates the full loop — scan, dossier, Tier B drafting, interactive Tier A review, validate, apply, validate — asking the architect only for the decisions that must be a real human judgment. Use when the user says things like "review this scan", "complete the architecture", "run the review session", "get me a reviewed CALM file", or names package roots and asks for a finished architecture.
user-invocable: true
allowed-tools:
  - Bash(node *)
  - Bash(python3 *)
  - Bash(npm run validate*)
  - Bash(find *)
  - Bash(ls *)
  - Read
  - Edit
  - Write
  - AskUserQuestion
---

# /review-session — the full post-run-slice loop, one command

**This is a second delivery vehicle for the same design `.github/agents/residual-review.agent.md`
implements for VS Code Copilot Chat** (`Architect_Residual_Review_Session.md` §4.4 named that as
the decided vehicle; this skill extends it, not replaces or re-derives it). **Read that file now
before doing anything else** — its hard rules for how a card is presented, what Tier B may draft,
and what must never be invented apply here exactly as written. This file adds ORCHESTRATION on
top: owning the full loop end to end, not a new review protocol.

**The `allowed-tools` list above is hygiene, not the safety boundary** — same corrected framing
`residual-review.agent.md` itself states: a declared tool list is friction, not a sandbox. **The
one guarantee that actually holds is `apply.py`'s own confirmation gate** (step 11 below). Never
pass `--i-confirm-apply` to `apply.py` without having already gotten a real, explicit "yes, apply"
answer from the user via `AskUserQuestion` in THIS conversation, for THIS run. Never invoke
`run-slice.js --overrides` or `override-applier.ts` any other way.

## Step 0 — determine mode

- If the user gave an existing `--session-dir` (or a directory that already has `manifest.json` +
  `residuals.json` in it), this is a **resume** — skip to Step 4 using that session dir.
- Otherwise this is a **fresh scan** — the user gave one or more package roots. Ask for an out-dir
  and session-dir if not given (suggest `review-sessions/<short-name>` for the session dir, matching
  every existing example in `tools/review-session/README.md`).

## Step 1 — auto-detect evidence sources, confirm once

Before running `run-slice.js`, check under the given package roots (and their common ancestor) for:
- A `kubernetes-manifests/`-shaped directory (real k8s YAML: `kind: Deployment`/`StatefulSet`/`ConfigMap`) → offers `--k8s-manifests <dir>` and, since it exists, `--enable-env-soft-graph` too (harmless without `--k8s-manifests`, so only offer it alongside).
- A `build.gradle`/`build.gradle.kts` with a checked-in `gradlew`, or a `pom.xml` with a checked-in
  `mvnw`, at the common ancestor → offers `--auto-codeql` (real license text is in the top-level
  `README.md`'s CodeQL section — do not enable this without asking; it's a real per-org license
  consideration, not just a cost one).

Ask **one** `AskUserQuestion` listing what was found and which flags it would add, with a plain
"no extras, bare scan" option. Do not ask once per flag.

Run:
```
node pipeline/dist/orchestration/run-slice.js <roots...> --out <out-dir> [flags from above]
```
Report the real summary line (`[run-slice] wrote artefacts to ...`) — if it exits non-zero, stop
and show the real stderr, do not retry blindly.

## Step 2 — pack, with dossier by default

Check LLM backend availability first: `claude -p "OK" 2>&1` (or simpler — just try
`command -v claude`). If found:
```
python3 tools/review-session/pack.py --out-dir <out-dir> --session-dir <session-dir> --with-dossier
```
If not found, run without `--with-dossier` and say plainly that no dossier pass ran because the
`claude` CLI wasn't on PATH — never silently skip this without saying why.

## Step 3 — draft Tier B automatically

```
python3 tools/review-session/draft_tier_b.py --session-dir <session-dir>
```
Safe to run unprompted — it only ever writes to `drafts/decisions/`+`drafts/overrides/`, gated by
its own guardrails. Note the current timestamp before running it, so Step 5 can find files newer
than that timestamp (the reliable way to know what THIS run drafted — read the actual JSON files,
never parse stdout as the source of truth for what was drafted).

## Step 4 — read the pack

Read `<session-dir>/residuals.json`. Each residual's `card` field is markdown in this exact,
reliable shape (from `cards.py`'s `render_card_markdown`):
```
### R-014 (Tier B: some-class)

<rationale>

- **[1]** <label> — <detail>
- **[2]** <label> — <detail>
...
```
Extract `id`, `tier`, and the numbered `[key] label — detail` options directly from this text —
**never re-derive, shorten, or invent an option; the card is the complete artifact.** A "My read
(not a decision):" paragraph after the options, if present, came from the dossier — show it
verbatim too, never write your own in its place.

If any option's label is **"Need a bounded extra-read"**, that residual's evidence was too short
at pack-build time. Before presenting that residual, run (exact-range or `--anchor`, whichever the
evidence gap implies — see `residual-review.agent.md`'s "Extra-read" section for both forms):
```
python3 tools/review-session/pack.py fetch-span --session-dir <session-dir> --residual-id <id> --anchor <file:line> --context-lines 15
```
**This appends to `evidence/packs.json` but does NOT re-render `residuals.json`'s own `card`
field** — read the newly appended entry in `evidence/packs.json` yourself and show its content
alongside the existing card when you present that residual, rather than presenting a now-stale
card that still claims no evidence exists. If the session cap (10 reads / 400 lines) is hit,
`fetch-span` refuses (exit 1) — say so and present the residual as-is, `cannot_decide` remains a
correct, expected outcome.

## Step 5 — present every Tier B draft for Accept/Reject/Edit

For each Tier B residual, check whether `drafts/decisions/*.json` (newer than Step 3's timestamp)
contains a decision whose `residual_id` matches. If yes, show what was drafted (the decision's
`rationale`, `final_decision`, and the override's `override_type`/`new_value` if one exists) and
ask via `AskUserQuestion`: Accept as-is / Reject (remove the drafted files) / Edit (ask what to
change, then rewrite the JSON). **A file existing under `drafts/` is a proposal, never an
approval** (`residual-review.agent.md` hard rule 6.1.9) — never silently carry a Tier B draft
into Step 11 without this step. If the residual instead got `cannot_decide`, just note it —
nothing to accept/reject, it stays open.

Batch up to 4 residuals per `AskUserQuestion` call (its own limit).

## Step 6 — present Tier A cards, batched

Same batching (up to 4 per `AskUserQuestion` call), same verbatim-card discipline as Step 4/5.
This is a disclosed, deliberate pacing deviation from `residual-review.agent.md` hard rule 5
("one at a time") — the actual protection that rule exists for (the architect must answer every
one themselves, never decided on their behalf) still holds exactly: `AskUserQuestion` cannot be
answered by you, and every residual still gets its own real answer.

## Step 7 — Tier C: show, never decide

Display each Tier C residual's dossier explanation (if present) as information only. No
`AskUserQuestion`, no draft — `residual-review.agent.md`'s Tier C rule is "document or leave
open," never invented, full stop.

## Step 8 — write Decision Records (+ Overrides) as each batch is answered

Write immediately after each `AskUserQuestion` batch resolves — don't wait until the very end.
**Copy the exact field names from `<session-dir>/AGENTS.md`'s "The real Decision Record / Override
shape" section** (worked examples, generated fresh by `pack.py` for this exact pack) — never
invent field names. Every Decision Record needs a real `residual_id` (the id of the residual it
answers — **required**, added 2026-09-04) alongside `decision_id` (a new id you invent for the
draft itself, e.g. `D-<residual-id>-001`). `reviewer` is `architect:<a real identifier for the
user, e.g. their git user.name>` for a Tier A answer you're transcribing from the user — never
`llm-advisory:...` for that; `llm-advisory:<model>` is only for what Step 3/5 already drafted
and the user accepted as-is.

## Step 9 — validate the drafts

```
python3 tools/review-session/validate_drafts.py --session-dir <session-dir> --calm <out-dir>/architecture.calm.json
```
If it reports errors, show them and ask the user how to proceed (fix the named file, or leave that
one residual undecided) — never silently drop a malformed draft and never guess a fix.

## Step 10 — one final, explicit confirmation

Before applying, compute and show the real completeness picture — either run a throwaway Python
one-liner calling `validate_drafts.summarize_by_trigger` against `residuals.json` + the loaded
decisions, or just run `apply.py` interactively and let it print its own real completeness table
(it does this automatically, before the confirmation prompt, as of 2026-09-04). Then ask exactly
one `AskUserQuestion`: **apply now, or stop here and leave the drafts for manual review** — no
other phrasing implies consent. Do not proceed on an ambiguous or implied yes.

## Step 11 — apply, only on explicit yes

```
python3 tools/review-session/apply.py --session-dir <session-dir> --out <new-out-dir> --i-confirm-apply
```
`--i-confirm-apply` is what lets this now-non-interactive call proceed — the real human
confirmation already happened at Step 10, the same pattern `bulk_apply.py`'s own
`--i-confirm-bulk-apply` already establishes for a scripted caller that already got its own
separate confirmation. **Never run this command before Step 10's explicit yes, under any
circumstance, no matter how confident a Tier B draft looked.**

## Step 12 — validate the result

```
cd pipeline && npm run validate -- <new-out-dir>/architecture.calm.json -f pretty
```
Surface errors/warnings directly. A non-zero exit here is real information, never swallow it.

## Step 13 — final report, honest about what's not resolved

State: how many residuals total, how many decided (by trigger class — `apply.py`'s own printed
table already has these real numbers, reuse them, don't recompute by hand), and **explicitly name
anything still open** — genuinely unresolvable residuals (`cannot_decide`, no fabrication), Tier C
items (documented, not decided by design), anything the user chose to skip. Never imply full
completeness when residuals remain open — this project's own real BOA review earlier learned this
the hard way (see `docs/solution/BACKLOG.md`'s "Session Pack completeness visibility" row).

## Never

- Never write to anything outside `<session-dir>/drafts/` and the files this skill's own steps
  above explicitly create.
- Never edit `typed-facts.json`, anywhere.
- Never invoke `run-slice.js --overrides`, `apply.py`, or anything touching `override-applier.ts`
  except at Step 11, and only after Step 10's real, explicit confirmation in this conversation.
- Never invent a file path, line number, node id, or relationship that isn't already in the pack's
  own evidence.
- Never decide a Tier A residual, or silently accept a Tier B draft, on the user's behalf.
