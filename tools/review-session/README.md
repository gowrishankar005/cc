# Weaver residual review session tools

Offline tooling that turns a `run-slice` output directory into an architect-friendly **Session Pack** for reviewing what a scan left open (S1/S2/S5/low-architecture-coverage, plus unmapped-signal clusters and ignored INSUFFICIENT_EVIDENCE / AMBIGUOUS_BOUNDARY leftovers), then applies decisions back through Weaver's existing Decision Record + Override mechanism. Extra-read of source, if the pack is short, is `pack.py fetch-span` — architect-run, never Copilot, never MCP.

**Design authority:** [`docs/solution/Architect_Residual_Review_Session.md`](../../docs/solution/Architect_Residual_Review_Session.md)
**Status:** The full human-only path (pack → choice cards → hand-authored drafts → validate → apply) works end-to-end for real. Tier B drafting's PRIMARY path is in-chat — Copilot Chat's own `editFiles` tool, bound by the §5.1 rules in `.github/agents/residual-review.agent.md`; `draft_tier_b.py` is a secondary, headless/scripted alternative, not the default. T-FS-1 (`docs/solution/AGENT_TASKS_Ext_Fact_Semantics.md`, `BACKLOG.md` "Tier-B residual detection") gave `triage.py` its first real Tier B producer — `multi-hop-single-candidate-below-threshold`, from `multi-hop-bridge-detector.ts`'s own `tier-b-single-candidate` ignored-item (one real store candidate among a bridge's several syntactic implementers). **T-1 (`docs/solution/AGENT_TASKS_Residual_Assist_Redesign.md`, 2026-08-23) closed the live-model gap for real** — `draft_tier_b.py` and `advisory.py` have both now been run against a real, live backend (the `claude` CLI, already authenticated — deliberately never a raw `ANTHROPIC_API_KEY` from the environment, which doesn't match this project's fintech target-customer profile; see either script's own module docstring). T-RT-1 (`bulk_apply.py`, replicate one answered residual across its similar-class siblings), T-RT-2 (`consequence.py`/`queue_rank.py`, consequence-ranked backlog), and T-RT-4 (`advisory.py`, reviewer-assistance advisory layer — explains evidence, proposes hypotheses, drafts catalogue-rule candidates, **never writes a fact**) are done — see `docs/solution/Claim_Register.md`'s `T-RT-1-bulk-residual-authoring` / `T-RT-2-consequence-ranked-queue` / `T-RT-4-reviewer-assistance-advisory` rows for evidence and honest scope limits (bulk-apply not yet run against a real multi-residual scan; consequence signals are named proxies, not a real PII detector). T-RT-3 (call-site security controls, beyond the 4 named vocabularies) is not started. **T-2 (`docs/solution/AGENT_TASKS_Residual_Dossier_Module.md`, 2026-08-23) is done** — `llm_common.py` now holds the evidence-assembly + network-boundary logic advisory.py and draft_tier_b.py used to each duplicate; the opt-in Evidence Dossier pass (`dossier.py`, `pack.py --with-dossier`) attaches an additive `dossier` field to every open residual (any tier), confirmed against a real live `claude` CLI run on the checked-in NestJS fixture; `draft_tier_b.py` now records `draftOutcome: "bar-not-met"` when a Tier B residual's evidence bar genuinely wasn't met. Hardening/portability work is next — see the design doc for what's built vs. not yet.

## Non-negotiable rules (S1–S12 — do not violate, do not skip)

1. **Nothing here is ever imported by `pipeline/src/orchestration/run-slice.ts`** or anything in its call graph. This is offline, human-invoked tooling — never part of the deterministic core.
2. **Never write or edit `typed-facts.json`.** Read-only over every Weaver artefact.
3. **The only legal write path into CALM is Decision Record + Override**, applied via `run-slice.js --from-facts --overrides` (the existing `override-applier.ts`) — never a direct CALM edit, never a silent apply from a chat agent.
4. **Apply requires an explicit, confirmed human action.** `apply.py` — the only code path that ever writes to CALM from a Session Pack — refuses to run without its own separate, explicit confirmation, regardless of what any chat client, host, or IDE auto-approve setting already did upstream; a drafted file under `drafts/` is inert until that step runs. A VS Code Copilot Chat mode bound to a Session Pack must never be granted unrestricted terminal access as additional, worthwhile friction on top of that — see `.github/agents/` for the declared-tools restriction, not as the primary guarantee.
5. **Every draft is evidence-first.** No node, relationship, unit id, file path, or line number may be introduced that isn't already in the pack's own evidence.
6. **Insufficient evidence → `cannot_decide`, never a guess.** This is a correct, expected outcome, not a failure.
7. **No sample-repo hardcodes.** Residual logic is generic across languages/frameworks — no third-party class names baked into detection.
8. **Redact secrets before any snippet reaches disk.** Every redaction path needs a fixture test with a known fake secret.
9. **Bulk-apply still writes one Decision Record per residual**, never one blanket record for a batch.
10. **Never claim a residual session closed a standing exam** (e.g. `E-charge-single-L2`) — that's the layered-architecture-story program's domain, not this one's.
11. **Unmapped signal clusters go through the catalogue lane** (`suggest-rules.ts` / a proposal file), never an auto-merge into `signal-catalogue.yml`.
12. **No fabricated `control_add`** — controls stay catalogue-driven or left open in v1 (see design doc H4).

Full detail and rationale for each: `Architect_Residual_Review_Session.md` §0.3.

## Layout (as pieces land)

```
tools/review-session/
  README.md              this file
  pack.py                 run-slice out-dir -> Session Pack; also `pack.py fetch-span` (HITL extra-read)
  triage.py               builds residuals.json (Tier A/B/C) from review-queue.json + unmapped clusters + ignored leftovers
  redact.py               S8 secret-redaction, used by pack.py before any snippet reaches disk
  cards.py                deterministic choice-card generator, fixed per-class templates
  residuals-schema.json   JSON Schema for residuals.json
  test_pack.py            real end-to-end: run-slice -> pack.py against the checked-in NestJS fixture; refuse-overwrite; missing-input failure
  test_redact.py          redaction fixture test — fake AWS key/bearer token/private key/connection-string password
  test_triage.py          trigger -> tier/class mapping tests
  test_cards.py           card determinism + real-units-only candidates + Tier C never invents relationship_add
  test_chatmode_safety.py static proof the chat-mode's tools: allowlist excludes every known terminal tool
  validate_drafts.py      schema + integrity checks on drafts/, mirrors override-applier.ts's real validation logic
  test_validate_drafts.py (16 tests) good fixture passes; bad fixtures (dangling DR ref, superseded decision, dangling relationship endpoint, orphaned target_ref, unknown override_type, relationship_remove orphan) fail with clear reasons — includes 3 regression tests for real bugs found+fixed on self-review (check-order mismatch, same-batch node_add over-trusting, missing relationship_remove existence check)
  examples/               worked Decision Record + Override pair (synthetic), README explaining the manual draft path — no LLM required
  effective_ir.py         provenance + node/relationship counts + open residuals + decision log — full 8-section §7.1 template deferred to B-calm-portable-ir
  test_effective_ir.py    non-empty output, MVP-scope-note present, never touches intelligence-ir.md
  apply.py                the ONLY place that invokes run-slice/override-applier — validate -> confirm -> merge drafts -> apply -> apply-report.md/decisions-log.md
  test_apply.py           (5 real end-to-end tests) real type_change applies, calm validate 0 errors, refuses without confirmation, refuses on validation failure, decision+override filename collision handled correctly (regression test for a real bug found+fixed on review)
  draft_tier_b.py         SECONDARY/headless Tier B drafting path — §5.1 system prompt, backend is the already-authenticated `claude` CLI only (never a raw ANTHROPIC_API_KEY — doesn't match this project's fintech target-customer profile), a fully-testable guardrail. The PRIMARY path is in-chat: Copilot Chat's own editFiles tool, bound by the same §5.1 rules embedded in .github/agents/residual-review.agent.md — use this script only for scripted/batch runs outside a chat session. No `claude` CLI on PATH -> reports what it would attempt, writes nothing. T-1 (AGENT_TASKS_Residual_Assist_Redesign.md, 2026-08-23) ran this live for real for the first time — see that task's row for real cost/latency/reliability findings. T-2 (AGENT_TASKS_Residual_Dossier_Module.md) added the draftOutcome: "bar-not-met" state — a Tier B residual actually attempted whose evidence bar wasn't met now reads differently in residuals.json than one that was never Tier-B-eligible at all
  test_draft_tier_b.py    (20 tests) all 6 named trap fixtures (100% on refusal cases) + 6 more guardrail tests, all against synthetic responses (no live model call) + real CLI no-key-path tests + draftOutcome: bar-not-met tests
  llm_common.py           T-2 (AGENT_TASKS_Residual_Dossier_Module.md) — the shared evidence-assembly (build_evidence_prompt, known_evidence_refs) + network-boundary (_llm_backend_available, _call_llm, _strip_markdown_json_fence) logic advisory.py and draft_tier_b.py used to each keep their own near-identical copy of. Both files, plus the new dossier.py, call this module instead of drifting three separate ways. `known_evidence_refs` exists because of a real bug found on a real live run (2026-08-23): residual.evidenceRefs is often EMPTY for a whole-unit trigger (e.g. S2-http-without-security-control) — the real evidence a caller's guardrail must check against lives on the unit's own evidenceRefs instead
  test_llm_common.py      (8 tests) evidence-prompt scoping, fenced-JSON stripping (both real-run-found rounds), known_evidence_refs' residual+unit-index union
  dossier.py              T-2 (AGENT_TASKS_Residual_Dossier_Module.md, BACKLOG.md) — the opt-in Evidence Dossier pass, wired into pack.py behind `--with-dossier` (off by default). For every open residual (any tier — A, B, or C alike), calls the `claude` CLI to produce an explanation + hypotheses + evidenceRefsUsed, in a fixed JSON shape whose only allowed top-level keys are those three. NEVER WRITES A FACT: any response shaped like a decision/override is rejected outright, same boundary advisory.py's own parse_and_validate_response already established. Attaches the result as an additive `dossier` field on the residual in residuals.json (residuals-schema.json updated). No `claude` CLI on PATH (even with --with-dossier set) -> pack.py logs what would have been attempted and writes a normal dossier-less pack
  test_dossier.py         (19 tests) dossier attaches for a Tier A, B, and C residual alike, never-a-fact guardrail, invented-evidence-ref rejection, the known_evidence_refs fix (a ref only on the unit's own evidenceRefs, not the residual's, must be accepted)
  bulk_apply.py           T-RT-1 (BACKLOG.md "Bulk residual-decision authoring") — replicates one already-drafted anchor Decision Record (+ Override, if any) across every OTHER open residual in the same (tier, class) group (cards.py's own group_by_class, the same grouping shown on every card as "Similar residuals this session"). Still writes ONE Decision Record per residual (never a blanket batch record, per design §2.1's own "bulk-apply integrity" rule / README rule 9), each with its own target's real evidence, never the anchor's; lists every affected unit id before commit and requires explicit confirmation. Only replicates a type_change override or a no-override leave-open/accepted decision — an anchor naming a specific other unit as part of its own answer (relationship_add/node_add/node_remove/node_rename/boundary_change) is refused outright, not guessed at
  test_bulk_apply.py      (19 tests) anchor lookup by target_ref, sibling grouping, ambiguous/collision targets skipped and reported never silently dropped, non-replicable override types refused for the whole batch, real subprocess end-to-end run against a synthetic multi-residual pack
  consequence.py          T-RT-2 (BACKLOG.md "Consequence-ranked queue") — computes a real, deterministic consequence field (signals + score) per residual from facts already produced (TypedUnit.kind, TypedRelationship.kind) — pii-proxy/external-system-identity/trust-boundary-edge, each a named PROXY for this project's own already-documented closest analog, never a new PII/data-classification mechanism (see the module's own docstring for the honest limits). pack.py attaches it to every residual in residuals.json (additive field)
  test_consequence.py     (11 tests) each signal independently and in combination, deterministic, calls/imports never mistaken for shares-secret
  queue_rank.py            reads a Session Pack's residuals.json and ranks the OPEN backlog highest-consequence-first; reports backlog size; with --history <prior-session-dir> ..., reports real residual age via the same (trigger, unitIds) signature triage.py's own apply_baseline() uses — honestly "unknown" (never a fabricated zero) without a history match
  test_queue_rank.py      (12 tests) ranking/tie-break/exclusion rules, age lookup takes the oldest matching history pack, real subprocess end-to-end JSON + markdown output
  advisory.py              T-RT-4 (BACKLOG.md "Reviewer-assistance layer (advisory, off the generation path)") — for every open residual (optionally scoped with --residual), calls an LLM to explain the evidence and propose hypotheses, and optionally ONE catalogue-rule candidate, in a fixed JSON shape whose only allowed top-level keys are explanation/hypotheses/catalogue_rule_candidate. NEVER WRITES A FACT: any response shaped like a decision/override is rejected outright by parse_and_validate_response, and this file never touches drafts/decisions or drafts/overrides — a stricter boundary than draft_tier_b.py's own. The evidence-ref grounding check (no invented file:line anywhere in the response) covers catalogue_rule_candidate.rationale too, not just explanation/hypotheses — found missing on self-review, fixed same pass. Attaches the result as an additive `advisory` field on the residual in residuals.json (additive, residuals-schema.json updated) AND regenerates advisory/report.md (render_advisory_report) — a human-readable rendering of every advised residual's explanation/hypotheses, explicitly labeled "Advisory only... never a decision", the actual review-queue surface this task's acceptance wording means (same role queue_rank.py's own render_report plays for T-RT-2's consequence field) — never acted on automatically. Appends any catalogue-rule candidate to advisory/catalogue-rule-candidates.json in the same ProposedRule shape suggest-rules.ts already writes (still only ever manually promoted into signal-catalogue.yml, per rule 11 below); appends an episode (model, input context, outcome) to advisory/episodes.json for every residual processed, regardless of outcome. No `claude` CLI on PATH -> reports what would be attempted, writes nothing (same convention as suggest-rules.ts/draft_tier_b.py; deliberately not a raw ANTHROPIC_API_KEY -- see draft_tier_b.py's own module docstring for why)
  test_advisory.py         (32 tests) the never-a-fact guardrail (decision/override key present -> rejected outright), invented-evidence-ref rejection in free text (explanation/hypotheses AND catalogue_rule_candidate.rationale), catalogue_rule_candidate shape validation, duplicate-candidate-id-within-batch refused not overwritten, input residual dict never mutated in place, report.md never reads as a decision, real subprocess no-key CLI path + --residual filtering
```

`triage.py`'s `apply_baseline()` is real too — `pack.py --baseline <prior-session-dir>` carries forward already-decided residuals (never re-asked) and flags real drift as `reconfirm` (never silently overwritten). See `test_triage.py`'s `TestApplyBaseline` for the unit tests.

Session Packs are written to `review-sessions/<run-id>/` at the repo root (gitignored by default — see `Architect_Residual_Review_Session.md` §4.1 for why, and the redaction/audit convention for the pieces worth checking in).

## How to run

```bash
# all unit tests + real end-to-end (needs pipeline/dist built)
cd tools/review-session
python3 -m unittest discover -s . -p "test_*.py" -v

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
python3 draft_tier_b.py --session-dir ../../review-sessions/my-run  # needs the `claude` CLI on PATH (not a raw API key)

# bulk-apply: author ONE residual's answer the normal way (examples/README.md), then replicate
# it across every similar open residual in the same pack:
python3 bulk_apply.py --session-dir ../../review-sessions/my-run --anchor R-014 --i-confirm-bulk-apply

# consequence-ranked queue: highest-consequence-first, backlog size, and (given prior packs) age
python3 queue_rank.py --session-dir ../../review-sessions/my-run --history ../../review-sessions/my-run-prior

# reviewer-assistance advisory (T-RT-4): explains evidence + hypotheses for every open residual,
# optionally proposes ONE catalogue-rule candidate per residual — never writes a fact, never
# touches drafts/. Needs the `claude` CLI on PATH (not a raw API key); no backend -> reports what it would attempt, writes nothing.
python3 advisory.py --session-dir ../../review-sessions/my-run

# opt-in Evidence Dossier pass (T-2): attaches an additive `dossier` field (explanation +
# hypotheses + evidenceRefsUsed) to EVERY open residual, any tier — never writes a fact. Off by
# default; needs the `claude` CLI on PATH (not a raw API key); no backend -> writes a normal,
# dossier-less pack.
python3 pack.py --out-dir /tmp/my-run --session-dir ../../review-sessions/my-run --with-dossier

# extra-read (architect-run, never Copilot): exact range, or --anchor <file:line> for N lines
# of context around a line (same caps/redaction, shared session cap across both modes)
python3 pack.py fetch-span --session-dir ../../review-sessions/my-run --residual-id R-014 \
  --path <under packageRoots> --start-line 40 --end-line 60
python3 pack.py fetch-span --session-dir ../../review-sessions/my-run --residual-id R-014 \
  --anchor <under packageRoots>:50 --context-lines 15
```

`pack.py` refuses to overwrite a session dir that already has unapplied drafts (fails loud, exit code 1) — apply or discard first.

## Language

Python (a locked design decision). No third-party dependencies — everything above uses only the standard library (`argparse`, `json`, `re`, `pathlib`, `unittest`), matching Simplicity First; add one only when a real, evidenced need shows up. Weaver's own pipeline stays TypeScript/Node; this tooling only ever calls it as a subprocess (`node dist/orchestration/run-slice.js ...` / `node dist/analysis/ir/hitl-review-trigger.js ...`), never re-implements `override-applier.ts`'s logic in Python.
