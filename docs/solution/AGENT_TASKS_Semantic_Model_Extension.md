# AGENT TASKS — Semantic Model Extension

**Branch:** `feature/semantic-model-extension` (base `main` @ `370b7c7`)
**Status:** scoped, not started.
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

## 1. Hard gates — verified on this machine, 2026-08-13

| Prerequisite | State | Needed for |
|---|---|---|
| `spikes/` sample repos | **Absent** | E1, E2 stage 2 |
| CodeQL CLI | **Not installed** | E1 |
| Working Java build of the sample | **Unverified** | E1 (`CON-10` — the step that blocked prior attempts) |
| `graphifyy` on PATH | **Not present** | Cross-package pass. Degrades *silently* — and that pass is what E2 measures |
| coe-lab fixtures + scripts | Present | E2 stage 1 — unblocked today |

**Sequencing:** E2 stage 1 leads (unblocked). E1 prerequisites install in
parallel; E1 itself follows.

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

## 5. Phase 1+ — build, only if gates pass

Existing `BACKLOG.md` P1 items marked **[B]** — these are *already evidenced*
by this repo and are cheaper paths to the layered-architecture goal than new
tooling. Prefer them.

| Phase | Item | Ref |
|---|---|---|
| 1 | **[B] Tier-B residual detection** — no detector currently emits a "medium-confidence, needs human decision" class. **This is `L7`'s status vocabulary, already identified here as a gap** | `BACKLOG` P1, `L7` |
| 1 | Graded fact admission, productionised | `L1`, E2 |
| 1 | Contradiction detection → conflict → review | `L4` |
| 1 | Probabilistic-OR confidence (gate on E5) | `L3` |
| 1 | Secondary sources may introduce facts | `L2` |
| 2 | **[B] Direct-delegate bridge detection** — 28 real candidates found, 0 resolved | `BACKLOG` P1 |
| 2 | **[B] Plain-interface bridge detection** | `BACKLOG` P1 |
| 2 | **[B] Bean-factory / stereotype-free wiring** | `BACKLOG` P1 |
| 2 | **[B] `@Configuration` mis-typed `database`** — cheap, general, ready | `BACKLOG` P1 |
| 2 | CodeQL engine, productionised (generic) | E1, `BR-10` |
| 2 | Per-(tool, fact-type) trust tiers | `L5` |
| 3 | Fact identity + incremental merge + review history | `L6`, **§6** |
| 3 | Emission-coverage as governed rule | `L9` |
| 4 | Lens modules: green-engineering, resilience, data-flow, vulnerability | `BR-50` |
| 4 | **[B] Call-site security controls** (4 vocabularies today, not general) | `BACKLOG`, `C-call` |
| 4 | **[B] Bulk residual-decision authoring** — real throughput problem | `BACKLOG` P1, `NFR-80` |
| 5 | Cross-repo joins (beyond co-scanned multi-root) | `L8`, `BR-20` |
| 5 | **[B] k8s-derived `deployed-in`** | `BACKLOG`, `BR-10` |
| 5 | **[B] Persistence catalogue completion** (plain-import drivers) | `BACKLOG`, `BR-10` |
| 5 | **[B] Decision Record boundary-change overrides** | `BACKLOG`, `BR-70` |
| 5 | Reviewer assistance — advisory only, never on generation path | `BR-80`, `OOS-llm-core-path` |

**JDBC ownership landmine** (`BACKLOG` P1): a fix must only ever change `kind`
from `database` to `service` — **never suppress unit creation**, or it
regresses `R2-multi-root-access-terminal`, which depends on that class
resolving to a unit at all.

**Deferred:** third-party plugin discovery, two-tier mapping config,
container/compose corroboration, Kinesis, deeper OAuth2, ADR ingestion,
portable round-trippable IR (`BACKLOG` P2/P3).

**Adopted from this repo into the research design — no build work, governance
only:** relationship grading (`A1`), silence/completeness metrics (`A2`),
unmapped-signal clustering (`A3`), catalogue-as-data (`A5`, tested by E4),
strict-detect gate (`A6`), claim register + exams (`A7`), isolation (`A8`),
`StructuralEngine` vendor isolation (`A9`), module registry (`A10`),
exact-value regression suite (`A11`), secret redaction (`A12` — closes
`CGR-2`).

---

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
