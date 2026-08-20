# AGENT TASKS — P0: Experiments (the gate)

**Lane:** P0 · **Blocks:** every other extension lane except Lenses
**Governance, gates, isolation, DoD:** `AGENT_TASKS_Semantic_Model_Extension.md` — read first.

Nothing in P1+ is committed until E2 and E1 report. **Both failing is a valid,
cheap outcome** that shrinks the extension to lenses + governance; report it as
a result, not a setback.

**Status update, 2026-08-14:** All five experiments have now reported — the
gate condition in the sentence above is satisfied and closed. E1 reported
positive (`T-P0-3`). E2 reported negative-with-a-clear-path twice
(`T-P0-1` — safe-but-unproven round 1, real-conflicts round 2), then a third
round designed and built the actual fixes for round 2's three named
conflicts and **shipped** (93/93 `npm test` at that commit, 0 skip, every
populated `spikes/` repo). Independently re-verified after E4 landed in the
working tree (2026-08-14, `cd pipeline && npm test`, 262s): **94 pass / 0
fail / 0 skip** — the extra test is E4's own `findRule()` language-fallback
standing exam. E4 ran and shipped, with a real, generic mechanism bug found
and fixed as a byproduct (`T-P0-5`). E5 ran and reported negative, honestly
(`T-P0-6`) — `L3`/`L4` (probabilistic-OR/contradiction detection)
deprioritised, not because nothing changed but because the one real change
found was reviewed and judged less correct. **E3 (`T-P0-4`) is the one
experiment explicitly deprioritised rather than run** — see its row below
for the reasoning; this is a decision, not an oversight. Per this file's own
framing, E2 alone reporting negative would already have been a valid basis
to proceed past the gate — it did, twice — and the extension proceeded to
`AGENT_TASKS_Ext_Layered_Recovery.md`'s `[B]`-marked tasks in the meantime,
not blocked on E3/E4/E5.

| Task | Status | Depends on | Parallel? | Acceptance |
|---|---|---|---|---|
| **T-P0-0 Baseline** | **Done** — `baseline-2026-08-13.md` | — | — | `npm test` 64/0/25 + scoreboard committed as `baseline-<date>.md`. Nothing else starts first |
| **T-P0-1 E2 fact admission** | **Done, shipped 2026-08-14 (round 3)** — `E2-graded-fact-admission-experiment.md` | T-P0-0 | Yes (with T-P0-2) | Recall ↑ at L2 measured (yes — real facts recovered against Fineract/Ghostfolio); **must-not-detect trap holds**; R1 lock intact; `E-charge-single-L2` still fails *for the right reason* (no fabricated edge); false-positive cost stated as a number (0, full suite green) |
| **T-P0-2a Engine licensing check** `CON-20` | **Done** — resolved for OSS eval + confirmed enterprise procurement path. Full memo at `soln/codeql-licensing-check-memo.md` (gitignored local scratch — see the durable summary immediately below this table, kept in sync with the memo since `soln/` cannot travel with the repo) | — | Yes | **Do this before T-P0-2 spends effort.** Confirm the engine's licence permits use against private/commercial source at the target's scale. Free for public/OSS repos does not imply free for an enterprise monorepo. A licence blocker here invalidates the whole E1 lane — cheapest possible thing to check first |
| **T-P0-2 E1 prerequisites** | **Done** — CodeQL 2.26.3, `spikes/` populated, CON-10 resolved | T-P0-2a | Yes | CodeQL CLI installed and verified; sample cloned to `spikes/` (never committed); `graphifyy` on PATH; **Java build of the sample succeeds** (`CON-10` — the step that blocked prior attempts) |
| **T-P0-3 E1 engine evaluation** | **Done, positive** — `E1-codeql-engine-evaluation.md`, 7/7 real edges, 0 false positives, fully generic | T-P0-2 | No | Reproduces the hand-verified dispatch join on a real database **and** the detector is generic — no sample-repo class/package names (`OOS-sample-repo-detectors`). This fires `OOS-command-bus`'s revisit trigger; report in its terms |
| **T-P0-4 E3 buildless/AST engine** | **Explicitly deprioritised, 2026-08-14 — a decision, not "never got to it."** No engine work started. Reasoning: E3 is not a measurement over existing artefacts like E4/E5 (small, hours-scale) — it requires building and evaluating an entire new `StructuralEngine` implementation (a buildless/AST-class extractor, its own trust tier below the two semantic engines already live) before any real acceptance data exists at all. `BACKLOG.md`'s own P3 governance is explicit: *"Additional engines on measured gaps only — not speculatively."* No measured gap currently names AST-class extraction as the fix — E1/E1b's two measured gaps (command-bus dispatch, DI resolution) already have a scoped, evidenced path (`T-LR-5`/`T-LR-6`'s 7-item checklist) using CodeQL, not a new AST engine. Building E3 now would be exactly the speculative case `CLAUDE.md`'s Simplicity First principle warns against — engine work with no demonstrated gap driving it. **Revisit trigger:** a real repo/framework surfaces routes that both CodeGraph and Graphify structurally cannot see AND CodeQL (already evaluated, already licensed for OSS eval) also cannot resolve — only then does "buildless AST-class, trust tier below semantic engines" become the right-shaped answer to build against. | T-P0-0 | Yes | Detects routes current engines miss, at a trust tier **below** semantic engines |
| **T-P0-5 E4 catalogue-as-data stress** | **Done, MIXED, intake-completed 2026-08-15** — `E4-catalogue-as-data-stress-test.md`. Adding a TypeScript `Query\|Mutation` row surfaced `findRule()`'s unsafe cross-language fallback (Java Spring Data `@Query` stolen). Matcher fixed. **`Query\|Mutation` row then withdrawn** (same-language TypeORM `@Query` collision; `findRule()` does not use `framework`). `@Resolver` stays, with a checked-in synthetic fixture, removal-sensitive test, `U-http` note, and `nestjs-graphql-resolver-bootstrap-only` scope limitation. | T-P0-0 | Yes | One untested framework added via catalogue row only. **Passes only with zero builder code changes** (true for builders; the shared matcher needed a real fix first; the field-decorator row did not survive intake) |
| **T-P0-6 E5 confidence replay** | **Done, reported negative 2026-08-14** — `E5-confidence-replay-experiment.md`. Offline replay (no pipeline code touched) over 617 real units across 9 real generated runs: 22 units change confidence band under probabilistic-OR vs. the live summed-weight combination — a real difference, not "nothing changed." Reviewed: all 22 move in the direction judged **less** correct (undercounts genuinely-correlated evidence from one declaration, e.g. `extends JpaRepository<X,Long>, JpaSpecificationExecutor<X>`, as if independent). Contradiction detection could not be replayed at all — no such mechanism exists anywhere in the codebase to replay. **Disposition: `L3`/`L4` deprioritised**, per the acceptance bar's own escape hatch, reached by actually reviewing the change rather than defaulting to it | T-P0-0 | Yes | ≥1 fact changes status in a way a reviewer agrees is more correct. **If nothing changes, deprioritise the confidence work** |

### T-P0-2a durable summary (`soln/codeql-licensing-check-memo.md` lives in gitignored local scratch — this is the committed record)

**Conclusion:** the CodeQL CLI's free license permits automated/CI analysis
only against **public, Open Source Codebases** — it explicitly excludes both
"automated analysis, CI or CD" and "any codebase that is not an Open Source
Codebase" unless covered by a paid GHAS (GitHub Advanced Security) license.
Both restrictions are satisfied by Weaver's normal operating mode against a
private enterprise monorepo, so CodeQL cannot be adopted as a live
`StructuralEngine` for that target without GHAS coverage.

**Why the E1/E1b evaluation work (`E1-codeql-engine-evaluation.md`,
`E1b-codeql-di-resolution-experiment.md`) was still in scope:** all four
`spikes/` repos used for evaluation (`apache/fineract`,
`GoogleCloudPlatform/bank-of-anthos`, `ghostfolio/ghostfolio`, `finos/waltz`)
are real, public, OSS-licensed — exactly the case the free tier permits
without restriction. Evaluation needed no GHAS license; production adoption
against an enterprise repo does.

**Enterprise path:** the target enterprise's GHAS acquisition was confirmed
directly by the stakeholder (already holds other GitHub license packs; GHAS
"duly acquired" for this use), not assumed by this session. If that
acquisition does not happen before this moves from evaluation to any real
private/production repo, the original restriction re-applies unconditionally
— this is the trigger that would reopen the block. `T-LR-5`/`T-LR-6`'s own
7-item shipping checklist (`BACKLOG.md`) already carries "trust tier earned,
never automatically primary" as its own separate gate on top of this one.

Sources: GitHub CodeQL CLI Terms and Conditions; `github/codeql-cli-binaries`
`LICENSE.md` (quoted directly in the full memo).

**Report format:** every experiment result names the claim triple
`{rootSet, terminalGrain, evalArtefact}` and obeys the forbidden-phrase table.

## Operational impact if an engine is adopted (scope before productionising)

Adding a structural engine is not only a code change:

| Surface | Impact |
|---|---|
| `.github/workflows/pipeline-test.yml` | CI needs the engine installed, or tests that use it must skip gracefully — follow the existing precedent where a missing optional dependency degrades with a warning rather than failing the run |
| `pipeline/Dockerfile` | Image needs the engine, or must document it as an external prerequisite |
| Build time | Build-mode analysis needs a compiling target repo; CI cost is materially different from the current buildless path |
