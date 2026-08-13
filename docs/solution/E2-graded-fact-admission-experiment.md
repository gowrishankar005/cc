# E2 — Graded Fact Admission Experiment (T-P0-1)

**Task:** `AGENT_TASKS_Ext_P0_Experiments.md`'s T-P0-1. Tests whether admitting
a Graphify edge whose one endpoint doesn't resolve to a `TypedUnit`
(`graphify-reconciler.ts:142`, `if (!from || !to) continue`) recovers real
architecture — `BACKLOG.md`'s "Graded fact admission (dual-unit gate)" row.

**Result: implemented, evidenced, then reverted from the default pipeline
path** at the reporting session's own recommendation, confirmed by the user.
Full implementation is preserved in git history
(`89b7bd3` implement / `279a9fb` revert) for future re-attempt once real
recall evidence exists — see "What would reopen this" below.

## Claim triple

`{rootSet: every checked-in pipeline/test fixture + all 7 coe-lab core/trap
packages (single-root and 7-root combined), terminalGrain: N/A — no
relationship reached architecture grade, evalArtefact: npm test regression
suite + coe-lab validate-calm-pair/scoreboard}`.

## Design (implemented, then reverted)

- `graphify-reconciler.ts`: when exactly one of an edge's two endpoints
  resolves to a real `TypedUnit`, synthesize a placeholder `TypedUnit`
  (`kind: 'unresolved'`) for the other side from the raw Graphify node's own
  real `source_file`/`source_location`/`label` — never a fabricated location.
  Both endpoints missing: still dropped, unchanged.
- Confidence tiers 3 (same-root) / 2 (cross-root) — below
  `multi-hop-bridge-detector.ts`'s R2b tier (8/5), the previous floor.
- `relationship-grading.ts`: forced `grade: 'structural'` whenever either
  endpoint is `kind: 'unresolved'`, regardless of the other endpoint's kind —
  required so a resolved service endpoint can't promote an admitted fact to
  `'architecture'`, per BACKLOG's own "never architecture grade" constraint.
- CALM emission: verified CALM 1.2's `node-type-definition` is
  `anyOf: [enum, {type: string}]` (checked directly against
  `node_modules/@finos/calm-cli`'s own `core.json`, not assumed) — added a new
  `'unresolved-endpoint'` node-type, schema-valid but deliberately not one of
  the 9 real architectural kinds, so an admitted fact is never misrepresented
  as a real service/database/etc.

## Two real false-positive classes found and fixed during evidencing

Both found against this repo's own **checked-in, always-run** fixtures — not
synthetic worst-cases invented for the report.

1. **Framework/library symbol noise.** Graphify emits `source_file: ''` for a
   symbol it can't attribute to any real file (confirmed via
   `test/fixtures/nestjs-sample`'s checked-in `graph.json`: `Controller`,
   `Get`, `Param`, `Post`, `Body` — the decorator names imported from
   `@nestjs/common` — all carry empty `source_file`). `resolveRoot('')`
   incorrectly resolved this to the scan root itself
   (`path.resolve(scanRoot, '')` collapses to `scanRoot`), so a naive
   admission fabricated 5 fake architectural nodes for 1 real service — a 5:1
   noise ratio on a tiny fixture. **Fixed:** reject admission for any node
   with no real `source_file`.
2. **Competing with the R2/R2b bridge detector's deliberate refusal.** A node
   whose file also declares a real `implements`-edge target is
   `multi-hop-bridge-detector.ts`'s own territory. Naive admission created a
   second, competing relationship for an edge the R2b mechanism deliberately
   left unresolved on an ambiguous 2-implementer case
   (`r2b-implementer-hop-sample`'s own regression test,
   `test/regression.test.js:575`) — a real violation of this codebase's
   "never guess" discipline, caught by the existing regression suite, not
   invented for this report. **Fixed:** reject admission for any node in an
   `implements`-target's file (file-level, not node-id-level — the first fix
   attempt at node-id granularity missed the interface's own method nodes,
   which Graphify represents as separate nodes from the type itself).

## Acceptance bar (`AGENT_TASKS_Ext_P0_Experiments.md`'s T-P0-1 row), scored

| Criterion | Result |
|---|---|
| Recall ↑ at L2, measured | **Not demonstrated.** coe-lab's core/trap fixtures produce **zero** raw Graphify edges each (too small/independent to exercise cross-references at all — confirmed via `--all-core` generation and a combined 7-root scan of every coe-lab core+trap package, both showing 0 relationships reconciled). No real densely-linked repo was present in `spikes/` at the time this was measured (see "What changed after" below). |
| `lib-fintech-common` must-not-detect trap still passes | **Passes**, but untested by real load: the trap fixture itself produces 0 Graphify edges in this coe-lab fixture set, so the admission mechanism was never actually exercised against it. Passing here is a null result, not a demonstrated safe pass under stress. |
| Core-package semantic gates stay green; R1 regression-lock holds | **Confirmed.** `npm test` 64/0/25 exact baseline match after both fixes; R1 lock test (real Bank-of-Anthos-shaped service→database `architecture`-graded edge) unaffected. |
| `E-charge-single-L2` still fails for the right reason | **Not evaluated** — `spikes/fineract/repo` was absent for the entire duration this criterion needed checking (populated only after this report's numeric results were already captured; see below). |
| False-positive cost stated as a number | **Before fixes:** 5 fabricated nodes on 1 fixture (5:1 ratio) + 1 real violation of the R2b ambiguity-refusal discipline. **After both fixes:** 0 admitted relationships (0 false positives) across all 20 checked-in `pipeline/test` fixtures and all 7 coe-lab core/trap packages — **but also 0 real facts recovered** in the same sweep. |

## Why this was reverted rather than shipped

Once tightened past both found false-positive classes, the mechanism is
provably safe (`npm test` green, 0 fabrication) but had, at time of decision,
**zero demonstrated benefit anywhere it could be tested** — every available
fixture either had no admittable edges at all, or the admittable edges were
already correctly excluded by the two tightening fixes. Shipping
unconditionally-live machinery with a proven-safe-but-zero-shown-value
profile is exactly the "nothing speculative" case `CLAUDE.md`'s Simplicity
First principle warns against. Reported to the user as a real product
decision point (ship live vs. revert until real evidence exists); the user
chose revert, preserving the design and both fixes in git history
(`89b7bd3`/`279a9fb`) rather than as an unlanded proposal, so a future
re-attempt starts from evidenced code, not a blank page.

## What changed after this report's numbers were captured

Real open-source reference repos (`apache/fineract`, `GoogleCloudPlatform/bank-of-anthos`,
`ghostfolio/ghostfolio`, `finos/waltz` — the repos this codebase's own
comments already anonymize as "a reference Java/JAX-RS banking platform" etc.,
confirmed by directory-structure match against the exact paths
`test/regression.test.js` already expects, e.g. `JAVA_SAMPLE_KAFKA_ROOT`'s
`org/apache/fineract/...` path) were cloned into `spikes/` (gitignored, per
this repo's own convention) **after** the numbers above were recorded. This
unblocked all 25 previously-skipped regression tests (88/89 pass with spikes/
present) and surfaced one unrelated, pre-existing finding: a real-repo exact
relationship-count assertion
(`R0 grading: fineract-core direct-reconciler edges...`, expects 94, a fresh
`apache/fineract` clone gives 60) has no commit/tag pinned anywhere in this
codebase's docs or tests, so it silently drifts as the real upstream repo
evolves — not an E2 regression (E2 was already fully reverted when this ran),
a separate reproducibility gap worth its own fix.

## What would reopen this

- A real, densely cross-referenced repo (now available in `spikes/`) actually
  showing a genuine `L2` recall gain from re-running the reverted design
  (`git show 89b7bd3` for the full diff) against it — not assumed to transfer
  from the coe-lab-fixture-only result above.
- A specific enterprise pilot repo shape where the coe-lab fixture set's
  current sparseness is shown to be unrepresentative.
