# Weaver residual review session tools

Offline tooling that turns a `run-slice` output directory into an architect-friendly **Session Pack** for reviewing what a scan left open (S1/S2/S5/low-architecture-coverage residuals), then applies decisions back through Weaver's existing Decision Record + Override mechanism.

**Design authority:** [`docs/solution/Architect_Residual_Review_Session.md`](../../docs/solution/Architect_Residual_Review_Session.md)
**Task list:** [`docs/solution/AGENT_TASKS_Residual_Review_Session.md`](../../docs/solution/AGENT_TASKS_Residual_Review_Session.md)
**Status:** RS-1 through RS-4 CLOSED. The full human-only path (pack → choice cards → hand-authored drafts → validate → apply) works end-to-end for real. Tier B drafting's PRIMARY path is in-chat — Copilot Chat's own `editFiles` tool, bound by the §5.1 rules in `.github/chatmodes/residual-review.chatmode.md`; `draft_tier_b.py` is a secondary, headless/scripted alternative, not the default. One real, named gap either way: `triage.py` never classifies anything Tier B yet, so neither path has real production input today. RS-5 (hardening/portability) is next. See the task list for what's built vs. not yet.

## Non-negotiable rules (S1–S12 — do not violate, do not skip)

1. **Nothing here is ever imported by `pipeline/src/orchestration/run-slice.ts`** or anything in its call graph. This is offline, human-invoked tooling — never part of the deterministic core.
2. **Never write or edit `typed-facts.json`.** Read-only over every Weaver artefact.
3. **The only legal write path into CALM is Decision Record + Override**, applied via `run-slice.js --from-facts --overrides` (the existing `override-applier.ts`) — never a direct CALM edit, never a silent apply from a chat agent.
4. **Apply requires an explicit, confirmed human action.** A VS Code Copilot Chat mode bound to a Session Pack must never be granted unrestricted terminal access — see `.github/chatmodes/` (T-RS1-5) for the enforcement mechanism.
5. **Every draft is evidence-first.** No node, relationship, unit id, file path, or line number may be introduced that isn't already in the pack's own evidence.
6. **Insufficient evidence → `cannot_decide`, never a guess.** This is a correct, expected outcome, not a failure.
7. **No sample-repo hardcodes.** Residual logic is generic across languages/frameworks — no Fineract/BoA/etc. class names baked into detection.
8. **Redact secrets before any snippet reaches disk.** Every redaction path needs a fixture test with a known fake secret.
9. **Bulk-apply still writes one Decision Record per residual**, never one blanket record for a batch.
10. **Never claim a residual session closed a standing exam** (e.g. `E-charge-single-L2`) — that's the layered-architecture-story program's domain, not this one's.
11. **Unmapped signal clusters go through the catalogue lane** (`suggest-rules.ts` / a proposal file), never an auto-merge into `signal-catalogue.yml`.
12. **No fabricated `control_add`** — controls stay catalogue-driven or left open in v1 (see design doc H4).

Full detail and rationale for each: `AGENT_TASKS_Residual_Review_Session.md` §0.3.

## Layout (as pieces land)

```
tools/review-session/
  README.md              this file
  pack.py                 (T-RS1-2, built) run-slice out-dir -> Session Pack
  triage.py               (T-RS1-3 MVP, built) builds residuals.json (Tier A/B/C) from review-queue.json
  redact.py                (built) S8 secret-redaction, used by pack.py before any snippet reaches disk
  cards.py                 (T-RS1-4, built) deterministic choice-card generator, fixed per-class templates
  residuals-schema.json    (built) JSON Schema for residuals.json
  test_pack.py             (built) real end-to-end: run-slice -> pack.py against the checked-in NestJS fixture; refuse-overwrite; missing-input failure
  test_redact.py           (built) redaction fixture test — fake AWS key/bearer token/private key/connection-string password
  test_triage.py           (built) trigger -> tier/class mapping tests
  test_cards.py            (built) card determinism + real-units-only candidates + Tier C never invents relationship_add
  test_chatmode_safety.py  (built) static proof the chat-mode's tools: allowlist excludes every known terminal tool
  validate_drafts.py      (T-RS2-1, built) schema + integrity checks on drafts/, mirrors override-applier.ts's real validation logic
  test_validate_drafts.py (built, 16 tests) good fixture passes; bad fixtures (dangling DR ref, superseded decision, dangling relationship endpoint, orphaned target_ref, unknown override_type, relationship_remove orphan) fail with clear reasons — includes 3 regression tests for real bugs found+fixed on self-review (check-order mismatch, same-batch node_add over-trusting, missing relationship_remove existence check)
  examples/                (T-RS2-2, built) worked Decision Record + Override pair (synthetic), README explaining the manual draft path — no LLM required
  effective_ir.py          (T-RS2-3 MVP, built) provenance + node/relationship counts + open residuals + decision log — full 8-section §7.1 template deferred to B-calm-portable-ir
  test_effective_ir.py     (built) non-empty output, MVP-scope-note present, never touches intelligence-ir.md
  apply.py                (T-RS3-1/T-RS3-2, built) the ONLY place that invokes run-slice/override-applier — validate -> confirm -> merge drafts -> apply -> apply-report.md/decisions-log.md
  test_apply.py            (built, 5 real end-to-end tests) real type_change applies, calm validate 0 errors, refuses without confirmation, refuses on validation failure, decision+override filename collision handled correctly (regression test for a real bug found+fixed on review)
  draft_tier_b.py          (T-RS4-1/T-RS4-2, built) SECONDARY/headless Tier B drafting path — §5.1 system prompt, stdlib-only network call, a fully-testable guardrail. The PRIMARY path is in-chat: Copilot Chat's own editFiles tool, bound by the same §5.1 rules embedded in .github/chatmodes/residual-review.chatmode.md — use this script only for scripted/batch runs outside a chat session. No key -> reports what it would attempt, writes nothing. Real, named gap: no trigger in triage.py produces Tier B yet, so neither path has real production input today; this script's live-model path has never run against a real API here (no key set) — the in-chat path doesn't need one, since Copilot Chat supplies its own model
  test_draft_tier_b.py     (built, 14 tests) all 6 named trap fixtures (100% on refusal cases) + 6 more guardrail tests, all against synthetic responses (no live model call) + real CLI no-key-path tests
```

`triage.py`'s `apply_baseline()` (T-RS3-3) is real too — `pack.py --baseline <prior-session-dir>` carries forward already-decided residuals (never re-asked) and flags real drift as `reconfirm` (never silently overwritten). See `test_triage.py`'s `TestApplyBaseline` for the unit tests, and the T-RS3-3 changelog entry in `AGENT_TASKS_Residual_Review_Session.md` for the real two-pack proof.

Session Packs are written to `review-sessions/<run-id>/` at the repo root (gitignored by default — see `Architect_Residual_Review_Session.md` §4.1 for why, and the redaction/audit convention for the pieces worth checking in).

## How to run

```bash
# all unit tests + real end-to-end (needs pipeline/dist built)
cd tools/review-session
python3 -m unittest test_redact test_triage test_cards test_pack test_chatmode_safety test_validate_drafts test_effective_ir test_apply test_draft_tier_b -v

# build a real pack from a real run-slice out-dir
node ../../pipeline/dist/orchestration/run-slice.js <package-root> --out /tmp/my-run
python3 pack.py --out-dir /tmp/my-run --session-dir ../../review-sessions/my-run

# hand-author drafts (see examples/README.md), then validate before applying
python3 validate_drafts.py --session-dir ../../review-sessions/my-run --calm /tmp/my-run/architecture.calm.json

# apply (the only command that ever calls run-slice/override-applier) — re-validates itself, requires confirmation
python3 apply.py --session-dir ../../review-sessions/my-run --out /tmp/my-run-reviewed

# a later rescan: carry forward what's already been decided instead of re-asking
python3 pack.py --out-dir /tmp/my-run-2 --session-dir ../../review-sessions/my-run-2 --baseline ../../review-sessions/my-run

# effective architecture summary (MVP)
python3 effective_ir.py --calm /tmp/my-run-reviewed/architecture.calm.json --session-dir ../../review-sessions/my-run \
  --out ../../review-sessions/my-run/effective-architecture-ir.md

# Tier B drafting: normally happens IN Copilot Chat (editFiles tool, no key needed — see the
# chat-mode file). draft_tier_b.py is only for a headless/scripted run outside a chat session:
python3 draft_tier_b.py --session-dir ../../review-sessions/my-run  # needs ANTHROPIC_API_KEY
```

`pack.py` refuses to overwrite a session dir that already has unapplied drafts (fails loud, exit code 1) — apply or discard first.

## Language

Python (per RS-0's locked decision — `AGENT_TASKS_Residual_Review_Session.md` §0.5). No third-party dependencies — everything above uses only the standard library (`argparse`, `json`, `re`, `pathlib`, `unittest`), matching Simplicity First; add one only when a real, evidenced need shows up. Weaver's own pipeline stays TypeScript/Node; this tooling only ever calls it as a subprocess (`node dist/orchestration/run-slice.js ...` / `node dist/analysis/ir/hitl-review-trigger.js ...`), never re-implements `override-applier.ts`'s logic in Python.
