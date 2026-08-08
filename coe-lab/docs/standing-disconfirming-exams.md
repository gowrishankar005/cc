# Standing disconfirming exams

**Status:** Phase L0 deliverable (T-L0-1), [`AGENT_TASKS_Layered_Architecture_Story.md`](../../docs/solution/AGENT_TASKS_Layered_Architecture_Story.md).
**Purpose:** freeze the original exam shapes so "done"/"closed" can never quietly come to mean a different, easier test than the one that first found the gap. This is the direct response to the failure mode paid for twice: single-root charge gold L2 FAIL while a multi-root run got called "flagship closed" without anyone checking whether it was answering the same question.

**Rule (process, not advisory):** **an architecture claim (Claim Register, BACKLOG, STATUS, chat) made without updating the relevant exam's last-run row below is a process reject**, regardless of whether the underlying code change is correct. "I ran it and it passed" is not evidence until it's written here with a date, an artefact path, and a result.

**Exam IDs are immutable.** Do not rename, do not redefine what an exam ID means once it has a last-run row — retire and add a new ID instead if the protocol genuinely needs to change, and say why in the changelog.

---

## E-charge-single-L2

| | |
|---|---|
| **Protocol** | `run-slice` on `spikes/fineract/repo/fineract-charge` alone → copy generated output to `coe-lab/generated/fineract-charge/` → `node coe-lab/scripts/validate-calm-pair.mjs --package fineract-charge --require-l2` |
| **Expected outcome** | L0 PASS, L1 PASS, **L2 FAIL** (gold expects a `service → entity` (`Charge`) relationship; the real source has no one-hop static import — `ChargesApiResource` never imports `Charge` — see `fineract-gold-vs-platform-finding.md`) |
| **Scored against** | `coe-lab/gold/calm/fineract-charge/` (single-root gold) |

**Last-run:**

| Date | Agent/session | Result | Artefact / evidence |
|---|---|---|---|
| 2026-08-07 | original finding session | L0/L1 PASS pattern consistent with expected; **L2 not scored via a frozen protocol** — pre-dates this exam doc | `coe-lab/docs/fineract-gold-vs-platform-finding.md` scorecard: 0 service→database `connects` (gold expects 1), 0 of 64 typed-facts relationships touch the service |
| 2026-08-08 | robustness session (T-C1) | **Consistent with expected L2 FAIL, not yet run under the exact `validate-calm-pair --require-l2` protocol** — closest real evidence: automated regression test confirms real Fineract `fineract-charge` alone produces **0 R2 relationships**, **exactly 2 honest `unresolved-multi-hop` ignored-items**, and **S1 (`S1-zero-service-touching-relationships`) fires** — the mechanism-level fact this exam's L2 FAIL depends on | `pipeline/test/regression.test.js`, test `"AREC T-C1 — R2 multi-hop bridge: real Fineract fineract-charge produces ZERO fabricated relationships and exactly 2 honest unresolved-multi-hop items (design note §1 prediction confirmed)"` |
| 2026-08-08 | layered-story session (T-L4-1 final matrix) | **PASS, re-confirmed on a fresh re-scan.** Fresh `run-slice` on `fineract-charge` alone → `run-expected-fail-exams.mjs` (T-L1-3 harness, not the raw `validate-calm-pair` call this time): `PASS — L0/L1 hold, L2 fails exactly as expected (honest residual, not a regression)`, exit code 0. Confirms the automated expected-fail path itself, end-to-end, on a genuinely fresh scan (not the T-L1-2-era artefact). | Fresh `coe-lab/generated/fineract-charge/architecture.calm.json` + `coe-lab/scripts/run-expected-fail-exams.mjs` |
| 2026-08-08 | layered-story session (T-L1-2 verification) | **Exact protocol now run for real, first time — L0/L1 PASS, L2 FAIL, exactly as predicted.** `run-slice` on `spikes/fineract/repo/fineract-charge` alone → `coe-lab/generated/fineract-charge/architecture.calm.json` → `node coe-lab/scripts/validate-calm-pair.mjs --package fineract-charge`: `L0 schema (gold): PASS`, `L0 schema (gen): PASS`, `L1 unit recall: PASS`, `L2 story: FAIL` — `missing connects topology service->database (gold needs 1, generated has 0)`. Root-set/scan-mode guard (T-L1-2) confirms this generated file is genuinely single-root (`x-aac-package-roots` has 1 entry) before scoring, so this is not a stale/mismatched artefact. | `coe-lab/generated/fineract-charge/architecture.calm.json` (real `run-slice` output) scored against `coe-lab/gold/calm/fineract-charge/` |

**T-L1-3 still open:** the run above proves the protocol produces the expected result, but there is still no automated **expected-fail harness** (exit 0 when L0+L1 PASS and L2 FAILs as expected, non-zero if L1 regresses or L2 unexpectedly PASSes) — that's T-L1-3, not built yet. Running `validate-calm-pair.mjs --require-l2` on this package today exits **non-zero** (L2 required and FAILing) — correct honest behavior for a CI gate that hasn't yet been taught this package's FAIL is expected, but not yet wired into a script that turns that non-zero into the *correct* zero.

---

## E-charge-multi-story

| | |
|---|---|
| **Protocol** | multi-root `run-slice` on `spikes/fineract/repo/fineract-charge` **+** `spikes/fineract/repo/fineract-provider` together → assert a **S-layered-access** edge (API family unit → store unit of access grain, `crossPackage: true`) |
| **Expected outcome** | L0 PASS + the named architecture edge present. **Not scored against single-root gold** — this is a distinct claim triple (`{rootSet: multi, terminalGrain: access-layer, evalArtefact: multi-root gold or mechanism assertion}`), never used to imply the single-root gold L2 above passed |

**Last-run:**

| Date | Agent/session | Result | Artefact / evidence |
|---|---|---|---|
| 2026-08-08 | robustness session (T-R1-3 follow-up) | **PASS (mechanism-level)** — real combined multi-root scan of `fineract-charge` + `fineract-provider` (2733+37 Java files) resolves `ChargesApiResource.java` → `ChargeReadPlatformServiceImpl.java`, `crossPackage: true`, R2 Phase 1 cross-root confidence 10, grade `architecture`; `ChargeReadPlatformServiceImpl` itself typed `database` on a real `org.springframework.jdbc.core.JdbcTemplate` import; `calm validate` 0 errors, 0 warnings | `pipeline/test/regression.test.js`, test `"Robustness T-R1-3 follow-up (B-charge-jdbc-driver) — real multi-root closure of the flagship Fineract residual: ChargesApiResource -> ChargeReadPlatformServiceImpl now resolves, real cross-root confidence 10"` |
| 2026-08-08 | layered-story session (T-L4-1 final matrix) | **PASS, re-confirmed on a fresh re-scan.** Fresh combined `run-slice` on `fineract-charge`+`fineract-provider` (`--max-old-space-size=8192`) → fresh `coe-lab/generated/fineract-charge-provider/` → `validate-calm-pair.mjs --package fineract-charge-provider --require-l2`: `L0 schema (gold): PASS`, `L0 schema (gen): PASS`, `L1 unit recall: PASS`, `L2 story: PASS`, `ALL PASS`, exit code 0. Same real edge (`ChargesApiResource` → `ChargeReadPlatformServiceImpl`) reproduced on a genuinely independent re-scan, not a cached artefact from the T-L1-1 session. | Fresh `coe-lab/generated/fineract-charge-provider/architecture.calm.json` scored against `coe-lab/gold/calm/fineract-charge-provider/` |
| 2026-08-08 | layered-story session (T-L1-1/T-L1-2 verification) | **PASS — now scored against real hand-authored multi-root gold, not just a mechanism-level test.** `node --max-old-space-size=8192 dist/orchestration/run-slice.js fineract-charge fineract-provider --out ...` → real `x-aac-package-roots` confirms 2 roots → `coe-lab/generated/fineract-charge-provider/` → `node coe-lab/scripts/validate-calm-pair.mjs --package fineract-charge-provider --require-l2`: `L0 schema (gold): PASS`, `L0 schema (gen): PASS`, `L1 unit recall: PASS`, `L2 story: PASS`, exit code 0 (`ALL PASS`). Real, honest side-finding: hundreds of "extra generated node(s)" reported (fineract-provider's other ~300 real units the 2-node gold never claimed to model) — correctly informational/soft in non-strict mode, not a failure; gold intentionally scopes to the one story it asserts, per `FINERACT_GOLD.md`'s own stated method. | `coe-lab/gold/calm/fineract-charge-provider/architecture.calm.json` (T-L1-1) scored against real `coe-lab/generated/fineract-charge-provider/architecture.calm.json` |

**Terminal grain, stated precisely (do not let this drift back into "gold entity" language):** the resolved destination is `ChargeReadPlatformServiceImpl` — an **access-layer store unit** (a JDBC-backed read-service implementation), **not** the `Charge` `@Entity` class the single-root gold expects. This is the S-layered-access story, not S-shallow. **T-L1-1 is now done** — the hand-authored multi-root gold package exists (`coe-lab/gold/calm/fineract-charge-provider/`) and the exam above is a real gold-scored PASS, not only a mechanism-level regression test.

---

## E-boa-R1

| | |
|---|---|
| **Protocol** | BoA `userservice` + `contacts` combined run (existing regression fixture) |
| **Expected outcome** | architecture `service → database` relationship present for both services; must not regress across any change in this program |

**Last-run:**

| Date | Agent/session | Result | Artefact / evidence |
|---|---|---|---|
| 2026-08-08 | robustness session (regression baseline) | **PASS** — 0 errors, 0 warnings, real relationships present | `pipeline/test/regression.test.js`, test `"Bank of Anthos — cross-package Graphify pass, real relationships, 0 errors 0 warnings"` |
| 2026-08-08 | layered-story session (T-L4-1 final matrix) | **PASS, confirmed not regressed** — full suite re-run (56/56 green) after all L0-L3 changes, including this exam's own test | Same test, full suite run after Phase L3 |

---

## E-r2-ambiguity

| | |
|---|---|
| **Protocol** | Synthetic 2-implementer fixture (an R2b implementer that imports **two** real store units) |
| **Expected outcome** | **No** fabricated architecture edge — the ambiguous case must refuse to guess and surface an honest `unresolved-multi-hop` ignored-item naming both candidates |

**Last-run:**

| Date | Agent/session | Result | Artefact / evidence |
|---|---|---|---|
| 2026-08-08 | robustness session (T-R1-2 baseline) | **PASS** — `GadgetApiResource`'s implementer (2 store imports) produces **no** relationship and **no** CALM node for the ambiguous implementer; a real `unresolved-multi-hop` ignored-item names "2 candidate store unit" | `pipeline/test/regression.test.js`, test `"AREC R2b (T-R1-2) — implementer->store hop: synthetic fixture proves the mechanism (service -> zero-evidence interface -> PLAIN implementer -> imported entity), and the ambiguity path still refuses to guess"`, fixture `pipeline/test/fixtures/r2b-implementer-hop-sample` |
| 2026-08-08 | layered-story session (T-L4-1 final matrix) | **PASS, confirmed not regressed** through T-L2-1's new `mechanism` field addition and every other L1-L3 change — full suite re-run (56/56 green) after all L0-L3 changes, including this exam's own test | Same test, full suite run after Phase L3 |

---

## E-r2b-positive

| | |
|---|---|
| **Protocol** | Synthetic sole-implementer fixture (a plain implementer class, no `@Entity`/driver import of its own, that imports exactly **one** real store unit) |
| **Expected outcome** | Real architecture edge service → store, R2b confidence tier (8 same-root), grade `architecture`; the bridge interface and the plain implementer itself must **not** become CALM nodes (pure plumbing) |

**Last-run:**

| Date | Agent/session | Result | Artefact / evidence |
|---|---|---|---|
| 2026-08-08 | robustness session (T-R1-2 baseline) | **PASS** — `WidgetApiResource` → `WidgetEntity` resolves, confidence 8, grade `architecture`; bridge interface and plain implementer both correctly absent as nodes; `calm validate` 0 errors, 0 warnings | Same test as E-r2-ambiguity above (`AREC R2b (T-R1-2)`), same fixture |
| 2026-08-08 | layered-story session (T-L4-1 final matrix) | **PASS, confirmed not regressed** — now additionally asserts `x-aac-mechanism: 'r2b'` (T-L2-1) and `relationshipsByMechanism.r2b > 0` (T-L3-2) on this same fixture; full suite re-run (56/56 green) | Same test, full suite run after Phase L3 |

---

## Product decision overrides (§0.5 of the task list)

None recorded. Owner has not overridden any `D-*` default as of this document's creation — all four defaults (`D-gold-single`, `D-gold-multi`, `D-terminal-refine`, `D-l2-strict`) stand as written in `AGENT_TASKS_Layered_Architecture_Story.md` §0.5.

---

## How to update this file

1. Run the exam's protocol for real (or, where the automated protocol doesn't exist yet, cite the closest real mechanism-level test — never a description of what "should" happen).
2. Add a new row to that exam's last-run table — do not overwrite prior rows, this is a history, not a status field.
3. Update `Claim_Register.md` / `BACKLOG.md` / `STATUS.md` in the same change (§0.6 of the task list) — an exam update with no claim-doc update is incomplete, and a claim-doc update with no exam row here is a process reject.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | **T-L4-1 — full standing exam matrix run** (program close). All 5 exams re-run/re-confirmed on genuinely fresh state (not cached artefacts): `E-charge-single-L2` and `E-charge-multi-story` re-scanned from scratch and re-scored (both PASS as expected); `E-boa-R1`, `E-r2-ambiguity`, `E-r2b-positive` reconfirmed via a full 56/56-green suite run that also exercises every L1-L3 addition (root-set guard, `mechanism` field, `relationshipsByMechanism`, HITL rationale). No exam regressed across the whole L0-L4 program. |
| 2026-08-08 | T-L1-1/T-L1-2 verification runs: both `E-charge-single-L2` and `E-charge-multi-story` now have a real run of their exact frozen protocol (previously only mechanism-level regression-test evidence). Single-root: L0/L1 PASS, L2 FAIL exactly as predicted. Multi-root: now scored against a real hand-authored gold package (`coe-lab/gold/calm/fineract-charge-provider/`, new) instead of only a regression test — L0/L1/L2 all PASS. Also verified the new `--allow-root-mismatch`-gated root-set guard in `validate-calm-pair.mjs` (T-L1-2) actually refuses the abuse case (single-root output scored against the multi-root gold) rather than silently scoring it. |
| 2026-08-08 | Initial standing-exams doc (T-L0-1). All 5 exam IDs created. E-boa-R1/E-r2-ambiguity/E-r2b-positive seeded from real, currently-green automated regression tests. E-charge-multi-story seeded from the real T-R1-3-follow-up multi-root closure test (mechanism-level PASS; formal multi-root gold scoring still pending T-L1-1). E-charge-single-L2 seeded from the original 2026-08-07 finding plus the T-C1 regression test confirming the same honest-residual mechanism; the frozen `validate-calm-pair --require-l2` protocol itself has not been run yet — pending T-L1-3's expected-fail harness. |
