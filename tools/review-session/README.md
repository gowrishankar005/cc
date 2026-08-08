# Weaver residual review session tools

Offline tooling that turns a `run-slice` output directory into an architect-friendly **Session Pack** for reviewing what a scan left open (S1/S2/S5/low-architecture-coverage residuals), then applies decisions back through Weaver's existing Decision Record + Override mechanism.

**Design authority:** [`docs/solution/Architect_Residual_Review_Session.md`](../../docs/solution/Architect_Residual_Review_Session.md)
**Task list:** [`docs/solution/AGENT_TASKS_Residual_Review_Session.md`](../../docs/solution/AGENT_TASKS_Residual_Review_Session.md)
**Status:** RS-1 in progress. See the task list for what's built vs. not yet.

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
  residuals-schema.json    (built) JSON Schema for residuals.json
  test_pack.py             (built) real end-to-end: run-slice -> pack.py against the checked-in NestJS fixture; refuse-overwrite; missing-input failure
  test_redact.py           (built) redaction fixture test — fake AWS key/bearer token/private key/connection-string password
  test_triage.py           (built) trigger -> tier/class mapping tests
  validate_drafts.py      (T-RS2-1, not yet built) schema + integrity checks on drafts/
  apply.py                (T-RS3-1, not yet built) validate -> run-slice --overrides -> apply-report
  examples/                (T-RS2-2, not yet built) synthetic Decision Record + Override pairs
```

Session Packs are written to `review-sessions/<run-id>/` at the repo root (gitignored by default — see `Architect_Residual_Review_Session.md` §4.1 for why, and the redaction/audit convention for the pieces worth checking in).

## How to run

```bash
# unit tests (redaction fixtures + triage mapping) + real end-to-end (needs pipeline/dist built)
cd tools/review-session
python3 -m unittest test_redact test_triage test_pack -v

# build a real pack from a real run-slice out-dir
node ../../pipeline/dist/orchestration/run-slice.js <package-root> --out /tmp/my-run
python3 pack.py --out-dir /tmp/my-run --session-dir ../../review-sessions/my-run
```

`pack.py` refuses to overwrite a session dir that already has unapplied drafts (fails loud, exit code 1) — apply or discard first.

## Language

Python (per RS-0's locked decision — `AGENT_TASKS_Residual_Review_Session.md` §0.5). No third-party dependencies — everything above uses only the standard library (`argparse`, `json`, `re`, `pathlib`, `unittest`), matching Simplicity First; add one only when a real, evidenced need shows up. Weaver's own pipeline stays TypeScript/Node; this tooling only ever calls it as a subprocess (`node dist/orchestration/run-slice.js ...` / `node dist/analysis/ir/hitl-review-trigger.js ...`), never re-implements `override-applier.ts`'s logic in Python.
