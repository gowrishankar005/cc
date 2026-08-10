# Manual draft path

An architect can create Decision Record + Override drafts **without any
LLM involvement at all** — Tier B drafting via chat is optional, and
even when used, every card is answerable this way. This directory shows
a real, worked, synthetic example.

## From a choice card to a draft, step by step

A Tier A choice card (from `residuals.json`'s `card` field / `SESSION.md`)
looks like this — a real one, from `Architect_Residual_Review_Session.md`
§2.1's own worked example:

```
### R-014 (Tier A: ontology-judgment)

This class extends PrismaClient (external base, confirmed via source
read-back) and is imported by 6 other units. How should it be typed?

- [1] database — owns the DB client directly
- [2] service — a thin wrapper/facade, not the persistence boundary itself
- [leave-open] Leave open
- [other] Other…
```

The architect answers `1`. That answer becomes exactly two files:

1. **`decision-D-example-001.json`** — a `DecisionRecord`
   (`pipeline/src/types/overrides.ts`). `target_ref` is the real CALM
   node id being corrected. `final_decision.action` is `"overridden"`
   (this residual has an existing, wrong classification) — use `"added"`
   for a `node_add`, `"removed"` for `node_remove`. `rationale` should
   name which card option was chosen and why, in the architect's own
   words — this is the human-readable audit trail, not boilerplate.
   `status` is `"active"` (the only status a NEW decision should ever have;
   `"superseded"` is set later, by a different, newer Decision Record that
   explicitly names this one in its own `supersedes` field, if the
   architect ever needs to walk the answer back).

2. **`override-O-example-001.json`** — an `Override`. `decision_record_ref`
   MUST match the Decision Record's `decision_id` exactly — this is the
   integrity link `override-applier.ts` (and `validate_drafts.py`, before
   it) mechanically enforces. `override_type` is whichever of `type_change`
   / `node_add` / `node_remove` / `node_rename` / `relationship_add` /
   `relationship_remove` matches the card's answer (`boundary_change` is
   recognized but not yet implemented).

Both files go under this Session Pack's own `drafts/decisions/` and
`drafts/overrides/` — copy this example's shape, change the ids/values,
done. No template engine, no code generation required.

## The other common case: "leave open" — a Decision Record with NO Override

Empirically the single
most common Tier A outcome across two real pilot sessions was the architect
confirming the scan correctly found nothing real to connect, i.e. picking
`[none]`/`[leave-open]` rather than a specific candidate. This needs only
ONE file, not two:

```
### R-001 (Tier A: multi-candidate-bridge)

ChargesApiResource.java has 0 relationships. Which unit should it connect to?

- [1] Connect to Charge.java
- [2] Connect to ChargeRepository.java
- [none] None of these
- [other] Other…
```

The architect answers `none`. See **`decision-D-example-002-leave-open.json`**
— `final_decision.action` is `"accepted"` (the designated value for this
outcome, per `pipeline/src/types/overrides.ts`'s own comment — it means "the
scan's finding is confirmed correct," not "a proposed edit was accepted"),
`new_value` is `null`, and there is **no matching Override file at all** —
nothing in CALM changes, so there's nothing to override. The Decision Record
alone is the complete, valid audit trail for this outcome; `validate_drafts.py`
accepts a Decision Record with no matching Override without error (it only
requires the reverse — every Override must resolve to an active decision).

## Validate before you (eventually) apply

```bash
python3 ../validate_drafts.py --session-dir <your-session-dir> --calm <out-dir>/architecture.calm.json
```

Run against this example pair with a synthetic CALM containing
`svc-prisma-service`, it passes clean (0 errors, 0 warnings) — verified for
real, not just asserted.

Applying (turning a validated draft into a new `architecture.calm.json`) is
a real, human-confirmed step — `apply.py`:

```bash
python3 ../apply.py --session-dir <your-session-dir> --out <new-out-dir>
```

`apply.py` re-validates in-process (never trusts a stale prior run of
`validate_drafts.py`), then requires an explicit confirmation — a real
terminal prompt (type `apply`), or `--i-confirm-apply` for a non-interactive
invocation. It handles the directory merge itself: `override-applier.ts`
scans ONE flat directory for both Decision Records and Overrides (dispatched
by which field each JSON file has), not the Session Pack's own split
`drafts/decisions/` + `drafts/overrides/` layout — `apply.py` merges both
into a temp directory before calling `run-slice.js`, so you never have to
do that by hand. Proven for real against this exact example pair: the
target node's `node-type` genuinely changed, `calm validate` reported 0
errors.

If you ever need to apply without `apply.py` (e.g. debugging it), the
underlying mechanism is still the plain platform command, with the merge
done by hand:

```bash
node pipeline/dist/orchestration/run-slice.js --from-facts <out-dir>/typed-facts.json \
  --overrides <a directory containing BOTH this decision and this override> \
  --out <new-out-dir>
```
