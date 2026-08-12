# AGENT TASKS — Semantic Model Extension

**Branch:** `feature/semantic-model-extension` (base `main` @ `370b7c7`)
**Status:** scoped, not started. No code written yet.
**Companion:** the requirements/governance set lives outside this repo in the
research workspace (`codeintel/Architecture Model/docs/`) and is referenced by
requirement ID (`BR-*`, `NFR-*`, `CON-*`, `CGR-*`) throughout this file.

Read `CLAUDE.md` first — its four working principles govern every task here.
This file adds *what* to build and *in what order*; it does not restate *how
to work*.

---

## 0. Thesis being tested — and how it can fail

Weaver generates CALM well. This extension asks it to be a **semantic
architecture model platform**: broader lenses, more extraction mechanisms, and
fact semantics good enough for layered/multi-hop systems.

The re-think rests on **two falsifiable claims**. Phase 0 tests both before
any structural work is committed:

| Claim | Test | If false |
|---|---|---|
| A drop-gate, not a detection limit, is what loses layered architecture edges | **E2** | Graded fact admission is not the answer; fall back to lenses + governance only |
| A build-based semantic engine can resolve string-keyed cross-file dispatch that current engines cannot | **E1** | The tooling thesis dies; scope shrinks to lenses + governance only |

**Both false is a valid, cheap outcome** and must be reported as such — not
worked around. Record the result either way (see §7).

---

## 1. Hard gates — verified absent on this machine, 2026-08-13

Do not begin Phase 0 until these are resolved. Each was checked, not assumed.

| Prerequisite | State | Needed for | Note |
|---|---|---|---|
| `spikes/` sample repos | **Absent** | E1, E2 stage 2 | Gitignored by design; clone locally, never commit |
| CodeQL CLI | **Not installed** | E1 | Install + verify `codeql version` |
| Java build of the wild-type sample | **Unverified** | E1 | `CON-10`: CodeQL DB creation needs a working, network-reachable build. **This exact step blocked prior attempts** — verify before planning around it |
| `graphifyy` on PATH | **Not present** | Cross-package pass | Missing degrades (warns, continues) rather than fails — but E2 measurements are invalid without it, since cross-package edges are what E2 measures |
| Node 22 / built `dist` | Present | All | — |
| coe-lab fixtures + scripts | Present | E2 stage 1 | Enables E2 to start without any clone |

**Sequencing consequence:** E2 stage 1 (lab fixtures) is the only experiment
unblocked today. Start there; run the E1 prerequisite install in parallel.
This refines `docs/06` §4's "E1 and E2 in parallel" — E2 is cheaper and
unblocked, so it leads.

---

## 2. Isolation — read before touching anything (`CON-40`)

`coe-lab/gold/**` is **DO NOT READ** while implementing detectors or the
admission gate. See `CLAUDE.md` → "CoE Lab isolation" and
`coe-lab/ISOLATION.md`.

This is not ceremony: **E2's entire value is a measurement, and a measurement
taken by a process that read the answer key is void.** If gold is consulted
during implementation, say so and mark the resulting numbers compromised
rather than reporting them.

Scoring runs read gold. Implementation does not. Keep those as separate
sessions if there's any doubt.

---

## 3. Baseline capture — task 0, before any edit

Nothing can be shown to have improved without this.

```bash
cd pipeline && npm install && npm run build && npm test    # expect 64 pass / 0 fail / 25 skip
cd ../coe-lab && node scripts/generate-calm.mjs --all-core \
  && node scripts/validate-calm-pair.mjs --all-core \
  && node scripts/scoreboard.mjs
```

Commit the scoreboard output to the branch as `docs/solution/baseline-<date>.md`.
Every later claim is a delta against this file.

---

## 4. Phase 0 — the two experiments

### E2 — Does graded fact admission recover real edges? *(start here)*

**Capability under test:** when a structural edge has one endpoint that does
not resolve to a TypedUnit, does admitting it as a low-status fact recover
real architecture that the current drop-gate loses?

**Current behaviour:** `analysis/cross_package/graphify-reconciler.ts:142` —
`if (!from || !to) continue;` — the edge is dropped to ignored-items.

**Change (branch-local, revertible):** admit such an edge as a fact carrying
an explicitly unresolved endpoint, at a status below anything auto-included,
and never at `architecture` grade.

**Acceptance bar — all four:**
1. Recall increases against wild gold at L2 (the layered story), measured.
2. **The `lib-fintech-common` must-not-detect trap still passes.** This is the
   specific guard on this change — admitting more facts directly risks the
   shared-library trap starting to register as a service. *Named as the
   primary regression risk of L1, not a general "watch for false positives."*
3. Core-package semantic gates stay green (no regression to the eight passing
   packages).
4. False-positive cost is **stated as a number**, not characterised.

**If recall rises and the trap holds → the highest-value lift is validated.**
If the trap breaks, the gate isn't wrong but the *admission criteria* are —
tighten and re-run; do not relax the trap.

### E1 — Can a build-based semantic engine resolve string-keyed dispatch?

**Capability under test (narrow, per `docs/05` §2 Step 0):** resolve
caller→callee where dispatch is a string-keyed registry lookup and the
registration site and lookup site are in different files, in Java.

**Ground truth already exists** — hand-verified dispatch findings on the
wild-type sample. **Do not author new ground truth to fit the tool** (Step 2).

**Acceptance bar:** the query reproduces the hand-verified join on a real
database, matching known handler resolutions.

**Then, and only then:** implement as a second `StructuralEngine`
(`scanner/structural-engine.ts`) — the interface exists precisely for this,
and `engine-capability-matrix.yml` already carries a `codeql` augment slot
with an unfired trigger. One call site, per `CLAUDE.md` principle 3.

---

## 5. Phases 1+ — only if Phase 0 gates pass

Each item carries its research-side requirement ID. Build in order; each phase
ships green before the next starts.

| Phase | Item | Req | Notes |
|---|---|---|---|
| 1 | Graded fact admission (productionised from E2) | `BR-60` | Includes a status vocabulary alongside existing grades/bands |
| 1 | Contradiction detection → conflict → review | `BR-60` | Contradicting evidence currently *both add weight* in `confidence-scorer.ts` |
| 1 | Probabilistic-OR, independence-aware confidence | `NFR-10` | Replaces additive `sum(weight)`; gate on E5 showing a decision actually changes |
| 1 | Secondary sources may introduce facts | `BR-60` | Relax "corroboration-only" for non-primary sources, at their own tier |
| 2 | CodeQL structural engine (productionised from E1) | `BR-10` | Fires the matrix's existing augment trigger |
| 2 | Per-(tool, fact-type) trust tiers | `BR-60` | Extends `engine-capability-matrix.yml` from routing stub to evidence-weighted registry |
| 3 | Fact identity + incremental merge + review history | `BR-70`, `NFR-20` | **Contract change — see §6** |
| 4 | New lens modules: green-engineering, resilience, data-flow, vulnerability | `BR-50` | Registry modules; `threat-signals` is the reference implementation |
| 4 | Call-site security controls (Weaver backlog, `C-call`) | `BR-50` | Known limitation, decorator-only today |
| 5 | Cross-repo joins via per-repo manifest + ranked join order | `BR-20` | Beyond co-scanned multi-root |
| 5 | k8s-derived `deployed-in` relationships | `BR-10` | Weaver backlog; several lenses need runtime placement |
| 5 | Reviewer-assistance layer (advisory-only) | `BR-80` | **Never writes facts.** Sits beside `hitl-review-trigger.ts`. Consistent with this repo's existing "no LLM in the generation path" stance |

**Deferred, deliberately:** third-party plugin discovery, two-tier mapping
config, container/compose corroboration. Internal modules suffice for now.

---

## 6. Contract-change coupling — easy to miss, breaks silently

Phase 3 changes `TypedFacts`. Per `Contract_Evolution_Policy.md` that requires
a `contractVersion` **major** bump — and `modules/registry.ts` then **skips
any module whose `supportedMajorVersion` doesn't match**, with a warning, not
an error.

**Consequence:** bumping the contract without bumping every module's declared
version silently stops that module running. `threat-signals` and
`calm-generator` both carry the declaration. Bump them deliberately and state
in the commit *why* each was reviewed, not just bumped.

---

## 7. Definition of done — per task, non-negotiable

A task is done when **all** hold:

1. `npm test` green against the §3 baseline — no count regressions.
2. `calm validate` returns 0 errors on regenerated output.
3. coe-lab core gates still pass; any stretch-package movement is stated.
4. A **Claim Register** entry exists at the status the evidence supports —
   `built` / `partial` / `specified-unbuilt` / `disproven`. Never claim beyond
   evidence.
5. Where the task closes a claim that matters, a **standing disconfirming
   exam** exists with a **frozen, non-substitutable ID**. A claim may never be
   reported satisfied by passing a different, easier exam than the one that
   originally scored it — the failure mode this repo has already recorded once.
6. Comments written for a stranger with no memory of today: no session refs,
   no task-ID shorthand. Reasoning belongs in the commit message.
7. Third-party references abstracted **the day they're written** — the target
   enterprise stack is "the target enterprise stack"; public OSS repos may be
   named plainly. Do not defer this to a cleanup sweep; that cost has already
   been paid once in this repo.

---

## 8. Out of scope for this branch

Stated so it doesn't drift in: representation replacement (CALM stays), a
CALM-pattern governance product, frontend/SPA architecture, languages beyond
Java/Python/TypeScript-Node, and any LLM on the generation path.

---

## 9. Where things live

| Artifact | Location |
|---|---|
| Implementation | This branch |
| Requirements/governance (`BR-*`/`NFR-*`/`CON-*`), capability-gap register, value ledger | Research workspace `docs/` — the monitoring station |
| Validation evidence, trust tiers, baselines | This repo (`coe-lab/docs/`, branch baselines) + research `docs/03` |
| This file | Deleted once its rows land as commits — planning artifacts don't outlive their content |
