# Agent task list — Layered architecture story (exam lock + multi-root productization)

**Single source of truth** for implementing the approved plan: *generic store-terminal / multi-root story productization* — get intermediate-layer recovery right **once**, with **no third RCA** on the Fineract-class gold failure.

**Product:** Weaver. Evidence monorepos (Fineract, BoA, Waltz, …) are **samples**, never the product target.

**Plan authority:** session plan *Intermediate-layer architecture recovery — get it right once* (product owner approved). This file turns that plan into executable agent tasks.

**Related:**

| Doc | Role |
|---|---|
| [`Claim_Register.md`](./Claim_Register.md) | Claim cells — must split R2 by claim triple |
| [`BACKLOG.md`](./BACKLOG.md) | Thin index (**B-layered-story** / phase IDs below) |
| [`AREC_R2_MultiHop_Strategy.md`](./AREC_R2_MultiHop_Strategy.md) | R2 Phase 1 |
| [`AREC_R2b_Implementer_Store_Hop.md`](./AREC_R2b_Implementer_Store_Hop.md) | R2b |
| [`coe-lab/docs/multi-root-l2-protocol.md`](../../coe-lab/docs/multi-root-l2-protocol.md) | Q11 HOW |
| [`coe-lab/docs/fineract-gold-vs-platform-finding.md`](../../coe-lab/docs/fineract-gold-vs-platform-finding.md) | Original RCA + retest addendum target |
| [`coe-lab/docs/validation-approach-vnext.md`](../../coe-lab/docs/validation-approach-vnext.md) | L0–L5 |
| [`Architect_Residual_Review_Session.md`](./Architect_Residual_Review_Session.md) | Residual only — **not** primary path for this program |
| [`ISOLATION.md`](../../coe-lab/ISOLATION.md) | Gold must not train detectors |

---

## 0. How to use this file (mandatory)

### 0.1 Phase order — hard

```
Phase L0  Exam & claim lock (docs only)
  → Phase L1  Eval productization (dual gold + validate-calm-pair + expected-fail)
  → Phase L2  Store-terminal / intermediate-layer code (only after C1 decision recorded)
  → Phase L3  Multi-root operator productization
  → Phase L4  Full exam matrix re-run + final claim wording
```

| Rule | |
|---|---|
| **Do not start L2 code** before L0 + L1 exit criteria are met | Prevents another “mechanism green, exam forgotten” cycle |
| **Do not mark R2 / flagship “closed”** without updating standing exam last-run rows | Process reject |
| **Do not bootstrap multi-root gold from generator output** | Isolation |

### 0.2 Why this program exists (agent orientation)

| Failure mode (paid twice) | This program’s response |
|---|---|
| Single-root charge gold L2 FAIL while multi-root “flagship closed” | **Standing exams** with separate IDs for single vs multi |
| Success criterion silently moved (entity gold → JDBC-impl edge) | **Claim triple:** `{ rootSet, terminalGrain, evalArtefact }` |
| L2 type-multiset false comfort | Optional endpoint L2 + multi gold protocol |
| Intermediate layers treated as Fineract one-off | **Generic** S-shallow / S-layered-access / S-layered-domain / S-unresolved |

### 0.3 Integrity (reject PR if violated)

| Principle | Required | Reject |
|---|---|---|
| Generic mechanisms | Structural / catalogue tests only | `ChargesApiResource`, `fineract-charge`, or any sample class/module name in detector logic |
| Honesty | Non-fabricating (0 or 2+ → silence) | Edge invented to clear S1 or gold L2 |
| Determinism | No LLM in `run-slice` | Advisory writes TypedFacts |
| Exam lock | Update standing exam last-run on architecture PRs | “Done” only in chat |
| Gold isolation | Hand-author multi gold from source | Copy generator CALM into gold |
| Claims | Claim Register + BACKLOG + STATUS | Bare “flagship closed” without exam IDs |
| Disconfirming pair | BoA R1 still green + multi-impl still refuses | One happy multi-root only |

### 0.4 Story vocabulary (use in claims and gold metadata)

| Story ID | Meaning | Typical terminal |
|---|---|---|
| **S-shallow** | R1 one-hop | Entity / db class / repo |
| **S-layered-access** | R2 Phase 1: sole implementer **is** database/topic unit | JDBC / data-access / “read platform” class |
| **S-layered-domain** | R2b: implementer not store, imports exactly one store unit | Entity / repository unit |
| **S-unresolved** | 0/2+ candidates or out of root set | Silence / unresolved-multi-hop |

### 0.5 Product decisions (default if owner silent — do not re-litigate in code)

| ID | Decision | Default |
|---|---|---|
| **D-gold-single** | Keep `fineract-charge` L2 as **expected-fail** under single-root | **Yes** |
| **D-gold-multi** | Add hand-authored multi-root access-layer gold package | **Yes** |
| **D-terminal-refine** | Prefer domain store when Phase 1 would stop on access-unit but unique domain store import exists | **Phase L2b optional** — access default first |
| **D-l2-strict** | Type multiset stays default L2; endpoint-aware L2 opt-in | **Yes** |

Owner may override in writing at Phase L0 start; record override in standing-exams doc.

### 0.6 Every phase completion

1. Integrity home named.  
2. BACKLOG IDs flipped.  
3. Claim Register + STATUS updated.  
4. Standing exam last-run rows updated (where applicable).  
5. Regression suite green (`pipeline` `npm test`).  
6. PR template filled (§0.7).

### 0.7 PR template

```markdown
## Weaver layered-architecture-story delivery
- Phase: <L0|L1|L2|L2b|L3|L4>
- Task IDs: <T-L0-1, …>
- Failure mode addressed: <P-scope|P-terminal|P-exam>
- Integrity home: <docs|eval|detector|platform-artefact>
- Paths: <…>
- Standing exams updated: <E-*>
- BACKLOG IDs: <…>
- Claim Register: <cells / claim triple>
- Regression: <tests>
- Explicit residual: <what is still S-unresolved / expected-fail>
- Sample hardcodes: none (confirm)
```

### 0.8 Regression shields (always)

Keep green: BoA R1, Nest, R2 synthetic sole-impl, R2b fixture, R2 multi-impl **refusal**, S1 honesty, Ghostfolio ontology, charge-related **expected-fail** once harness lands.  
**Never delete** residual-honest or expected-fail tests to force green.

---

# Phase L0 — Exam & claim lock (docs only)

**Goal:** Freeze the original exam so “done” cannot mean a different test.  
**No detector code. No gold rewrite that drops L2 without recording expected-fail.**

**Phase L0 done when:** standing exams doc exists; Claim Register R2 split by claim triple; finding retest addendum landed; BACKLOG/STATUS/multi-root protocol link the exams.

### T-L0-1 — Standing disconfirming exams document

| | |
|---|---|
| **Deliverable** | `coe-lab/docs/standing-disconfirming-exams.md` |
| **Content (required)** | Immutable exam IDs below; for each: protocol commands, expected outcome, last-run table (date, agent/session, result, artefact path), rule “architecture claim without exam update = process reject” |
| **Exam IDs (create all rows)** | |
| **E-charge-single-L2** | Protocol: `run-slice` on `fineract-charge` alone → copy gen to `coe-lab/generated/fineract-charge/` → `validate-calm-pair --package fineract-charge --require-l2`. **Expected:** L0 PASS, L1 PASS, **L2 FAIL** (gold service→entity). Last-run: seed from 2026-08 retest if available. |
| **E-charge-multi-story** | Protocol: multi-root `fineract-charge` + `fineract-provider` → assert **S-layered-access** edge (API family → store unit of access grain). **Expected:** L0 PASS + named architecture edge present. Not scored against single-root gold. |
| **E-boa-R1** | BoA userservice+contacts (or existing regression): architecture service→db present. Must not regress. |
| **E-r2-ambiguity** | Synthetic 2-implementer fixture: **no** fabricated architecture edge. |
| **E-r2b-positive** | Synthetic sole-impl imports one store: architecture edge to store. |
| **Integrity home** | docs / coe-lab |
| **Exit** | File linked from Claim Register, BACKLOG, multi-root protocol, STATUS “how to update” |

### T-L0-2 — Claim Register R2 rewrite (claim triple)

| | |
|---|---|
| **Deliverable** | Update `Claim_Register.md` R2 row (and forbidden/allowed phrases) |
| **Required split** | Do **not** keep a single “flagship CLOSED” blob. Split into at least: |
| | **R2-mechanism** — partial/proven: fixtures + multi-root samples (cite paths) |
| | **R2-gold-charge-single** — **expected L2 fail** under E-charge-single-L2 |
| | **R2-multi-root-access-terminal** — partial/proven: multi-root service→access-layer store (e.g. JDBC impl unit), **not** identity with gold entity endpoint |
| **Forbidden** | “Flagship closed” / “Java relationships work end-to-end” without exam IDs and claim triple `{rootSet, terminalGrain, evalArtefact}` |
| **Allowed example** | “R2 recovers S-layered-access on multi-root charge+provider (E-charge-multi-story); single-root charge gold L2 remains expected-fail (E-charge-single-L2)” |
| **Exit** | Changelog row dated; AREC DoD binding paragraph updated if it still says flagship closed without exams |

### T-L0-3 — Finding doc retest addendum

| | |
|---|---|
| **Deliverable** | New section on `coe-lab/docs/fineract-gold-vs-platform-finding.md` |
| **Content** | 2026-08 retest: single-root still L0/L1 PASS L2 FAIL; multi-root recovers S-layered-access (API→JDBC impl), not gold entity; process miss (exam not frozen); pointer to standing exams + this task list |
| **Do not** | Delete original finding; do not claim L2 fixed for single-root gold |
| **Exit** | Section + link to `standing-disconfirming-exams.md` |

### T-L0-4 — BACKLOG + STATUS + multi-root protocol pointers

| | |
|---|---|
| **Deliverable** | BACKLOG row **B-layered-story** (program index); STATUS note; link from `multi-root-l2-protocol.md` to standing exams |
| **Exit** | Agents can find Phase L0–L4 from BACKLOG “Now/next” |

**Phase L0 exit checklist**

- [x] T-L0-1…T-L0-4 done — `coe-lab/docs/standing-disconfirming-exams.md`, `Claim_Register.md` R2 split, finding retest addendum, BACKLOG/STATUS/protocol pointers (2026-08-08)
- [x] No pipeline detector changes required — confirmed, docs-only phase, no `pipeline/src` touched
- [ ] PR template filled — pending actual PR creation (this session made the file changes; PR/commit step not yet run)

---

# Phase L1 — Eval productization

**Goal:** Dual gold protocols + harness so multi CALM cannot false-PASS single-root gold; expected-fail automation for E-charge-single-L2.  
**Depends on:** Phase L0 complete.

**Phase L1 done when:** multi-root gold package exists (hand-authored); validate-calm-pair enforces scan-mode/root-set mismatch; expected-fail path works; fixtures still green.

### T-L1-1 — Multi-root access-layer gold package (hand-authored)

| | |
|---|---|
| **Deliverable** | e.g. `coe-lab/gold/calm/fineract-charge-provider/architecture.calm.json` (+ FINERACT_GOLD.md note) |
| **Metadata (required)** | `x-lab-gold-source: hand-authored`; `x-lab-scan-mode: multi-root`; `x-lab-root-set` (generic labels + evidence paths in description); `x-lab-terminal-grain: access-layer`; `x-lab-story: S-layered-access` |
| **Assert** | Service unit for charges API (paths); **database/store** unit representing access-layer terminal (read-platform / JDBC-style store unit — describe generically in gold text); **one** `connects` service→that store (architecture story). **Do not** require entity `Charge` as destination unless source shows static import chain (it does not for the read impl). |
| **Isolation** | Author from **source** + mechanism docs, **not** by copying `tmp/fineract-gold-retest/.../architecture.calm.json` unique-ids wholesale. Paths/interfaces may match known public API surface. |
| **Validate** | `calm validate` 0 errors on gold alone |
| **Exit** | Gold schema green; documented in FINERACT_GOLD.md table |
| **Status** | **done, 2026-08-08** — `coe-lab/gold/calm/fineract-charge-provider/architecture.calm.json`, authored from real source (`ChargesApiResource.java`, `ChargeReadPlatformServiceImpl.java` — real `implements ChargeReadPlatformService`, real `JdbcTemplate`/`NamedParameterJdbcTemplate` fields, confirmed via direct grep of `spikes/fineract/repo`, not copied from any generator output). `calm validate` 0 errors, 0 warnings. Scored for real against a real multi-root `run-slice` output — L0/L1/L2 all PASS (see `standing-disconfirming-exams.md`, `E-charge-multi-story`). |

### T-L1-2 — validate-calm-pair: refuse cross-protocol scoring

| | |
|---|---|
| **Deliverable** | `coe-lab/scripts/validate-calm-pair.mjs` (and help text) |
| **Behavior** | If gold has `x-lab-scan-mode: multi-root` (or `x-lab-root-set`), generated CALM must be scored only when invoker passes explicit multi-root flag **or** generated metadata matches; if gold is single-root and generated is clearly multi-root mega-graph (heuristic: optional), prefer **explicit** `--allow-root-mismatch` rather than silent score. Minimum bar: document + implement **refuse default** when gold `x-lab-scan-mode` is `multi-root` but package path is single-module generated without matching metadata. |
| **Practical minimum** | Gold packages register expected `scanMode`; CLI `--scan-mode single|multi`; mismatch → L1/L2 N/A or hard fail with clear message (pick one; document). |
| **Exit** | Cannot get charge gold L2 PASS by dropping multi-root CALM into `generated/fineract-charge/` without an explicit override flag |
| **Status** | **done, 2026-08-08** — refuse-by-default guard reads the GENERATED file's own real `x-aac-package-roots` metadata (already stamped by the platform, never a self-declared CLI flag) against the gold's `x-lab-scan-mode`. `--allow-root-mismatch` is the explicit override. **Verified both directions with real data, not assumed**: a real single-root `fineract-charge` generated output copied into `generated/fineract-charge-provider/` was correctly refused with a named reason; the real multi-root generated output was correctly accepted and scored. |

### T-L1-3 — Expected-fail harness for E-charge-single-L2

| | |
|---|---|
| **Deliverable** | Manifest and/or CLI mode e.g. `--expected-l2-fail` package list, or `coe-lab/docs/expected-fail-exams.json` consumed by validate script / small runner |
| **Behavior** | For packages in expected-L2-fail set: exit **0** if L0+L1 PASS and L2 FAIL; exit **non-zero** if L1 regresses or L2 unexpectedly PASSes |
| **Wire** | Document commands in standing-disconfirming-exams.md; optional gated test when clone present |
| **Exit** | E-charge-single-L2 runnable as automated expected-fail |
| **Status** | **done, 2026-08-08** — `coe-lab/docs/expected-fail-exams.json` (manifest) + `coe-lab/scripts/run-expected-fail-exams.mjs` (runner, shells out to `validate-calm-pair.mjs`, parses its L0/L1/L2 status lines — no duplicated scoring logic). Verified both branches with real/simulated data: real `fineract-charge` run correctly exits 0 (L0/L1 PASS, L2 FAIL as expected); a temporary manifest pointed at `fineract-charge-provider` (whose L2 genuinely passes) correctly exits 1 with "UNEXPECTED L2 PASS," confirming the harness doesn't just always pass. |

### T-L1-4 — Optional endpoint-aware L2 (`--l2-endpoint` or gold metadata)

| | |
|---|---|
| **Deliverable** | Opt-in L2 that uses L1-matched node pairs for connects, not only `service→database` type multiset |
| **Default** | Lab core packages keep type-multiset L2 (no mass breakage) |
| **Wild gold** | Multi-root package may set metadata to require endpoint L2 |
| **Exit** | Documented; unit test on synthetic gold/gen pair |
| **Status** | **done, 2026-08-08** — `x-lab-l2-mode: endpoint` opt-in metadata, reuses the L1 gold-to-generated node matching already computed (no second matching pass). Default (no metadata) behavior for every existing gold package is unchanged. `coe-lab/scripts/test-endpoint-l2.mjs` — synthetic 2-service/2-database fixture where a wrong-but-same-TYPE generated edge would false-PASS type-multiset L2; proves endpoint mode correctly FAILs (names the exact missing specific pair) AND that stripping the opt-in metadata on the SAME fixture correctly PASSes under default mode — i.e. the two modes genuinely check different things, not just relabel one result. |

### T-L1-5 — Register multi gold in ALL_GOLD + docs

| | |
|---|---|
| **Deliverable** | `validate-calm-pair.mjs` package lists; `gold/calm/README.md` / FINERACT_GOLD.md |
| **Exit** | `--package fineract-charge-provider` (or chosen name) works for gold-only validate |
| **Status** | **done, 2026-08-08** — `fineract-charge-provider` added to `ALL_GOLD`; `FINERACT_GOLD.md` updated with the gold-package table row and an explicit "read this before citing either" note distinguishing it from `fineract-charge`. Verified: `--package fineract-charge-provider --gold-only` and `--all-gold --gold-only` (16 packages) both PASS. |

**Phase L1 exit checklist**

- [x] T-L1-1…T-L1-5 done — see Status rows above, all with real verification (not just written, run)
- [x] Standing exams last-run updated for any real runs performed — `standing-disconfirming-exams.md` gained real protocol-run rows for both `E-charge-single-L2` and `E-charge-multi-story` (previously mechanism-level-only evidence)
- [x] Isolation respected — gold authored from real source (grep-verified file/line), never from `tmp/`/generator output; only `coe-lab/gold/calm/fineract-charge/architecture.calm.json` and `FINERACT_GOLD.md` were read for schema-convention consistency, both explicitly allowed for eval-authoring work per `ISOLATION.md`'s evaluation-agent column — `coe-lab/gold/packages/*.json` was not read

**Phase L1 complete, 2026-08-08. Still no `pipeline/src` changes — L1 was eval-tooling + hand-authored gold only, as scoped. L2 requires the design note (T-L2-0) first and D-terminal-refine recorded before any detector code.**

---

# Phase L2 — Generic store-terminal / intermediate-layer code

**Goal:** Empower layered recovery without sample bias.  
**Depends on:** L0 + L1 complete; **D-terminal-refine** recorded if implementing L2b.

**Do not** require API→entity for charge multi-root (no static import — honest S-layered-access ceiling).

### T-L2-0 — Design note: current detector inventory + policy

| | |
|---|---|
| **Deliverable** | Short design note (e.g. `docs/solution/AREC_Store_Terminal_Policy.md`) or section in R2b addendum |
| **Content** | Document current Phase 1 short-circuit (impl is store → stop); R2b hop; story IDs; decision on L2b refine yes/no |
| **Exit** | Written before T-L2-1 code |
| **Status** | **done, 2026-08-08** — `docs/solution/AREC_Store_Terminal_Policy.md`. Documents the real two-branch mechanism (read from source, not recalled), the S-layered-access/S-layered-domain story mapping, confirms the real flagship case resolves via Phase 1 not R2b, and records **D-terminal-refine = no build this round** (default stands, no owner override recorded) with explicit reasoning + revisit trigger. Written and reviewed before any T-L2-1 code. |

### T-L2-1 — Mechanism IDs / provenance on multi-hop edges (small)

| | |
|---|---|
| **Deliverable** | Multi-hop relationships carry distinguishable provenance (confidence tiers already exist; add optional `source` detail or metadata for `r2-phase1` vs `r2b` if not already readable) |
| **Why** | IR/coverage/exam can assert story grain without name matching |
| **Exit** | Synthetic tests can distinguish mechanism |
| **Status** | **done, 2026-08-08** — additive optional `TypedRelationship.mechanism?: 'r2-phase1' \| 'r2b'` (`types/typed-facts.ts`, no CONTRACT_VERSION bump, same pattern as `confidence`/`grade`), set by both branches of `multi-hop-bridge-detector.ts`, surfaced in CALM as `x-aac-mechanism` (`relationship-builder.ts`). Verified: both synthetic fixtures now assert the field directly (`r2-bridge-sample` → `r2-phase1`, `r2b-implementer-hop-sample` → `r2b`), and the real Fineract flagship test now asserts `mechanism === 'r2-phase1'` — the design note's own claim (§2) that the real case resolves via Phase 1, not R2b, is now a checked assertion, not just prose. |

### T-L2-2 — Access-terminal fixture (generic)

| | |
|---|---|
| **Deliverable** | Synthetic fixture: service → bridge → sole implementer that is **driver/JDBC-style database unit** (not entity) |
| **Assert** | Architecture edge service→implementer (S-layered-access); calm validate 0 errors |
| **Integrity** | No Fineract names |
| **Exit** | Regression test green |
| **Status** | **already satisfied, confirmed 2026-08-08** — the pre-existing `r2-bridge-sample` fixture (`WidgetApiResource`/`WidgetReadServiceImpl`, T-C1) already asserts exactly this shape (service → bridge → sole implementer that IS a database unit). Checked for the integrity bar: "Fineract"/"Charges"/"ChargeRead" appear only in a code comment citing evidence lineage, never in a class/file name the mechanism runs against. No new fixture needed. |

### T-L2-3 — (Optional L2b) Domain-terminal refine

| | |
|---|---|
| **Only if** | D-terminal-refine = yes |
| **Behavior** | When Phase 1 would emit to impl-as-store, **and** impl imports **exactly one** preferred domain-store unit (define grain via evidence: entity decorator / spring-data repo / explicit catalogue flag), emit service→**domain store** (prefer keep access edge or replace — **document choice**; recommend **emit domain as primary architecture terminal**, do not drop if refine ambiguous) |
| **Ambiguity** | 0 domain candidates → keep Phase 1 access terminal; 2+ → keep access terminal (do not guess) |
| **Charge honesty** | Read JDBC impl without entity import → **no** domain refine; access terminal remains correct |
| **Tests** | Synthetic: unique domain import → domain edge; two imports → access only; zero → access only |
| **Second sample** | Prefer second synthetic or non-Fineract shape before claim “domain refine proven” |
| **Exit** | Tests green; Claim Register notes optional grain |
| **Status** | **not built, by design decision (T-L2-0)** — `D-terminal-refine` default stands (no owner override recorded in `standing-disconfirming-exams.md`). See `AREC_Store_Terminal_Policy.md` §3 for the full reasoning: the one real evidenced case resolves via Phase 1, not R2b, so there is no live case to build/verify a refine mechanism against yet. Revisit trigger stated there. |

### T-L2-4 — Noise filter spike (architecture terminals)

| | |
|---|---|
| **Deliverable** | Spike note + optional filter: multi-hop must not terminate on units with **no** persistence/messaging/http-entry evidence (framework-only), **if** generic rule proven on synthetic |
| **Reject** | Name/suffix denylist of `Component` etc. without structural rule |
| **Exit** | Either shipped with test, or spike concludes “not safe / defer” with reason in OOS or backlog |
| **Status** | **spike done, 2026-08-08 — concludes defer, reason recorded** (`AREC_Store_Terminal_Policy.md` §5). Traced every producer that assigns `database`/`topic` kind (`signal-mapper.ts`, `persistence-detector.ts`, `messaging-pass.ts`) — none has a path to that kind without a real matched evidence category first; `service` is the only kind with a bare default. A second filter at the multi-hop layer would be redundant against an already-enforced invariant. Revisit trigger: a future producer that assigns `database`/`topic` without evidence-gating (a regression from the traced invariant) — fix at that producer, not preemptively here. |

### T-L2-5 — Gated multi-root regression (sample)

| | |
|---|---|
| **Deliverable** | Gated test (clone present): multi-root charge+provider has architecture relationship from Charges API unit to access-layer store unit (assert by **kind + path interfaces + grade**, not hardcoded file path if avoidable; file path ok only in **test** as evidence fixture, never in `src/` detectors) |
| **Also** | E-boa-R1 still passes; E-r2-ambiguity still refuses |
| **Exit** | Documented skip when clone absent |
| **Status** | **already satisfied, confirmed 2026-08-08** — the pre-existing gated `Robustness T-R1-3 follow-up` test already asserts this exact shape (real `ChargesApiResource` → `ChargeReadPlatformServiceImpl`, `crossPackage: true`, confidence 10, grade `architecture`, kind `database` on the destination), matches by kind/evidence/grade (never a bare file-path assertion — the one `.endsWith(...)` file-path check lives in the test file, not `pipeline/src`, which is exactly what the rule allows), documents its own skip condition when `fineract-provider` isn't cloned, and now additionally asserts `mechanism === 'r2-phase1'`. **Full suite re-run after all T-L2-1 changes: 56/56 pass, 0 fail** — `E-boa-R1` and the R2-ambiguity-refusal test both directly re-confirmed green in a targeted re-run. |

**Phase L2 exit checklist**

- [x] No sample hardcodes in `pipeline/src` — confirmed via grep: every Fineract/Charges/ChargeRead mention in `pipeline/src` is inside a comment citing evidence lineage, never a literal the detector branches on
- [x] S-layered-access fixture green — `r2-bridge-sample` (T-L2-2, already existed) + real Fineract flagship test, both green, both now also assert `mechanism: 'r2-phase1'`
- [x] Optional L2b only with tests — **not built** (T-L2-3), decision recorded in `AREC_Store_Terminal_Policy.md` §3, no tests needed since no code was written
- [x] Claim Register updated carefully (no single-root L2 PASS claim) — no Claim Register edit was needed this phase; the L1-session correction already stands and L2 added no new claim, only a `mechanism` field and a design-note decision record

**Phase L2 complete, 2026-08-08. `pipeline/src` changed this phase (the first code change in this program): `types/typed-facts.ts` (additive optional field), `analysis/cross_package/multi-hop-bridge-detector.ts` (sets it), `modules/calm-generator/relationship-builder.ts` (surfaces it in CALM). No detector BEHAVIOR change — same edges, same confidence values, same ambiguity refusals; only a new, additive, self-documenting field on edges the mechanism already produced. Full suite 56/56 green before and after.**

---

# Phase L3 — Multi-root operator productization

**Goal:** Pilots know when and how to multi-root; coverage/IR surfaces story mechanism.  
**Depends on:** L1 (and ideally L2).

### T-L3-1 — Operator recipe

| | |
|---|---|
| **Deliverable** | README and/or `Module_Authoring_Guide` / short `docs/solution/Multi_Root_Operator_Recipe.md` |
| **Content** | When single-root S1 fires and monorepo has separate API vs provider modules → multi-root recipe; link multi-root protocol + standing exams; claim triple reminder |
| **Exit** | Linked from README status/gaps |
| **Status** | **done, 2026-08-08** — `docs/solution/Multi_Root_Operator_Recipe.md`. Practical "what do I do" doc: when to reach for multi-root, why single-root structurally can't resolve a cross-module bridge, the exact command, how to read `mechanism`/`relationshipsByMechanism` (T-L2-1/T-L3-2), the claim-triple reminder with a concrete ✅/❌ example, and honest "still unresolved" cases (0/2+ candidates, command-bus, third module not scanned). Linked from README's "Known issues & honest gaps" table (Layered multi-hop row). |

### T-L3-2 — Coverage / IR: R2 mechanism visibility

| | |
|---|---|
| **Deliverable** | coverage-report and/or intelligence-ir: counts or breakdown of architecture multi-hop edges (by confidence tier or mechanism id from T-L2-1) |
| **Exit** | Visible on a multi-root sample run |
| **Status** | **done, 2026-08-08** — additive `CoverageReport.relationshipsByMechanism: Record<string, number>` (`coverage-report.ts`, reads `TypedRelationship.mechanism` generically, no hardcoded mechanism names), surfaced in `intelligence-ir.md`'s coverage appendix. **Real, honest finding while verifying**: an initial exact-count assertion was wrong — the real multi-root Fineract scan resolves 121 `r2-phase1` + 5 `r2b` edges (126 total, not just the 1 flagship edge), and a stricter "buckets must sum to every calls/graphify relationship" assertion was also wrong — R0's own direct reconciler independently emits `kind: 'calls'` for real same-package Graphify edges unrelated to multi-hop, correctly leaving `mechanism` unset (a legitimate third category, not a bug). Both assertions fixed to check real, verified facts (`> 0` for both mechanisms, not a fragile exact/exhaustive count) rather than an incorrect assumption. |

### T-L3-3 — HITL queue handoff (thin)

| | |
|---|---|
| **Deliverable** | Ensure unresolved-multi-hop / S1 items remain actionable via existing `hitl-review-trigger` (no full residual session required) |
| **Optional** | Note in standing exams that residual session (B-review-session) is future L5, not Phase L3 blocker |
| **Exit** | Doc only or small trigger text improvement |
| **Status** | **done, 2026-08-08** — small, real trigger text improvement in `hitl-review-trigger.ts`: S1 review-queue items for a unit that already has a specific, named `unresolved-multi-hop` ignored-item now surface that exact detail (bridge id, candidate count) in the item's `rationale`, instead of a generic "see AREC R2" pointer — no new detection, just reading a fact the run already produced. `B-review-session` explicitly noted as a future option, not a Phase L3 blocker (already true — nothing in L3 depends on it). Verified: real Fineract `fineract-charge`'s `ChargesApiResource.java` S1 item now includes the actual `unresolved-multi-hop: ...` text. |

**Phase L3 exit checklist**

- [x] Operator can follow recipe without reading RCA history — `Multi_Root_Operator_Recipe.md` links the RCA docs only as optional "want the full story" pointers, the recipe itself is self-contained
- [x] Multi-root claims always name root set — the recipe's ✅/❌ example makes this explicit, and it's the same rule already enforced in `Claim_Register.md`'s forbidden/allowed phrases (T-L0-2) and `multi-root-l2-protocol.md`

**Phase L3 complete, 2026-08-08. `pipeline/src` changes this phase: `coverage-report.ts` (additive `relationshipsByMechanism`), `intelligence-ir.ts` (surfaces it), `hitl-review-trigger.ts` (rationale text improvement, no new trigger type). No detector logic changed — same edges, same triggers, just better visibility into what already exists. Full suite 56/56 green.**

---

# Phase L4 — Full exam matrix + close the program

**Goal:** Prove we will not need a third RCA on this class.  
**Depends on:** L0–L3 as scoped.

### T-L4-1 — Run full standing exam matrix

| Exam | Action |
|---|---|
| E-charge-single-L2 | Run expected-fail harness; record last-run |
| E-charge-multi-story | Run multi-root + multi gold / story assert; record last-run |
| E-boa-R1 | Confirm green |
| E-r2-ambiguity | Confirm green |
| E-r2b-positive | Confirm green |
| **Status** | **done, 2026-08-08** — all 5 exams run on genuinely fresh state (fresh `run-slice` re-scans for both Fineract exams, not cached T-L1-era artefacts). `E-charge-single-L2`: `run-expected-fail-exams.mjs` PASS, exit 0. `E-charge-multi-story`: `validate-calm-pair.mjs --require-l2` against real hand-authored gold, `L0/L1/L2` all PASS, exit 0. `E-boa-R1`/`E-r2-ambiguity`/`E-r2b-positive`: full suite 56/56 green. All last-run rows appended (history preserved, nothing overwritten) in `standing-disconfirming-exams.md`. |

### T-L4-2 — Final Claim Register + STATUS + BACKLOG

| | |
|---|---|
| **Deliverable** | R2 cells final wording with claim triples; B-layered-story → `done` or `partial` with residuals listed; STATUS § program row |
| **Forbidden** | Closing B-layered-story if E-charge-single-L2 last-run missing or L1 regressed |
| **Status** | **done, 2026-08-08** — all three split R2 cells carry a program-final confirmation note; `Claim_Register.md` changelog records the close. `BACKLOG.md`'s `B-layered-story` flipped to **`done`** with residuals explicitly listed. **Real find while closing**: `BACKLOG.md`'s own "Pilot readiness" health-note row still had the bare forbidden phrase ("Fineract-charge flagship closed") from before T-L0-2's correction — fixed here, at close, the same drift this whole program exists to catch. Neither forbidden condition triggered (E-charge-single-L2 last-run present; no L1 regression — 56/56 throughout). |

### T-L4-3 — Definition of program done

All must be true:

- [x] Standing exams exist and last-run filled for E-charge-single-L2 + E-charge-multi-story
- [x] Single-root charge: L0/L1 PASS, L2 FAIL **as expected** (automated via `run-expected-fail-exams.mjs`)
- [x] Multi-root access story: asserted green under its own gold/protocol (`fineract-charge-provider` hand-authored gold)
- [x] No detector sample hardcodes (`pipeline/src` grep-checked — Fineract names appear only in comments citing evidence lineage, never in mechanism logic)
- [x] BoA R1 + R2 refusal fixtures green (56/56 full suite)
- [x] Claim language cannot be misread as "single-root gold L2 fixed" — `Claim_Register.md` now explicitly forbids the bare phrase and requires the claim triple
- [x] Explicit residuals listed: command-bus OOS; entity terminal only when static chain; Python implements gap

**Program CLOSED, 2026-08-08. All L0-L4 phases complete. `B-layered-story` → `done` in BACKLOG.md.**

---

## Task ID index (quick)

| ID | Phase | Summary |
|---|---|---|
| T-L0-1 | L0 | Standing disconfirming exams doc |
| T-L0-2 | L0 | Claim Register R2 split |
| T-L0-3 | L0 | Finding retest addendum |
| T-L0-4 | L0 | BACKLOG/STATUS/links |
| T-L1-1 | L1 | Multi-root access-layer hand gold |
| T-L1-2 | L1 | Cross-protocol scoring guard |
| T-L1-3 | L1 | Expected-fail harness |
| T-L1-4 | L1 | Optional endpoint L2 |
| T-L1-5 | L1 | Register multi gold package |
| T-L2-0 | L2 | Store terminal policy design note |
| T-L2-1 | L2 | Mechanism provenance on edges |
| T-L2-2 | L2 | Access-terminal synthetic fixture |
| T-L2-3 | L2b | Optional domain-terminal refine |
| T-L2-4 | L2 | Noise filter spike |
| T-L2-5 | L2 | Gated multi-root regression |
| T-L3-1 | L3 | Operator recipe |
| T-L3-2 | L3 | Coverage/IR R2 visibility |
| T-L3-3 | L3 | HITL handoff note |
| T-L4-1 | L4 | Full exam matrix run |
| T-L4-2 | L4 | Final claims/STATUS |
| T-L4-3 | L4 | Program DoD checklist |

---

## Agent start instructions (copy-paste)

```text
You are implementing Weaver Phase L<N> of docs/solution/AGENT_TASKS_Layered_Architecture_Story.md.

Rules:
1. Phase order is hard — do not start L2 before L0+L1 exit checklists.
2. No sample-repo class/module names in pipeline/src detectors.
3. Do not fabricate edges; do not bootstrap gold from generator CALM.
4. Update standing-disconfirming-exams.md last-run when you run an exam.
5. Update Claim Register + BACKLOG + STATUS on completion.
6. npm test green; never delete expected-fail/honesty tests.
7. Residual LLM session is out of scope unless a task explicitly says so.

Start at the first incomplete task in Phase L0 unless the user names a phase.
```

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | **PROGRAM CLOSED** (T-L4-1 through T-L4-3): full standing exam matrix re-run on genuinely fresh state, all 5 exams PASS, none regressed across the whole L0-L4 program. All three split R2 cells + `BACKLOG.md`'s `B-layered-story` row carry final program-close wording; `B-layered-story` flipped to `done` with residuals explicitly listed (command-bus OOS, static-chain-only entity terminal, Python implements gap — all accepted permanent limitations, not open work). Real find while closing: `BACKLOG.md`'s own health-note row still had the bare forbidden "flagship closed" phrase from before T-L0-2's fix — caught and corrected here, the same drift class this whole program exists to prevent. This is the direct answer to the program's own stated goal: prove a third RCA on this claim-drift class won't be needed. |
| 2026-08-08 | **Phase L3 complete** (T-L3-1 through T-L3-3): `Multi_Root_Operator_Recipe.md` (practical when/how/claim-triple guide, linked from README); `coverage-report.ts`'s additive `relationshipsByMechanism` breakdown (real finding while verifying: an initial exact-count test assertion was wrong — the real multi-root Fineract scan resolves 126 total multi-hop edges across the whole codebase, not just the 1 flagship edge, and R0's own reconciler independently emits unrelated `kind:'calls'` edges that correctly leave `mechanism` unset — both assertions fixed to check real facts, not assumptions); `hitl-review-trigger.ts` now surfaces the specific `unresolved-multi-hop` detail in S1 rationale instead of a generic pointer. No detector logic changed. Full suite 56/56 green. **L4 not started.** |
| 2026-08-08 | **Phase L2 complete** (T-L2-0 through T-L2-5): design note (`AREC_Store_Terminal_Policy.md`) written before any code, per the phase's own hard rule — documents the real two-branch mechanism, records **D-terminal-refine = no build this round** (default stands) with reasoning + revisit trigger, and a T-L2-4 noise-filter spike concluding "defer" (traced every kind-assigning producer, found the invariant already structurally enforced). First `pipeline/src` code change in this whole program: an additive, optional `TypedRelationship.mechanism` field (`'r2-phase1' \| 'r2b'`), no CONTRACT_VERSION bump, no behavior change — same edges, same confidence values, same ambiguity refusals, just self-documenting. T-L2-2 and T-L2-5 were found already satisfied by pre-existing fixtures/tests once checked against their stated bars, not rebuilt. Full suite 56/56 green; targeted re-run confirms the real Fineract flagship case resolves via `r2-phase1` exactly as the design note predicts, now a checked assertion. **L3 not started.** |
| 2026-08-08 | **Phase L1 complete** (T-L1-1 through T-L1-5): hand-authored multi-root gold (`fineract-charge-provider`, real source evidence); root-set/scan-mode refuse-by-default guard in `validate-calm-pair.mjs` (reads the platform's own real `x-aac-package-roots` metadata, not a self-declared flag); expected-fail harness (`run-expected-fail-exams.mjs` + manifest); opt-in endpoint-aware L2 (`x-lab-l2-mode: endpoint`) with a synthetic test proving it catches what type-multiset L2 structurally cannot; gold registered in `ALL_GOLD`. **Real, not simulated verification for both headline exams**: `E-charge-single-L2` ran its exact frozen protocol for the first time (L0/L1 PASS, L2 FAIL, exactly as predicted); `E-charge-multi-story` is now scored against a real hand-authored gold (not only a mechanism-level regression test) — L0/L1/L2 all PASS. No `pipeline/src` changes. **L2 not started.** |
| 2026-08-08 | **Phase L0 complete** (T-L0-1 through T-L0-4): standing exams doc created and seeded from real evidence (regression tests + the original finding doc — one exam, `E-charge-single-L2`, honestly flagged as not yet run under its exact frozen protocol, pending T-L1-3); `Claim_Register.md`'s conflated "flagship closed" R2 row split into three claim-triple-specific cells, correcting a real instance of the exact drift this program exists to prevent; finding doc retest addendum added; BACKLOG/STATUS/multi-root-protocol cross-linked. Docs-only, zero `pipeline/src` changes, per phase scope. **L1 not started — do not begin L2 code.** |
| 2026-08-08 | Initial agent task list from approved layered-architecture-story plan (exam lock first, then eval, then generic terminal code, then multi-root UX, then matrix close) |
