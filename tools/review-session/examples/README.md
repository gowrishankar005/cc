# Manual draft path (T-RS2-2)

An architect can create Decision Record + Override drafts **without any
LLM involvement at all** — RS-4's Tier B drafting doesn't exist yet, and
even once it does, every card is answerable this way. This directory shows
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
   recognized but not yet implemented — see `AGENT_TASKS_Residual_Review_Session.md`).

Both files go under this Session Pack's own `drafts/decisions/` and
`drafts/overrides/` — copy this example's shape, change the ids/values,
done. No template engine, no code generation required.

## Validate before you (eventually) apply

```bash
python3 ../validate_drafts.py --session-dir <your-session-dir> --calm <out-dir>/architecture.calm.json
```

Run against this example pair with a synthetic CALM containing
`svc-prisma-service`, it passes clean (0 errors, 0 warnings) — verified for
real, not just asserted; see the T-RS2-1/T-RS2-2 changelog entries in
`AGENT_TASKS_Residual_Review_Session.md` for the exact commands run.

Applying (turning a validated draft into a new `architecture.calm.json`) is
still a human step run from the command line — `apply.py` (T-RS3-1) isn't
built yet. Until it is, the same effect is available today via the
already-real, already-tested platform mechanism this whole design sits on
top of:

```bash
node pipeline/dist/orchestration/run-slice.js --from-facts <out-dir>/typed-facts.json \
  --overrides <a directory containing BOTH this decision and this override> \
  --out <new-out-dir>
```

Note the merged directory — `override-applier.ts` scans one flat directory
for both Decision Records and Overrides (dispatched by which field each
JSON file has), not the Session Pack's own split `drafts/decisions/` +
`drafts/overrides/` layout. `apply.py` will handle that merge; until it
exists, copy both files into one directory yourself before running the
command above.
