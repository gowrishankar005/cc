# Agent task list — AREC Wave 3 implementation (session-by-session)

**Single source of truth** for implementing the Architecture Relation & Evidence Completeness pillar after Wave 1–2.

**Purpose:** Close Fineract-class story gaps (and related silent-incompleteness failures) as **platform strategies**, not repo patches — while making green runs honest (L0–L5).

**Prerequisites (already done — do not redo):**
- Wave 1 claim honesty — `Claim_Register.md`, `validation-approach-vnext.md`, Fineract finding, probes
- Wave 2 AREC design lock — `Architecture_Relation_Evidence_Completeness.md`
- Wave 3-0 ordered backlog — `AREC_Wave3_Implementation_Backlog.md` (this file **supersedes execution detail**)

**Related (do not fork work):**
| Doc | Role |
|---|---|
| `Claim_Register.md` | What may be called “built” |
| `Architecture_Relation_Evidence_Completeness.md` | R / C / S pillar design |
| `coe-lab/docs/fineract-gold-vs-platform-finding.md` | Why R2 + C-call matter |
| `coe-lab/docs/validation-approach-vnext.md` | L0–L5 pass meaning |
| `coe-lab/docs/trap-gold-backlog.md` | Expected-fail shapes |
| `AGENT_TASKS_Extraction_Enrichment.md` | Pass/catalogue patterns to reuse |
| `Contract_Evolution_Policy.md` | If TypedFacts shape changes |
| `AGENT_TASKS_Master_Sequence_Claim_Honesty_and_AREC.md` | Program order |

---

## 0. How to use this file (mandatory)

### 0.1 Session order — hard, not optional

```
Session A  Honesty substrate (S + R0 + eval labels + L4 + regression shields)
  → Session B  Protect R1 + R2 strategy design/spike (no Fineract hardcode)
  → Session C  R2 multi-hop vertical + Fineract L2 remeasure
  → Session D  C-call (+ optional C-rich) + control remeasure
  → Session E  Ranked remainder (producers, ontology, Dynamo/jOOQ, HITL trigger, …)
```

**Do not start Session C before A is green.**  
**Do not start Session D before A is green** (C-call without silence metrics recreates false confidence on “secure”).  
Session D may run **after B** in parallel with late C only if A is done and product owner prioritizes security first — default is A→B→C→D.

### 0.2 What we are fixing (agent orientation)

| Symptom (learned last session) | Root cause | AREC cell |
|---|---|---|
| Fineract units/routes strong, **0 service→db edges** | Dual-unit Graphify + multi-hop layering (API ↛ entity) | **R2** (+ R0 honesty) |
| Core emits **entity↔entity** `connects` mesh | R0 keeps any dual-unit edge; sold as architecture | **R0** grade/label |
| High `x-aac-confidence` looks “complete” | Confidence = signal certainty, not story completeness | **S** silence |
| Lab “all pass” vs Fineract story fail | L1 unit recall ≠ L2 story; soft comparator | **W3-eval** |
| HTTP APIs have auth in source, no CALM controls | Only `@PreAuthorize` is security-control; call-site ignored | **C-call** |
| Control config weak vs gold | Presence only, no expression/authority | **C-rich** |
| Ghostfolio Node imports were unreachable | Graphify `ref_*` targets (already fixed — **do not regress**) | Shield |
| Controller + Prisma types → dual database | Service-wins on import files (already fixed — **do not regress**) | Shield |
| K8s matched `Transaction.java` | Deployments must match **service** only (already fixed — **do not regress**) | Shield |

### 0.3 Architectural integrity (reject PR if violated)

| Principle | Required | Patch anti-pattern (reject) |
|---|---|---|
| Dual goals | Enrich **TypedFacts**; CALM projects | Logic only in `build-calm.ts` for one edge |
| Catalogue / strategy | YAML/registry row + thin producer | `if (path.includes('ChargesApi'))` |
| Dual-unit R0 | Keep as structural; grade it | Pretend R0 = full architecture |
| R2 | Generic layered strategy | Hardcoded Fineract class names |
| C-call | Catalogue of call signals + extraction | One method name only in builder |
| Determinism | No LLM in core path | Advisory writes TypedFacts |
| Layering | pass / detector / catalogue | 100+ lines in `run-slice.ts` |
| Regression | Fixture or real-repo test | “Works on my package” |
| Honesty | Claim Register + scope-limitations | Fake high confidence / silent empty graph |
| Security | No secret values in artefacts | — |

### 0.4 Every session completion — agent must

1. State **integrity home** (`provider | analysis-pass | catalogue | contract | module | platform-artefact | eval`).  
2. Name **files touched**.  
3. Add/update **regression** (test or eval gate).  
4. Update **Claim_Register** status cells if proven/partial changes.  
5. Update **STATUS.md** + **scope-limitations.yml** when user-visible capability changes.  
6. Re-measure **Fineract** charge and/or core when R2/C-call/S change (commands in §0.6).  
7. Fill the **PR template** (§0.5).  
8. **Not** bootstrap gold from generator.  
9. **Not** mark Fineract L2 green unless Claim Register says R2 (and controls cell) allow it.

### 0.5 PR / agent summary template

```markdown
## AREC session delivery
- Session: <A|B|C|D|E>
- Task IDs: <T-A1, …>
- What we fixed (symptom → root cause → strategy): <1–3 bullets>
- Integrity home: <…>
- Paths: <files>
- Contract bump?: <none | minor | major + policy cite>
- Claim Register cells updated: <ids + new status>
- Regression: <test names>
- Fineract remeasure: <L0/L1/L2 notes or n/a>
- scope-limitations / STATUS: <yes/no>
- Explicitly NOT done (next session): <…>
```

### 0.6 Fineract remeasure (when required)

```bash
# Gold validate (always L0 for gold)
cd pipeline && npx --no-install calm validate -u dist/rules/control-url-mapping.json \
  -a ../coe-lab/gold/calm/fineract-charge/architecture.calm.json

# Platform generate (tmp untracked)
node dist/orchestration/run-slice.js \
  ../spikes/fineract/repo/fineract-charge --out ../tmp/fineract-remeasure/charge
node dist/orchestration/run-slice.js \
  ../spikes/fineract/repo/fineract-core --out ../tmp/fineract-remeasure/core

# Report: service-touching rel count, security-control on HTTP units, calm validate on gen
# Compare to coe-lab/docs/fineract-gold-vs-platform-finding.md baseline
```

Baseline (pre-Wave-3): charge/core **L1 strong**, **L2 story fail** (0 service-touching edges; HTTP controls absent).

### 0.7 Regression shields (must stay green every session that touches related code)

| Test / area | Protects |
|---|---|
| Ghostfolio access slice (ref_prisma + service-wins) | Node import catalogues |
| BoA full k8s deployment correlation (service-only, no Transaction.java) | K8s R-k8s |
| BoA userservice/contacts relationships | R1 one-hop |
| Fineract charge routes + entity; core PreAuthorize | U-http, U-entity, C-dec |
| NestJS fixture | Interface precedence |

---

# Session A — Honesty substrate

**Goal of session:** Make incompleteness **loud** and R0 **honest** before multi-hop work.  
**Why first:** Without this, R2/C-call can ship and operators still misread green runs (last session’s core lesson).

**Session A done when:** S1 (and preferably S2) visible in artefacts; R0 graded or labeled; eval/scoreboard can show L0/L1/L2; scope-limitations align with Claim Register; all regression shields green.

---

### T-A1 — Silence metrics (W3-S / S1 + S2)

| Field | Content |
|---|---|
| **Goal** | Emit machine-readable completeness signals so empty architecture neighborhoods and HTTP-without-control are visible without hand audit. |
| **Why (reason)** | Fineract charge/core produced high-confidence units and **0 service-touching relationships**; schema validate still 0 errors. Threat-signals flags HTTP without `security-control` category but does not replace completeness metrics, and narrative confuses “no category” with “no auth in source” (S3). |
| **What we learned** | Confidence ≠ completeness (`confidence-not-completeness`). L3 invariants S1–S4 in `validation-approach-vnext.md`. |
| **Inputs** | `Architecture_Relation_Evidence_Completeness.md` §5; `typed-facts.ts`; `coverage-report.ts` (already has relationshipsByKind/Source). |
| **Integrity home** | `platform-artefact` + optional thin analysis helper (not calm-generator-only). |
| **Implementation details** | 1) Define metrics on **TypedFacts** (or AnalysisContext → coverage-report): e.g. `serviceTouchingRelationshipCount`, `serviceUnitCount`, `databaseUnitCount`, `httpUnitsWithoutSecurityControlCount`. 2) **S1:** if serviceCount≥1 and databaseCount≥1 and serviceTouchingRelCount===0 → flag in coverage and/or ignored-items / completeness section (do not invent relationships). 3) **S2:** count service units with http-entry-point evidence and no security-control evidence (reuse same definition as threat-signals). 4) Surface in `coverage-report.json` and a short section of `intelligence-ir.md`. 5) Prefer generic field names, not `fineractIncomplete`. |
| **Acceptance** | Fineract-charge remeasure shows S1 active (or equivalent metric = 0 service-touching). Regression: unit test or pipeline test on fixture that has service+db and no edge **or** real Fineract-charge when clone present. Claim Register **S-silence** → partial. |
| **Out of scope** | Implementing R2; changing dual-unit reconciler; auto-adding edges. |
| **Hard predecessors** | None (Session A start). |

---

### T-A2 — R0 structural vs architecture grading (W3-R0)

| Field | Content |
|---|---|
| **Goal** | Stop selling entity↔entity Graphify edges as the same product claim as service→store architecture links. |
| **Why** | Fineract-core typed-facts had **64** relationships, **0** touching a service unit — all database↔database. CALM still emitted `connects` for them. Dual-unit decision: R0 is **structural interim**, not full architecture. |
| **What we learned** | Dual-unit gate is intentional for structural edges; incompleteness is R1/R2 absence, not “Graphify empty.” |
| **Inputs** | Claim Register dual-unit decision; AREC §3; `relationship-builder.ts`; `TypedRelationship`. |
| **Integrity home** | `contract` (if new field) **or** relationship metadata + builder only (if no contract bump). Follow `Contract_Evolution_Policy.md`. |
| **Implementation details** | Choose one design (document in PR): **(A)** optional `grade`/`role` on TypedRelationship: `structural` \| `architecture` \| `trust`; **(B)** metadata on CalmRelationship only. Default: Graphify dual-unit non-service endpoints → structural; service↔database or service↔topic one-hop → architecture; shares-secret → trust. relationship-builder description or metadata must expose grade. Do **not** drop structural edges by default (would lose useful graph); grade them. |
| **Acceptance** | On fineract-core (or fixture), entity–entity edges labeled structural; Claim Register R0 notes grading shipped. Regression asserts metadata/grade presence for at least one non-service edge when BoA/Fineract available. |
| **Out of scope** | R2 multi-hop; deleting all entity–entity edges. |
| **Hard predecessors** | T-A1 recommended same PR or prior (metrics still useful alone). |

---

### T-A3 — Eval layer labels + Fineract expected L2-fail (W3-eval light)

| Field | Content |
|---|---|
| **Goal** | Operators see **which layer** passed; lab L1 green cannot be misread as Fineract L2. |
| **Why** | Last session: validate-calm-pair “ALL PASS” on lab core was L1-style; Fineract hand gold L2 failed. Soft comparator + soft messaging caused false comfort. |
| **Inputs** | `validation-approach-vnext.md`; `validate-calm-pair.mjs`; `scoreboard.mjs`; Fineract gold packages. |
| **Integrity home** | `eval` (coe-lab scripts only). |
| **Implementation details** | 1) Print explicit `L0 schema` / `L1 unit` / `L2 story` lines in validate-calm-pair (and scoreboard if cheap). 2) For packages `fineract-charge`, `fineract-core`: if L2 story fails, exit code policy documented (e.g. non-zero only with `--require-l2`, default report FAIL L2 without failing whole lab core). 3) **Never L2-compare** `fineract-system-map` to class-level generated CALM (incomparable grain) — print N/A. 4) Document in `calm-snapshot-validation.md` / validation-approach. |
| **Acceptance** | Running validate on lab core still useful; Fineract story clearly FAIL L2 or N/A; system-map not false-fail on unit topology. |
| **Out of scope** | Full rewrite of scorer; implementing R2 so L2 passes. |
| **Hard predecessors** | None. |

---

### T-A4 — L4 scope-limitations hygiene

| Field | Content |
|---|---|
| **Goal** | `scope-limitations.yml` matches Claim Register (no stale “messaging not detected” / “OpenAPI not read” when partial capabilities exist). |
| **Why** | Stale limitations re-create the design-phase miss: disclosures lag reality; operators trust wrong boundaries. |
| **Inputs** | `pipeline/src/rules/scope-limitations.yml`; Claim Register; STATUS. |
| **Integrity home** | `catalogue` / rules + metadata-builder consumer. |
| **Implementation details** | Edit limitation texts: messaging **partial** (consumers yes, producers no); OpenAPI **partial** when files present; add explicit bullets for **multi-hop architecture links unbuilt (R2)** and **call-site auth unbuilt (C-call)** if not covered by no-intra-file-logic. Bump catalogue version. Keep permanent confidence-not-completeness. |
| **Acceptance** | Generated CALM metadata limitations match claim cells; version bumped. |
| **Out of scope** | Implementing those capabilities. |
| **Hard predecessors** | None. |

---

### T-A5 — Regression shields verification (no feature work)

| Field | Content |
|---|---|
| **Goal** | Prove post-MVP fixes still hold before AREC coding churn. |
| **Why** | Ghostfolio `ref_` + service-wins and BoA k8s service-only correlation are real, expensive lessons; Wave 3 must not regress them. |
| **Steps** | `cd pipeline && npm test` — all 30+ tests green. If clone missing, note skip and do not delete tests. |
| **Acceptance** | Full suite pass (or documented skips only for missing spikes). |
| **Integrity home** | regression |
| **Out of scope** | New features. |

---

# Session B — Protect R1 + design R2

**Goal of session:** Lock one-hop architecture (BoA-class) and design multi-hop strategy **without** Fineract hardcoding.  
**Why:** R2 must not break R1; R2 must not be a ChargesApi special case.

**Session B done when:** R1 regression asserts L2-style service→db for BoA/lab; written R2 design note in-repo (or AREC § appendix) with algorithm + non-goals; no production R2 code required yet (spike OK).

---

### T-B1 — R1 lock: one-hop service→db (W3-R1)

| Field | Content |
|---|---|
| **Goal** | Make “BoA-class one-hop” a hard regression so R2 work cannot regress the shape that already works. |
| **Why** | Sample bias last session: BoA Python service→AccountDb worked; Fineract layered failed. Product needs **both** samples (Claim Q5). |
| **Inputs** | BoA userservice/contacts; lab py-accounts-api / py-ledger-worker; graphify reconciler. |
| **Integrity home** | `analysis-pass` / regression. |
| **Implementation details** | Strengthen or add regression: at least one **service→database** connects in BoA two-package run and/or lab py-accounts after generate. Assert endpoint kinds, not only relationship count. If R0 grading landed, architecture-grade edges should include that service→db. |
| **Acceptance** | Claim Register R1 stays partial or → proven for one-hop shapes only (wording precise). Test fails if service→db disappears. |
| **Out of scope** | Multi-hop; forcing Fineract to pass R1 incorrectly. |
| **Hard predecessors** | Session A preferred (T-A2 if grades exist). |

---

### T-B2 — R2 strategy design note (spike, generic)

| Field | Content |
|---|---|
| **Goal** | Document how multi-hop architecture relations will be produced **generically** before coding. |
| **Why** | Root cause: intermediates (`ChargeReadPlatformService`, command bus) are **not TypedUnits**, so dual-unit drops API→service→entity paths. Fix is a **strategy class**, not one edge. |
| **What success is not** | “Any new edge appears”; entity→entity already abundant. Success = **service (or HTTP unit) → database (or persistence unit)** architecture-grade link consistent with gold intent. |
| **What success is not (cross-package)** | Charge entity → PaymentType import is not the interesting PlatformSecurityContext story unless we expand unit set intentionally. |
| **Inputs** | Fineract finding RCA; AREC §3 R2; graphify-reconciler; optional scip/CodeQL Phase 2 only as future power. |
| **Integrity home** | docs + optional spike under `docs/solution/` or `docs/spikes/`. |
| **Implementation details** | Write `docs/solution/AREC_R2_MultiHop_Strategy.md` covering: (1) candidates for architecture endpoints (service units with HTTP or application stereotype — **catalogue-driven**, not name lists); (2) how to use Graphify paths of length 2..N through non-unit nodes **or** promote selected intermediate types via catalogue; (3) confidence caps (architecture multi-hop ≤ one-hop); (4) false-positive controls; (5) Phase 1 source-only vs Phase 2 build-dependent; (6) forbidden hardcodes. Optional spike code behind a flag, not default-on. |
| **Acceptance** | Design note merged; product owner can approve Session C. No default pipeline behavior change required. |
| **Out of scope** | Full R2 production ship (Session C). |
| **Hard predecessors** | T-A1, T-A2 recommended. |

---

# Session C — R2 multi-hop vertical

**Goal of session:** Ship generic R2 producer; remeasure Fineract L2.  
**Why:** Primary Fineract story gap.

**Session C done when:** R2 on by default or documented flag; fineract-charge (and ideally core) show **architecture-grade service→db** toward gold or documented residual; regressions + shields green; Claim Register R2 updated.

---

### T-C1 — Implement R2 multi-hop strategy (generic)

| Field | Content |
|---|---|
| **Goal** | Produce architecture-grade TypedRelationships for layered codebases without dual-unit one-hop. |
| **Why** | ChargesApiResource does not import Charge; Graphify has no one-hop; intermediates not units → typed-facts relationships []. Gold expects service→db. |
| **Inputs** | T-B2 design note; `pass-registry` / new pass; GraphifyRun; existing unitsByRoot. |
| **Integrity home** | `analysis-pass` + optional catalogue YAML. |
| **Implementation details** | Follow T-B2. Prefer: new pass after reconcile (or extend reconciler carefully) that only **adds** architecture-grade edges, does not remove R0. Catalogue for “layer types” or path rules if needed. Wire in `passes.ts`. Confidence lower than direct R1. Emit grade=architecture if T-A2 exists. **Reject** PR with Fineract-only class allowlists. |
| **Acceptance** | fineract-charge: ≥1 architecture service→database edge aligning with Charges API ↔ Charge **or** honest residual + issue if design proves insufficient. npm test green. Claim Register R2 → partial (or proven if both charge+core meet bar). |
| **Out of scope** | C-call; full monorepo all modules; scip-java mandatory. |
| **Hard predecessors** | T-B2; Session A (T-A1 at minimum). |
| **Remeasure** | §0.6 charge + core. |

---

### T-C2 — Fineract L2 eval gate update

| Field | Content |
|---|---|
| **Goal** | Eval reflects new R2 capability; expected-fail only for true residual. |
| **Why** | Trap T1 and hand gold exist to measure story, not to stay red forever after R2. |
| **Integrity home** | `eval` |
| **Implementation details** | Update validate-calm-pair / docs: if R2 ships, fineract-charge L2 may pass or partial; document which gold edges are required. Do not weaken gold to match weak R2. |
| **Acceptance** | Finding doc or BASELINES updated with new numbers. |
| **Hard predecessors** | T-C1. |

---

# Session D — Call-site controls

**Goal of session:** Capture call-based auth evidence as security-control (C-call); optional richness.  
**Why:** Fineract HTTP uses `validateHasReadPermission`; lab jwt-gateway uses `jwt.decode`; C-dec only covers DatatableWriteService-style `@PreAuthorize`.

**Session D done when:** Catalogue + extraction for call-site family; Fineract HTTP and/or jwt-gateway show security-control evidence or explicit residual; threat narrative docs honest; shields green.

---

### T-D1 — C-call strategy (call-site auth)

| Field | Content |
|---|---|
| **Goal** | Detect call-site auth/permission patterns and attach security-control evidence (then control-builder). |
| **Why** | v0.10 specified two mechanisms; only decorator built. Probes: fineract-core validateHas* ≫ PreAuthorize on HTTP surface. Threat-signals “no security-control” is category-true but source-false for those APIs. |
| **Inputs** | signal-catalogue / control-requirement-catalogue; codegraph extractFromSource (may need call/reference kind — if only decorates exists, document new extraction path honestly); lab `py-jwt-gateway`; Fineract ChargesApiResource. |
| **Integrity home** | `catalogue` + `scanner`/`analysis-pass` + control-builder path. |
| **Implementation details** | 1) Catalogue rows for call signals (e.g. validateHasReadPermission, validateHasPermission, jwt.decode) with category security-control, open/extensible. 2) Extraction mechanism that attributes calls to the enclosing unit/file (not a Fineract-only list). 3) control-builder already maps security-control evidence — extend control-requirement-catalogue if new control ids needed. 4) Confidence: call-site ≤ decorator unless corroborated. 5) Update S2 metrics to count new evidence. 6) scope-limitations: remove or narrow “auth checks not as decorator” where C-call now covers listed patterns. |
| **Acceptance** | At least one real Fineract HTTP unit **or** jwt-gateway gains security-control evidence. Regression test (fixture or clone-gated). Claim Register C-call → partial. |
| **Out of scope** | Full OAuth2 product; inventing auth where none exists. |
| **Hard predecessors** | Session A (T-A1 S2 definition). T-C1 not required. |
| **Remeasure** | Fineract charge HTTP units; lab jwt-gateway. |

---

### T-D2 — C-rich control payload (optional same session if cheap)

| Field | Content |
|---|---|
| **Goal** | Include expression/authority snippet in control config when available. |
| **Why** | Hand gold RBAC had richer config than gen (presence + line only). |
| **Implementation details** | Extend control-builder config from decorator argument or call argument string when extractable; still placeholder requirement-url + `-u` mapping. |
| **Acceptance** | At least one control requirement config includes non-empty expression or authority field. |
| **Out of scope** | Hosting real requirement schemas. |
| **Hard predecessors** | T-D1 or existing C-dec path. |

---

### T-D3 — Threat-signals narrative honesty (S3)

| Field | Content |
|---|---|
| **Goal** | Threat report rationale must not imply “no authentication in source” when only pipeline categories are empty. |
| **Why** | Last session RCA: category absence ≠ source absence. |
| **Implementation details** | Soften rationale string; point to C-call status / scope-limitations. |
| **Acceptance** | Wording review in threat-signals module. |
| **Hard predecessors** | None (can ship with T-D1). |

---

# Session E — Ranked remainder

**Goal of session:** Clear secondary cells without derailing R2/C-call.  
**Why:** Probes ranked producers, ontology, Dynamo, Spring Data, OpenAPI dual unit, HITL trigger.

Do **not** start E as a substitute for A–D. Pick tasks by product priority.

---

### T-E1 — Messaging producers (U-msg-producer)

| Field | Content |
|---|---|
| **Goal** | Detect producer-side messaging (KafkaTemplate.send / SQS send) as catalogue strategy. |
| **Why** | Consumers partial; producers named unbuilt; lab kafka + Fineract evidence. |
| **Integrity home** | catalogue + pass |
| **Acceptance** | Trap T6 addressed or OOS explicit; Claim cell update. |
| **Out of scope** | Full AsyncAPI. |

---

### T-E2 — Persistence ontology (Prisma Service vs database)

| Field | Content |
|---|---|
| **Goal** | Decide and implement whether import-of-ORM in an application `*Service` is `database` or service-with-persist evidence. |
| **Why** | Ghostfolio: detection fixed; modelling may over-count databases (Q13). |
| **Integrity home** | catalogue / unit kind policy |
| **Acceptance** | Decision recorded in Claim Register; code matches; Ghostfolio regression still green. |

---

### T-E3 — Dynamo / SQS / Spring Data / jOOQ (as ranked)

| Field | Content |
|---|---|
| **Goal** | Dispatch existing catalogue strategies or mark OOS with gates. |
| **Why** | Lab ts-orders-dynamo L1 weak; persistence catalogue not-implemented rows. |
| **Acceptance** | Claim cells updated; trap T7 addressed or OOS. |

---

### T-E4 — OpenAPI dual-unit / C-contract expand

| Field | Content |
|---|---|
| **Goal** | Merge or ignore policy for openapi.yaml dual service; expand securitySchemes when present. |
| **Why** | Lab nestjs openapi FP ignore; C-contract partial. |
| **Acceptance** | T8 policy automated or documented. |

---

### T-E5 — HITL empty-neighborhood advisory trigger (post S)

| Field | Content |
|---|---|
| **Goal** | After T-A1 metrics exist, optional IR/advisory trigger for S1 failures. |
| **Why** | review-flow-capability-map decision: recommend trigger; advisory must not write TypedFacts. |
| **Hard predecessors** | T-A1. |
| **Acceptance** | Design or thin offline tool; no core-path LLM. |

---

### T-E6 — K8s substring residual watch

| Field | Content |
|---|---|
| **Goal** | Only if new false positives appear; tighten correlation without name denylists. |
| **Why** | Bidirectional substring residual risk noted in review; service-kind filter already fixed Transaction.java. |

---

# Dependency matrix (agents must refuse out-of-order)

| Task | Hard predecessors |
|---|---|
| T-A* | None |
| T-B1 | T-A2 preferred |
| T-B2 | T-A1 recommended |
| T-C1 | T-B2, T-A1 |
| T-C2 | T-C1 |
| T-D1 | T-A1 |
| T-D2 | T-D1 or C-dec path |
| T-E5 | T-A1 |
| T-E* others | Session A done recommended |

---

# Definition of Wave 3 program done

- [ ] S1/S2 visible on Fineract-class runs  
- [ ] R0 graded/labeled  
- [ ] Eval distinguishes L0/L1/L2; system-map N/A  
- [ ] scope-limitations match Claim Register  
- [ ] R1 locked by regression  
- [ ] R2 strategy shipped or residual documented with Claim R2 status honest  
- [ ] C-call partial+ on real sample  
- [ ] Regression shields still green  
- [ ] No Fineract-only hardcode patches  

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial session A–E agent task list from revised plan + last-session learning capture review |
