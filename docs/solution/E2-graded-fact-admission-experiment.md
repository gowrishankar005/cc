# E2 — Graded Fact Admission Experiment (T-P0-1)

**Task:** `AGENT_TASKS_Ext_P0_Experiments.md`'s T-P0-1. Tests whether admitting
a Graphify edge whose one endpoint doesn't resolve to a `TypedUnit`
(`graphify-reconciler.ts:142`, `if (!from || !to) continue`) recovers real
architecture — `BACKLOG.md`'s "Graded fact admission (dual-unit gate)" row.

**Result: implemented, evidenced against coe-lab (round 1) and real
reference repos (rounds 2-3), SHIPPED in round 3 (2026-08-14).** Round 1
(against coe-lab's sparse fixtures only) found 0 recall gain. Round 2
(a reference Java/JAX-RS banking platform, `bank-of-anthos`, `ghostfolio`, a reference Java governance platform,
populated after round 1) reversed that conclusion — E2 recovers real signal
against densely-linked real code — but surfaced three real architectural
conflicts with this pipeline's other invariants and was reverted a second
time. Round 3 designed and built the actual fixes for all three conflicts
(not more carve-outs — see "Round 3" below), re-ran the full regression suite
against every populated `spikes/` repo, and found **93/93 pass, 0 skip, 0
fabricated relationship** — the mechanism now ships live in the default pass
order. Full round 1/2 history (including the reverted attempts) is preserved
in git history: `89b7bd3`/`49e08b7` implement (round 1/2), `279a9fb`/`b4c4492`
revert (round 1/2); round 3's fix landed as new commits on top of a third
reapply of `b4c4492`, not a revert.

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
| `E-charge-single-L2` still fails for the right reason | **Not evaluated** — the reference Java/JAX-RS banking platform's own repo was absent for the entire duration this criterion needed checking (populated only after this report's numeric results were already captured; see below). |
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

Real open-source reference repos (a reference Java/JAX-RS banking platform, `GoogleCloudPlatform/bank-of-anthos`,
`ghostfolio/ghostfolio`, a reference Java governance platform — genericized
per this codebase's own convention, confirmed by directory-structure match
against the exact paths `test/regression.test.js` already expects, e.g.
`JAVA_SAMPLE_KAFKA_ROOT`'s expected package path) were cloned into `spikes/` (gitignored, per
this repo's own convention) **after** the numbers above were recorded. This
unblocked all 25 previously-skipped regression tests (88/89 pass with spikes/
present) and surfaced one unrelated, pre-existing finding: a real-repo exact
relationship-count assertion
(`R0 grading: fineract-core direct-reconciler edges...`, expects 94, a fresh
reference-platform clone gives 60) has no commit/tag pinned anywhere in this
codebase's docs or tests, so it silently drifts as the real upstream repo
evolves — not an E2 regression (E2 was already fully reverted when this ran),
a separate reproducibility gap worth its own fix.

This section (through "What changed after this report's numbers were
captured" above) is **Round 1** — coe-lab fixtures only, no real repo present.
Round 2 below supersedes its "0 recall gain" conclusion with real evidence,
but does not change the disposition (still reverted) — for a different,
larger reason.

## Round 2 — re-run against real `spikes/` repos (2026-08-13)

With a reference Java/JAX-RS banking platform, `GoogleCloudPlatform/bank-of-anthos`,
`ghostfolio/ghostfolio`, and a reference Java governance platform populated, the round-1
implementation (`git show 89b7bd3`) was reapplied and the full regression
suite re-run: **80 pass, 9 fail** (vs. 89/0 on the reverted baseline with the
same repos present — see the reference platform's count-drift fix above, a prerequisite
for this round to even give a stable baseline).

**Recall ↑ at L2 — now demonstrated, reversing Round 1's finding.** Against
the reference platform's core module alone, admission recovers 371 additional low-confidence
facts (`371 admitted via unresolved-endpoint placeholder`, vs. 0 in every
coe-lab fixture). Against the reference platform's charge module alone, 9 admitted relationships
appear where 0 existed before. This is real, structurally-grounded signal —
the mechanism works exactly as designed. But recovering it breaks 9 existing
regression tests, which fall into three distinct, real problem classes (not
one bug — three separable architectural conflicts):

**1. Collides with other detectors' own "never guess, stay an honest
ignored-item" invariants.** `outbound-http-detector.ts` deliberately never
resolves an unresolvable outbound HTTP target — every such reference stays an
`unresolved-http-target` ignored item, by design (`U-outbound-http`'s Claim
Register cell: "never resolves a target — every detection lands as an
ignored-item for human review, by design"). Against the real Python
reference app's `frontend.py`, E2 admission created 6 relationships where
this exact invariant expects 0
(`Outbound HTTP — ... produces unresolved-http-target, not a fabricated
relationship`, `test/regression.test.js:1755`). Round 1's fix scoped E2 to
defer to `multi-hop-bridge-detector.ts`'s reserved territory (interface files
with real `implements` edges); it did not know about outbound-HTTP's
separate reserved territory, and would need a similar carve-out for it —
and, by extension, for every other current or future detector that makes the
same "stay honest, never guess" choice. This is the core architectural
problem: **a single generic catch-all admission mechanism, sitting upstream
of every specialized detector, cannot know in advance which edges are
"genuinely nobody's territory" vs. "another detector's deliberate residual."**
Carve-outs discovered one regression at a time do not generalize safely.

**2. Silences completeness/silence signals (S1) without the story actually
being more complete.** The reference platform's charge module's `S1-zero-service-touching-relationships`
flag exists specifically to stay loud when a service+database pair is
present but genuinely disconnected (`Claim_Register.md`'s `S-silence` row;
`E-charge-single-L2`'s whole reason for existing). E2's admitted
relationships are honestly graded `structural`, never `architecture` — but
S1's own check only asks "does ≥1 relationship touch a service unit," not
"does an architecture-grade relationship touch a service unit." A structural,
low-confidence, unresolved-endpoint relationship still counts as
"service-touching" by that definition, so **S1 silently stops firing** for
the reference platform's charge module even though nothing about the real, actionable-story
completeness changed (`silence metrics: ... flags S1`, `test/regression.test.js:643`).
This cascades directly into the HITL review queue emptying out for the same
package (`HITL review trigger: ... (S1) lists the actual units`,
`test/regression.test.js:2262`, expected 3 flagged units, got 0) — a human
reviewer who should be told "this package's architecture story is genuinely
thin" is now told nothing, because a low-confidence admitted fact happened
to touch the service node. **S1 would need to become grade-aware (only
architecture-grade relationships count as "service-touching") before E2 could
coexist with it safely** — a real, separate design change, not a quick fix.

**3. Ripples into unrelated correlation/security logic via the shared
`ctx.allUnits` array.** `deployment-correlation`'s Java-controller-name
substring matching (`Deployment correlation — Java Controller-class naming
resolves via normalize+substring, never matches a database/topic unit`,
`test/regression.test.js:2209`) now incorrectly correlates a k8s Deployment
to a database-kind unit instead of a service-kind one — a real, unexplained
regression this session did not root-cause before reverting. The mechanism
adds ~370+ extra `unresolved`-kind units per real package scan directly into
`ctx.allUnits`, the same array every other pass (env soft-graph, deployment
correlation, HITL review, threat-signals) reads — this round's evidence shows
that volume of extra units is enough to change candidate-matching behavior in
at least one security-adjacent consumer that was never designed with
"thousands of low-signal placeholder units now exist" in mind. Two more
failures (`Node/TS real evidence (ghostfolio...) — ... Controller/database
precedence`, `Robustness (B-ontology, Q13 fix) — ... PrismaService`) are a
milder version of the same shared-array effect: a calm-cli spectral
"unreferenced node" warning that existing tests pin at exactly 1 goes to 0,
because an admitted relationship gives a previously-orphaned node something
to connect to — arguably correct behavior, but it means **any test anywhere
in this codebase that encodes "0 signal here" as its expected, correct state
is a latent E2 regression**, and there is no way to enumerate all of them
short of exactly what this round did: run the full suite against real data.

**One further compounding factor, not new but relevant:** the already-filed
CodeGraph under-repeated-invocation degradation (see the reference platform's
count-drift fix above) interacts with E2 specifically — under degraded
conditions a real database unit can fail to resolve, causing E2 to
synthesize an `unresolved` placeholder for it, which then downgrades what
should be a real `multi-hop-bridge-detector.ts` R2b `architecture`-grade
relationship to `structural` (observed once: `R0 grading: ... R2b now
resolves 3 real service->repository chains`, one of 3 R2b relationships
graded `structural` instead of `architecture` in the node:test-hosted run,
not reproduced in an isolated fresh-process run). E2 is not the cause of
that degradation, but it is the first mechanism observed to let it silently
corrupt a *different*, previously-reliable mechanism's grading — a concrete
illustration of why the shared-unit-pool ripple effect (problem 3 above) is
a real risk, not a theoretical one.

## Disposition after Round 2

**Reverted again** (`b4c4492`) — for a different and larger reason than
Round 1. This is not "tighten one more false-positive class and ship." A
generic, upstream, catch-all admission mechanism structurally conflicts with
this pipeline's existing pattern of many independent, specialized "stay
honest, never guess" detectors and with at least one completeness-signal
invariant (S1) that assumes "any service-touching relationship" implies
architecture, not just structure. Making E2 safe at real-repo scale would
need, at minimum: (a) a registry of "reserved territory" every specialized
detector opts into, checked generically rather than one hardcoded carve-out
per detector found; (b) S1 (and any other consumer of "does a relationship
touch a service unit") made grade-aware; (c) the shared `ctx.allUnits` ripple
effect on unrelated consumers (deployment correlation, at minimum) actually
root-caused, not just observed. This is real design work, not incremental
tightening — a case for the next solutioning pass to scope deliberately,
not for a third silent re-attempt in this session.

## Round 3 — the three conflicts, actually fixed (2026-08-14)

Round 2 named three problems and proposed (a)/(b)/(c) as the prerequisite
design work. Round 3 did that work, one conflict at a time, verifying each
against real fixtures rather than assuming the diagnosis still held after
`T-LR-1`/`T-LR-2`/`T-LM-0` shipped in between.

**Conflict 1 (reserved territory) — real, but narrower than round 2 believed.**
Direct investigation found the "outbound-HTTP collision" round 2 reported was
a **misdiagnosis**: the 6 relationships E2 admitted in `frontend.py` pointed
to real in-repo files (`api_call.py`, `traced_thread_pool_executor.py`)
completely unrelated to `outbound-http-detector.ts`'s own edges (verified
directly against the raw Graphify `graph.json` — no node for the `requests`
library import was ever touched by E2). `outbound-http-detector.ts` needed no
carve-out at all. The real, still-live conflict was narrower and different:
`multi-hop-bridge-detector.ts` and E2 raced for the exact same
"service → unresolved node" edges, because `reconcilePass` ran before
`multiHopBridgePass` in the default order. Fixed generically, not with a
per-detector carve-out list:
- `multi-hop-bridge-detector.ts` now returns `examinedPairs` (every raw
  `${source}|${target}` edge it took ownership of, resolved or refused) and
  `examinedBridgeFiles` (source files of every bridge candidate it examined —
  needed because Graphify emits a *separate* edge straight to a bridge
  candidate's individual method node, e.g. `ThingService.retrieveAll`,
  distinct from the class-level edge the detector itself walks; pair-level
  deferral alone missed this, confirmed against `r2c-direct-delegate-sample`).
- `graphify-reconciler.ts`'s `reconcileCrossPackageEdges` takes both as
  optional parameters and defers admission (falls through to the existing
  `!from || !to` drop) for any edge already claimed either way.
- `passes.ts`: `multiHopBridgePass` now runs **before** `reconcilePass` (both
  append to `ctx.relationships`, changed from an overwrite, so the reorder is
  safe); `AnalysisContext` carries the two sets between them.
- Any *future* specialized detector that needs the same deferral opts in the
  same way — return its own examined-edges/examined-files sets, thread them
  through the same two optional parameters. No registry of hardcoded
  detector names was needed; the mechanism is already generic per-detector,
  not per-repo.

**Conflict 2 (S1 grade-awareness) — did not reproduce.** Round 2 predicted S1
would silently stop firing because its "service-touching" check doesn't
distinguish `structural` from `architecture` grade. After conflict 1's fix,
this never materialized against real fixtures: E2's admitted relationships in
the reference platform's charge module land on `Charge.java`'s enum-type references and a
repository-wrapper call, not on the service unit the S1 check watches — S1
still fires correctly, unchanged, no grade-awareness change needed. Left
as-is; if a future real repo shows E2 admission actually landing squarely on
a service unit and silencing S1, that is the trigger to revisit this, not a
hypothetical to build against now.

**Conflict 3 (`ctx.allUnits` ripple) — real, root cause is stale test
assertions, not consumer logic.** Every one of the remaining test failures
(`ghostfolio` Controller/database precedence, `PrismaService` positive case,
env-soft-graph off-by-default, deployment-correlation Transaction.java
exclusion) turned out to share one root cause: each test's own filter
(`r.metadata?.some((m) => m.key === 'x-aac-confidence')`, or an exact
`warnings === 1` pin) was written when E2 didn't exist, under the assumption
that "any confidence-bearing relationship" or "this exact warning count"
meant something specific to the mechanism under test (env-soft-graph, calm-cli
orphan detection). E2 now legitimately also sets `x-aac-confidence` on
unrelated relationships — real signal, not noise — so those filters became
accidentally over-broad, the same class of bug as the outbound-HTTP
misdiagnosis in conflict 1. No pipeline code was wrong: `deployment-correlation`
never actually mis-correlated a k8s Deployment to `Transaction.java`; the
test's own endpoint-collection filter just started sweeping in E2's unrelated
edges too. Fixed by scoping each test's filter to what it actually means to
assert (`mechanism` in `['r2b','r2c']` for R2-specific checks,
`confidence === 20` for env-soft-graph-specific checks) instead of relaxing
or removing the underlying assertions. Two tests' warning-count expectations
legitimately changed from 1 to 0 (`ghostfolio` `AccessController`/
`PrismaService` narrow scans) — not a relaxed test, a real, grep-verified new
edge (real NestJS `@Module({...})` wiring) that genuinely closes a
previously-orphaned node, exactly the kind of recall gain E2 was built to
recover.

**Result:** `npm test` — **93 pass, 0 fail, 0 skip** (every `spikes/` repo
populated this session: a reference Java/JAX-RS banking platform, `bank-of-anthos`,
`ghostfolio/ghostfolio`, a reference Java governance platform). E2 ships live in
`DEFAULT_PASSES` — no flag, no opt-in, same as every other core pass.

## What would reopen this

- A future specialized detector adding its own `examinedPairs`/
  `examinedBridgeFiles`-shaped output but never wiring it through
  `reconcileCrossPackageEdges`'s reserved-territory parameters — a review
  checklist item now, not a code gate.
- Real evidence that S1's grade-blindness (conflict 2) does matter against
  some other repo shape — revisit grade-awareness only if that's observed,
  not preemptively.
