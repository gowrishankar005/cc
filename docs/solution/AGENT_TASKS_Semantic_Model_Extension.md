# AGENT TASKS — Semantic Model Extension

**Branch:** `feature/semantic-model-extension` (base `main` @ `370b7c7`)
**Status (updated 2026-08-19):** Sessions A / B / C are **closed as sessions**.
A built `T-LM-0`/`T-LM-2`/`T-LM-5` (`T-LM-1`/`3`/`4` stay gated — no CVE /
classification / cost feed). B built `T-FS-1`/`2`/`3`/`4`/`6` (`T-FS-5`
parked, E5 negative). C built `T-LR-1`/`2`/`3`; `T-LR-4` **closed via T-LR-5**
(`6173b36`). Remainder in that file is `T-LR-6`. Due-list:
`AGENT_TASKS_Ext_Execution_Order.md`. Historical P0/A/B/C detail below is
kept as the record of how we got here.

**Status (updated 2026-08-14):** P0 — T-P0-0/2a/2/3 done (baseline captured,
licensing resolved, E1/CodeQL command-bus dispatch evaluated positively, see
`E1-codeql-engine-evaluation.md`); **T-P0-1/E2 run three times — reverted
twice, shipped on round 3** (93/93 `npm test` at that commit, every
populated `spikes/` repo). Independently re-verified after E4 (2026-08-14,
`cd pipeline && npm test`): **94 pass / 0 fail / 0 skip**. Round 2 named
three real architectural conflicts (reserved-territory racing with
`multi-hop-bridge-detector.ts`, S1 grade-blindness, an `ctx.allUnits` ripple
into unrelated consumers); round 3 designed and built the actual fixes
rather than another carve-out, re-verified against real repos, and found
the S1 conflict never reproduced and the "ripple" was mostly stale,
over-broad test assertions written before E2 existed — see
`E2-graded-fact-admission-experiment.md`'s "Round 3" section for the full
disposition. **T-P0-5/E4 ran (MIXED) and T-P0-6/E5 ran (negative,
`L3`/`L4` deprioritised); T-P0-4/E3 is explicitly deprioritised**, not
unstarted — see `AGENT_TASKS_Ext_P0_Experiments.md`. The P0 gate itself
only required E1+E2 to report (both did), so this did not block moving into
Layered Recovery. Fact Semantics: **T-FS-2 done** (E2 already live; no separate productionise
step); **T-FS-5 skipped** (E5 negative — parked in `BACKLOG.md` "Decided not
to build"). The `unitsByRoot`/`allUnits` confidence-floor divergence (P1,
surfaced by T-LR-2) is **closed** — one floor, both lists (`U-floor-consistency`).
Layered Recovery's `[B]` tasks (ungated, see the diagram note in
§5 below) remain the focus: **T-LR-1 and T-LR-2 done and shipped**
(`AGENT_TASKS_Ext_Layered_Recovery.md`); an additional, not-originally-planned
CodeQL DI-resolution experiment (informally "E1b," motivated by T-LR-3/T-LR-4's
own evidence-pass requirement) also ran positive, see
`E1b-codeql-di-resolution-experiment.md` — **T-LR-3 done**; T-LR-4 closed via
T-LR-5 (CodeQL `bean-factory` branch; Graphify/CodeGraph still cannot see
`@Bean` `new X(...)`). T-LR-6 (trust matrix) remains in
`AGENT_TASKS_Ext_CodeQL_Engine.md`. **Lens Modules —
T-LM-0, T-LM-2, T-LM-5 done; T-LM-1 checked and deferred (no real
SCA/vulnerability feed — cdxgen produces an SBOM, not vuln data);
T-LM-3/4 stay gated (no classification facts / no cost feed).** `Engine_Capability_Research_Java_SpringBoot_JAXRS.md`
records a deliberate research pause taken partway through. Lane files:
`AGENT_TASKS_Ext_*.md`.
**Companion:** requirements/governance live in the research workspace
(`codeintel/Architecture Model/docs/`), referenced by ID (`BR-*`, `NFR-*`,
`CON-*`, `L*`, `A*`, `E*`).

Read `CLAUDE.md`, `Claim_Register.md`, `OOS_Registry.md`, and `BACKLOG.md`
**before** starting. This file assumes them; it does not restate them.

---

## 0. Governance constraints that bind this branch — read first

These were found in this repo's own registries. Several would have been
violated by a naive reading of the extension goal.

| Constraint | Source | What it forbids / requires here |
|---|---|---|
| **`OOS-command-bus` is a permanent non-goal** — resolving runtime string-keyed dispatch into a static relationship | `OOS_Registry.md` | **E1 is not "adding a tool." It is firing this row's documented revisit trigger:** *"A future engine … is evaluated AND verified against a real command-bus case before being adopted — never assumed to work."* Report E1 in exactly those terms |
| **`OOS-sample-repo-detectors`** — no catalogue row, matcher, or code path keyed to a sample repo's class/module/package name | `OOS_Registry.md` | The existing draft dispatch query is keyed to a specific platform's builder/annotation class names. **As written it is rejectable on review.** It must be generalised to a mechanism class (string-keyed registry dispatch) before it can ship |
| **Dual-unit gate is a deliberate product decision (R0), not a bug** | `Claim_Register.md` | E2 changes a *product decision*, not a defect. Frame and justify it as such |
| **`E-charge-single-L2` asserts L2 FAILS** for the single-root case, by design | `Claim_Register.md` | If a change makes it pass, the first question is *"did we fabricate an edge that isn't in the source?"* — not celebration. There is no static one-hop chain in that source |
| **R1 is regression-locked** | `Claim_Register.md` | R2/admission work must not silently regress the proven one-hop service→db shape |
| **`OOS-unbounded-multihop`** — fixed 2-hop bound | `OOS_Registry.md` | Do not raise the hop bound without a designed + verified ambiguity rule |
| **Claim triple discipline** `{rootSet, terminalGrain, evalArtefact}` | `Claim_Register.md` | Never report a claim closed without naming all three. This repo has already recorded one conflation incident |
| **Forbidden-phrase table** | `Claim_Register.md` | Governs how every result in this branch is written up |
| **`OOS-llm-core-path` — "revisit trigger: Never"** | `OOS_Registry.md` | Aligns with `BR-80`. Reviewer assistance stays off the generation path, permanently |

---

## 1. Hard gates — verified on this machine, 2026-08-13 (original), re-verified same day (update)

| Prerequisite | State (original) | State (update, later same day) | Needed for |
|---|---|---|---|
| `spikes/` sample repos | Absent | **Present** — `apache/fineract`, `bank-of-anthos`, `ghostfolio`, `finos/waltz` cloned, unshallowed | E1, E2 round 2 |
| CodeQL CLI | Not installed | **Installed** — 2.26.3 via `brew install --cask codeql` | E1 |
| Working Java build of the sample | Unverified | **Confirmed working** (`CON-10` resolved) — the real blocker hit was a shallow clone missing git tags for Fineract's Gradle version-derivation plugin, not a network/dependency problem; fixed by unshallowing | E1 |
| `graphifyy` on PATH | Not present | **Correction: this was always wrong** — `graphifyy` (0.9.34) was genuinely installed the whole time; the original `pip show` check ran against the wrong Python on this machine. See `baseline-2026-08-13.md`'s correction note | Cross-package pass |
| coe-lab fixtures + scripts | Present | Present, but found to produce **zero raw Graphify edges** even in a combined 7-root scan — too sparse to exercise cross-reference detection at all (a separate finding from the `graphifyy` question above) | E2 stage 1 |

**Sequencing (original plan, now moot — both stages ran):** E1 evaluated
positively (`E1-codeql-engine-evaluation.md`); E2 run three times — reverted
twice, shipped on round 3 (`E2-graded-fact-admission-experiment.md`).

## 2. Isolation (`CON-40`)

`coe-lab/gold/**` is **DO NOT READ** while implementing. See `CLAUDE.md` and
`coe-lab/ISOLATION.md`. E2's entire value is a measurement; a measurement
taken by a process that read the answer key is void, not weak.

## 3. Baseline — task 0, before any edit

```bash
cd pipeline && npm install && npm run build && npm test   # expect 64 pass / 0 fail / 25 skip
cd ../coe-lab && node scripts/generate-calm.mjs --all-core \
  && node scripts/validate-calm-pair.mjs --all-core && node scripts/scoreboard.mjs
```
Commit as `docs/solution/baseline-<date>.md`. Every later claim is a delta
against it.

---

## 4. Phase 0 — experiments (all five from `docs/06` §4)

### E2 — graded fact admission *(start here; `L1`)*
Does admitting an edge whose endpoint doesn't resolve to a TypedUnit recover
real architecture that `graphify-reconciler.ts:142` (`if (!from || !to) continue;`)
currently drops?

**Acceptance — all five:**
1. Recall ↑ at L2, measured.
2. **`lib-fintech-common` must-not-detect trap still passes** — the named
   primary regression risk of admitting more facts.
3. Core-package semantic gates stay green; **R1 regression-lock holds**.
4. `E-charge-single-L2` still fails *for the right reason* — verify no
   fabricated edge (see §0).
5. False-positive cost stated **as a number**.

### E1 — build-based engine vs string-keyed dispatch (`OOS-command-bus` revisit trigger)
**Capability (narrow):** resolve caller→callee where dispatch is a
string-keyed registry lookup with registration and lookup in different files,
Java — **expressed generically, never keyed to sample-repo class names**
(`OOS-sample-repo-detectors`).

Ground truth already exists (hand-verified findings). Do not author new ground
truth to fit the tool.

**Acceptance:** reproduces the hand-verified join on a real database **and**
the detector is generic. Then — and only then — implement as a second
`StructuralEngine`; `engine-capability-matrix.yml` already carries the augment
slot. Governed by `BACKLOG.md` P3: *"Additional engines on measured gaps only
— not speculatively."* The measured gap is the recorded L2 finding.

### E3 — buildless structural extraction (AST-class) for frameworks with no semantic model
Detects routes current engines miss, at a trust tier **below** semantic
engines. Kills/keeps the AST-engine registry slot.

### E4 — catalogue-as-data under stress (`A5`)
Add one untested framework via catalogue row only. **Passes only if zero
builder code changes.** Falsifies or confirms this repo's central extensibility
claim.

### E5 — does confidence combination change a decision? (`L3`/`L4`)
Replay probabilistic-OR + contradiction detection over existing runs. Passes
if ≥1 fact changes status in a way a reviewer agrees is more correct.
**If nothing changes, deprioritise `L3`/`L4`** — they'd be theory.

---

## 5. Execution lanes

Work is split into lane files for parallel/sequential tracking. **This file
holds the cross-cutting governance (§0), gates (§1-3) and DoD (§7); lane files
hold tasks and reference back here rather than restating.** Requirements are
tracked as rows in `BACKLOG.md` — not in a separate register.

```
        T-P0-0 Baseline
              │
   ┌──────────┼───────────────┬──────────────┬─────────────┐
   ▼          ▼               ▼              ▼             │
 P0: E2    P0: E1-prereq   P0: E3/E4/E5      │             │
   │          │                              │             │
   │          ▼                              │             │
   │       P0: E1 eval                       │             │
   │          │                              │             │
   └────┬─────┘                              │             │
        ▼                                    │             │
   Fact Semantics ──► Contract & Lifecycle   │             │
        │                    │               │             │
        ├──► Layered Recovery│               │             │
        ├──► Review Throughput               │             │
        │                    ▼               │             │
        │            MultiRepo & Deployment  │             │
        │                                    │             │
   Lens Modules ◄────────────────────────────┴─────────────┘
   (independent — parallel from day one)
```

**Diagram imprecision, found 2026-08-13 while auditing actual execution against
this file:** the arrow from `Fact Semantics` into `Layered Recovery` above
draws the whole lane as gated on Fact Semantics. It isn't — `AGENT_TASKS_Ext_Layered_Recovery.md`'s
own header is more precise: **"Depends on: Fact Semantics (T-FS-2) for the
engine work only."** Layered Recovery's `[B]`-marked tasks (already-evidenced
backlog items, T-LR-1 through T-LR-4) are ungated, same as the table below
already states — only the engine sub-tasks (T-LR-5/T-LR-6) wait on Fact
Semantics. This diagram is illustrative, not authoritative — the table and
each lane file's own header win on conflict, same rule
`Architecture_as_Code_Solution_Design_v2.md` §0 already uses elsewhere in
this repo. Not redrawn to avoid introducing a second imprecision under time
pressure — this note is the correction.

| Lane file | Gate | Parallel with |
|---|---|---|
| `AGENT_TASKS_Ext_P0_Experiments.md` | none — runs first | Lens Modules |
| `AGENT_TASKS_Ext_Fact_Semantics.md` | E2, E5 report | Lens Modules, Layered `[B]` tasks |
| `AGENT_TASKS_Ext_Layered_Recovery.md` | Session C closed (`T-LR-1`/`2`/`3` done; `T-LR-4` closed via T-LR-5) | — |
| `AGENT_TASKS_Ext_CodeQL_Engine.md` | T-LR-5 done (`6173b36`). Remainder: T-LR-6 | Not a second T-LR-5 |
| `AGENT_TASKS_Ext_Lens_Modules.md` | Session A closed (`T-LM-0`/`2`/`5` done; `T-LM-1`/`3`/`4` gated) | — |
| `AGENT_TASKS_Ext_Remaining_Lenses.md` | T-LM-8 now; T-LM-6/7 need a consumer + gold | — |
| `AGENT_TASKS_Ext_Contract_Lifecycle.md` | T-CL-5 now; T-CL-1…4 after T-FS-6 | Lens Modules |
| `AGENT_TASKS_Ext_Review_Throughput.md` | T-FS-1 | Layered Recovery |
| `AGENT_TASKS_Ext_MultiRepo_Deployment.md` | T-MR-3/5 now; T-MR-1/2 after T-CL-2 | Lens Modules |
| `AGENT_TASKS_Ext_Execution_Order.md` | — | The due-list and wave order |

**Two lanes can start immediately:** P0 experiments, and Lens Modules —
modules consume `typed-facts.json` only, so they neither block nor are blocked
by the gate. The `[B]`-marked tasks in Layered Recovery are existing,
already-evidenced backlog items and are cheaper than engine work.

**Deferred:** third-party plugin discovery, two-tier mapping config,
container/compose corroboration, Kinesis, deeper OAuth2, ADR ingestion,
portable round-trippable IR.

**Adopted into the research design, no build work:** relationship grading,
silence/completeness metrics, unmapped-signal clustering, catalogue-as-data
(tested by E4), strict-detect gate, claim register + exams, evaluation
isolation, `StructuralEngine` vendor isolation, module registry, exact-value
regression suite, secret redaction (closes `CGR-2`).

## 5b. Knowingly deferred — named so they aren't mistaken for oversights

| Item | Why deferred | What would reopen it |
|---|---|---|
| **Scale target** (`NFR-50`) | No target repo set committed, and no measured scale problem. Inventing a number would be requirements outrunning evidence | A pilot repo where a run is too slow to sit in per-PR CI |
| **Access governance over the generated model** (`NFR-60`) | Real need — the model can reveal architecture/security detail more legibly than raw source — but no design in either project | First time the model is shared beyond the team that can already read the source |
| **Second representation emitter** (`NFR-40` proof) | Portability becomes measurable via emission-coverage (T-CL-5) without building one | A real consumer needing a non-CALM form |
| **Catalogue authoring-cost tracking** (`CGR-8`) | E4 tests that catalogue-as-data holds; per-convention cost tracking is extra bookkeeping until breadth actually strains | Framework breadth becomes the bottleneck |
| **Vulnerability / data-flow / green lenses** (`T-LM-1/3/4`) | Session A checked each gate; none has a real feed or fact type yet. Phase 2 — research, inputs, validation. Not a current-phase build | Real SCA feed; real classification/lineage signal; real non-code cost feed — each with gold before any gate |
| **Probabilistic confidence** (`T-FS-5`) | E5 negative. Phase 2 if a *different* combination rule is researched | Independent-evidence shape where a new formula is more correct |

**Closed by discovery, not by work:** `CGR-11` asked whether the two
structural engines have value beyond one negative finding. Answered — both are
in production use as complementary primary/secondary sources. No experiment
needed.

## 5c. Feeding the value/cost ledger during execution (`BR-130`)

Every lane task that produces a real run gets one question at close: **did
this produce a value event, a cost event, both, or neither?** Log it in the
monitoring station's ledger. "Neither" is a valid answer and needs no entry —
do not manufacture one. A ledger with only wins is marketing, not measurement,
so cost events (wasted review time, false positives, heavy manual correction)
are logged with the same rigour.

**Isolation enforcement note:** gold paths are listed in `.cursorignore` /
`.grokignore`. A session using different tooling has **no automatic guard** —
`CON-40` then rests on discipline alone. If in doubt, run scoring and
implementation as separate sessions.

## 6. Contract-change coupling — fails silently

Phase 3 changes `TypedFacts` → `contractVersion` **major** bump per
`Contract_Evolution_Policy.md`. `modules/registry.ts` then **skips** any module
whose `supportedMajorVersion` doesn't match — it warns, it does not fail. Bump
`calm-generator` and `threat-signals` deliberately; state in the commit why
each was *reviewed*, not merely bumped.

## 7. Definition of done — per task

1. `npm test` green vs §3 baseline.
2. `calm validate` 0 errors.
3. coe-lab core gates green; stretch movement stated; **R1 lock intact**.
4. `Claim_Register.md` entry at the status evidence supports, with the
   **claim triple** named.
5. Standing disconfirming exam with a **frozen, non-substitutable ID** where
   the task closes a claim that matters.
6. `scope-limitations.yml` ↔ claim-register consistency checked
   (`BACKLOG` P3 standing discipline).
7. Comments for a stranger with no memory of today; reasoning in commit
   messages.
8. Third-party references abstracted **same-day**, never as a later sweep.
9. Write-up obeys the forbidden-phrase table.
10. **If the task involved fixing a failing/unexpected case: the mechanism
    class is named, and the fix is verified against a second, different
    instance of that class** — not only the case that revealed it
    (`Catalogue_Intake.md`, `CLAUDE.md` "Bug fixes are capability work"). If
    no second instance exists yet, state that explicitly rather than skip it.
    Applies across every lane — E2's admission logic, E1/T-LR-5's engine
    detector, and every `[B]` backlog item in Layered Recovery are all
    exactly this shape of work.

    **This rule exists because of a real incident, not a hypothetical one —
    read both sides of it.** T-LR-1's first pass hardcoded an annotation name
    as a literal; it was not self-caught. The project owner found the diff
    suspicious and had to explicitly task a review before it was refactored
    into a catalogue row. **Don't treat a task's own "Done" status or a
    status-note phrase like "flagged on review" as proof this rule was
    followed — read the diff.** T-LR-2's second-repo verification (Waltz,
    beyond the original Fineract sample) is a genuine example of the rule's
    *outcome* done right, in `Claim_Register.md`'s `R2-mechanism` row — but
    it doesn't establish that the *process* catches violations on its own.
    So far, only a human reading a diff has.

## 8. Out of scope

Representation replacement, CALM-pattern governance product, frontend/SPA,
languages beyond Java/Python/TS-Node, LLM on the generation path, and every
row in `OOS_Registry.md`.

## 9. Where things live

| Artifact | Location |
|---|---|
| Implementation, evidence, baselines | This branch |
| Requirements/governance, capability-gap register, value ledger | Research workspace — the monitoring station |
| This file | Deleted once its rows land as commits |
