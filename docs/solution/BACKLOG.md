# Weaver — product backlog (thin index)

**Purpose:** One place to see **what is left to build**, without duplicating full task specs.  
**Product:** **Weaver** (Architecture-as-Code → CALM). Evidence repos are samples, not the product.

| This file is | This file is not |
|---|---|
| Ordered index of pending/planned work | Full implementation instructions |
| Status snapshot of open items | Capability matrix (that’s STATUS) |
| Links to the doc that owns detail | Claim authority (that’s Claim Register) |

**Update rule:** When an item ships → `done` (or remove) + update **STATUS** + **Claim Register**. Add one row here when work is accepted onto the queue.

---

## How to use

| Need | File |
|---|---|
| **What’s left (this index)** | **This file** |
| **Next iteration focus** | [`NEXT_ITERATION.md`](./NEXT_ITERATION.md) |
| **Robustness program (phased agent tasks)** | [`AGENT_TASKS_Weaver_Robustness.md`](./AGENT_TASKS_Weaver_Robustness.md) |
| **Layered architecture story (exam lock + multi-root)** | [`AGENT_TASKS_Layered_Architecture_Story.md`](./AGENT_TASKS_Layered_Architecture_Story.md) — **start here for intermediate-layer / Fineract gold class work** |
| **Wave 3 Session E (breadth)** | [`AGENT_TASKS_AREC_Wave3_Implementation.md`](./AGENT_TASKS_AREC_Wave3_Implementation.md) |
| **What’s built vs partial** | [`STATUS.md`](./STATUS.md) |
| **What we may claim** | [`Claim_Register.md`](./Claim_Register.md) |
| **Eval traps** | [`../../coe-lab/docs/trap-gold-backlog.md`](../../coe-lab/docs/trap-gold-backlog.md) |
| **Architect residual review session** | [`Architect_Residual_Review_Session.md`](./Architect_Residual_Review_Session.md) · agent tasks [`AGENT_TASKS_Residual_Review_Session.md`](./AGENT_TASKS_Residual_Review_Session.md) (**RS-0 signed off — Gowri**) |
| **Pilot-ready scorecard** | [`Pilot_Ready_Scorecard.md`](./Pilot_Ready_Scorecard.md) |
| **Standing OOS registry** | [`OOS_Registry.md`](./OOS_Registry.md) |
| **Multi-root L2 protocol** | [`../../coe-lab/docs/multi-root-l2-protocol.md`](../../coe-lab/docs/multi-root-l2-protocol.md) |
| **Fidelity yardstick close-out** | [`Fidelity_Yardstick_Closeout_Matrix.md`](./Fidelity_Yardstick_Closeout_Matrix.md) · agent tasks [`AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md`](./AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md) |
| **Tier-1 multi-org stack expansion** | [`Fintech_Tier1_Stack_Expansion_Research.md`](./Fintech_Tier1_Stack_Expansion_Research.md) — MS/Citi/JPMC-class gaps beyond Fidelity close-out |
| **Bank stacks + competitor deep dive** | [`../spikes/Tier1_Bank_Stacks_and_Semantic_Analysis_Competitors_Research.md`](../spikes/Tier1_Bank_Stacks_and_Semantic_Analysis_Competitors_Research.md) — dual-estate keywords + Moderne Prethink / semantic tools |
| **Weaver Discovery Ladder (WDL)** | Prioritized discovery queue — [`WHERE_NEXT.md`](./WHERE_NEXT.md) §2.1. **Implement plan:** [`WDL_Implementation_Plan.md`](./WDL_Implementation_Plan.md) Phase I = WDL-1/2 (after hard-tests #2–#3). |

---

## Now / next (active)

| ID | Item | Status | Detail |
|---|---|---|---|
| **E** | AREC Session E (breadth) | `done` (2026-08-08) | [T-E1…T-E6](./AGENT_TASKS_AREC_Wave3_Implementation.md) all shipped (T-E0 correctly skipped — C-rich already landed in D) |
| **RB** | Weaver robustness program (phased) | `done` (2026-08-08) — Phases R0–R4 all complete, MVP checklist 13/13 | [AGENT_TASKS_Weaver_Robustness.md](./AGENT_TASKS_Weaver_Robustness.md); reviewed + suite **55/55** green |
| **W3-close** | Close Wave 3 checklist / OOS decisions | `done` | AREC Wave 3 DoD — all checkboxes closed, Sessions A–E complete |
| **P1-next** | Ontology + SQS/SNS producers | `done` (2026-08-08) | **B-ontology**, **B-msg-prod-sqs** — both closed with real evidence, see rows below |
| **UX-next** | Architect residual review session | `doing` — **RS-0 done**, implement **RS-1** | Owner **Gowri**; [`AGENT_TASKS_Residual_Review_Session.md`](./AGENT_TASKS_Residual_Review_Session.md). **Do not skip safety.** |
| **P1-serverless** | Fidelity yardstick + serverless HTTP + Dynamo handler ontology | **`done` — Y0-Y6 program CLOSED, 2026-08-08** | **Authority:** [`Fidelity_Yardstick_Closeout_Matrix.md`](./Fidelity_Yardstick_Closeout_Matrix.md). **Agent tasks:** [`AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md`](./AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md) (phases Y0–Y6, all done). Program DoD met: real repo win (`aws-saas-boost-tier-service`, 5/5 paths exact match to gold), new S5 completeness flag (HT-ASB-006 class closed), full matrix sweep (no row left "named only" for Lambda), both standing exams re-confirmed fresh, 59/59 suite green. **Residuals carried forward, not swept in**: Node/Python Lambda handlers, SAM `Events:` shorthand, cross-stack CFN refs all deferred (no sample yet); only one real evidenced CFN-authoring style (`aws-saas-boost`) — a second real repo would strengthen generalization. `T-Y6-2` (Kinesis/OAuth2 stubs) explicitly skipped, owner-request gate not met. |
| **L-story** | Layered architecture story program (exam lock → eval → store-terminal → multi-root UX) | **`done` — L0-L4 program CLOSED, 2026-08-08** | [`AGENT_TASKS_Layered_Architecture_Story.md`](./AGENT_TASKS_Layered_Architecture_Story.md) + [`standing-disconfirming-exams.md`](../../coe-lab/docs/standing-disconfirming-exams.md) + [`AREC_Store_Terminal_Policy.md`](./AREC_Store_Terminal_Policy.md) + [`Multi_Root_Operator_Recipe.md`](./Multi_Root_Operator_Recipe.md). **B-layered-story**. Full exam matrix re-confirmed on fresh state, no regressions. Residuals accepted as permanent (command-bus OOS, static-chain-only entity terminals, Python implements gap) — see T-L4-3 in the task file. |

### Recently landed (Wave 3 A–D) — do not re-queue

| Item | Status |
|---|---|
| Silence S1/S2 + coverage completeness | `done` |
| R0 relationship grading | `done` |
| Eval L0/L1/L2 labels | `done` |
| R1 one-hop regression lock | `done` |
| R2 multi-hop **mechanism** (non-fabricating) | `done` — **product residual** → **B-R2b** |
| C-call (bounded vocab) + C-rich (expression text) | `done` — expand → **B-C-call-expand** / **B-C-rich-authority** |

### Recently landed (Wave 3 E) — do not re-queue

| Item | Status |
|---|---|
| Messaging producers (KafkaTemplate field-type + SQS/SNS import-only) | `done` — T-E1 + **B-msg-prod-sqs** (T-R3-2 follow-up) |
| Persistence ontology decision + fix (Prisma Service vs database) | `done` — decided (Q13, T-E2) AND code-fixed (**B-ontology**, T-R3-2 follow-up) |
| Spring Data repository dispatch | `done` — T-E3 |
| DynamoDB verified | `done` — T-E3 |
| jOOQ | `done` (T-R1-3) — root cause fixed, 229 real database units verified against real Waltz `waltz-data` |
| OpenAPI dual-unit merge (trap T8) + C-contract expand | `done` — T-E4, trap promoted |
| HITL review trigger (offline, S1/S2 → review-queue.json) | `done` — T-E5 |
| K8s substring residual | `done` — watched under harder conditions, confirmed clean, no fix needed (T-E6) |

---

## Robustness track (must stay first-class)

These exist so Weaver stays honest under enterprise monorepos — not optional polish.

| ID | Item | Status | Why | Spec |
|---|---|---|---|---|
| **B-R2b** | R2 extension: sole implementer → **imported** DB/topic unit (impl need not be the entity) | `done` (T-R1-2) | Phase-1 R2 residual: real layered services rarely make the implementer itself `@Entity` | [`AREC_R2b_Implementer_Store_Hop.md`](./AREC_R2b_Implementer_Store_Hop.md); real evidence: 11 new relationships in `fineract-provider`, 3 more in `fineract-core` |
| **B-charge-jdbc-driver** | Spring-JDBC driver-import catalogue row (`org.springframework.jdbc.core`) + Java symbol-vs-package fix, combined | `done` (T-R1-3) | **Closes the flagship Fineract residual named since requirements v0.9.** Real, verified: `ChargeReadPlatformServiceImpl` now a real `database` unit; `ChargesApiResource → ChargeReadPlatformServiceImpl` real, `calm validate`-clean, confidence-10 cross-root relationship in a real `fineract-charge`+`fineract-provider` run | `persistence-detection-catalogue.yml`'s `org.springframework.jdbc.core` row |
| **B-arch-cov** | Architecture coverage metric + gate (% services with architecture-grade outbound when store units exist) | `done` (T-R0-2) | S1 is binary; need ongoing quality signal, not only empty/non-empty | `coverage-report.ts`'s `architectureOutboundCoverage` |
| **B-pilot-scorecard** | Pilot-ready scorecard (which claim cells must be proven/partial) | `done` (T-R0-1) | Enterprise readiness: no single success metric | `Pilot_Ready_Scorecard.md` |
| **B-R2-eval** | Labeled multi-root L2 remeasure protocol | `done` (T-R0-3) | Q11; single-root ≠ multi-root claims | `coe-lab/docs/multi-root-l2-protocol.md` |
| **B-oos-registry** | Standing OOS registry (command-bus, Helm, …) | `done` (T-R0-4) | Permanent non-goals must not vanish | `OOS_Registry.md` |
| **B-catalogue-intake** | Catalogue intake rule (evidence + test + claim cell) for new rows | `done` (T-R2-1) | Vocab growth without one-offs | [`Catalogue_Intake.md`](./Catalogue_Intake.md) |
| **B-discovery-cadence** | Scheduled stratified sampling (not one-shot) | `done` (T-R3-1/T-R3-2/T-R3-4) | Avoid overfitting last pain | `coe-lab/docs/pattern-coverage-matrix.md` Wave R3-1 + cadence policy in this file's health note |
| **B-graphify-partial** | Operator visibility when Graphify fail-soft / partial backbone | `done` (T-R0-5) | Completeness UX under tool failure | S0 silence flag in `coverage-report.ts` |
| **B-java-driver-ref** | Graphify Java import target normalize (symbol vs qualified package) | `done` (T-R1-3) | Silent catalogue miss class | `java-import-resolver.ts`; real evidence: `org.postgresql` (Fineract), `org.jooq` (229 real Waltz units), `org.springframework.jdbc.core` (closes flagship residual, see **B-charge-jdbc-driver**) |
| **B-trap-promote** | Trap-gold → automated eval/CI gates | `done` (T-R3-3) | Docs-only traps don’t enforce honesty | `coe-lab/docs/trap-gold-backlog.md`; 7/8 traps promoted |
| **B-hitl-s1** | HITL/advisory path when S1 fires (offline; no TypedFacts write) | `done` (T-E5 + T-R4-1) | Residual human path | Robustness Phase R4 — `hitl-review-trigger.js`. T-R4-1 closed a real gap: the task's own original goal named "S1 fires OR arch coverage below threshold," but only S1/S2 were ever wired in until T-R4-1 added a `low-architecture-coverage` trigger (real evidence: Fineract `fineract-security`, 17% coverage, S1 does not fire, 5 real services flagged) |

---

## Open product backlog (by priority)

Statuses: `todo` · `partial` · `doing` · `oos` · `done`

### P1 — Architecture stories & security depth

| ID | Item | Status | Spec / claim |
|---|---|---|---|
| **B-R2b** | (see robustness) | `done` (T-R1-2) | Claim **R2** |
| **B-R2-eval** | (see robustness) | `done` (T-R0-3) | Q11 |
| **B-C-call-expand** | Expand call-site control vocabularies | `done` (T-R2-2) | Claim **C-call**; real evidence: Waltz `hasRole` (security-rbac-003), Fineract `isAuthenticated` (security-auth-002) |
| **B-C-rich-authority** | Richer control config (structured authority) | `done` (T-R2-3) | Claim **C-rich**; new `authorityRef` field, `control-builder.ts` |
| **B-S3** | Threat narrative honesty | `done` | T-D3 |
| **B-ontology** | Persist ontology (ORM import ≠ always database) | `done` (2026-08-08) | **U-persist-import**; T-E2 (Q13) decided it, this round code-fixed it. Real, verified: new `ownerBaseClass` catalogue field (`persistence-detection-catalogue.yml`) + `class-ownership-resolver.ts` — a matched library can now require the class to itself `extends <ownerBaseClass>`, not just import. Real Ghostfolio re-run: `AccessService` (imports Prisma types only) now correctly produces ZERO database units (was wrongly 1 of the old 87); `PrismaService` (genuinely `extends PrismaClient`) still correctly does, exactly 1 unit. **Real finding that falsified Q13's own proposed fix before it was implemented**: Graphify emits NO `inherits` edge when the base class is external (confirmed: `PrismaClient` has zero in-repo node to target) — ownership had to be verified via a bounded, multi-line-aware source read-back instead of a graph edge. Scoped narrowly to `@prisma/client` only (the one library with real evidence); every other driver-import library is unchanged, per Q13's own explicit deferral. |
| **B-msg-prod-sqs** | SQS/SNS messaging **producer** detection (distinct from the already-done Kafka field-type producer and from DynamoDB persistence) | `done` (2026-08-08) | **U-msg-producer**. Real fix, not just a new catalogue row (the SQS/SNS import-only strategy already existed, `evidenceLevel: unverified`) — the real gap was `messaging-pass.ts` silently DROPPING messaging evidence for any file already claimed by an earlier pass (T-E3's own fix for a duplicate-unique-id bug, at the cost of losing real evidence). Fixed: messaging evidence for an already-typed unit now MERGES onto it instead of being dropped or duplicated. Real evidence: lab `ts-orders-dynamo`'s `OrdersDynamoStore` (imports BOTH `@aws-sdk/client-dynamodb` and `@aws-sdk/client-sqs`) now carries BOTH persistence and messaging evidence on one `database`-kind unit (persistence still wins the kind tie, unchanged precedent), `calm validate` 0 errors. `@aws-sdk/client-sqs` promoted `unverified` → `verified`. |
| **B-lambda-http** | **Serverless HTTP as first-class entry** (Fidelity cloud): detect Lambda / API Gateway **handlers as `service`** + recover HTTP paths from infra (CFN/SAM/Serverless) and/or OpenAPI — **not** via CodeGraph route resolvers alone | `done` **for Java+explicit-CFN shape**, residuals listed, 2026-08-08 | Claim **U-http-serverless** `partial → proven` for this shape. Matrix rows **FY-http-lambda**, **FY-infra-cfn** (G-FY-01 closed with residual). `implements RequestHandler` → real `service` unit + real CFN Path/Method/Handler join (`cfn-manifest-provider.ts`) — verified on real `aws-saas-boost-tier-service`, re-confirmed fresh at Y5 close (5/5 real paths exact match to gold, real architecture edge). **Real residuals, not silently dropped**: Node/Python handlers and SAM `Events:` shorthand (no sample yet, different shape); cross-stack/nested-stack CFN refs (out of v1 scope); only 5/26 real CFN bindings in SaaS Boost's shared template dir bound to this scan's roots (rest belong to other services, correctly left unresolved). New S5 completeness flag closes the HT-ASB-006 completeness gap this item also named. |
| **B-dynamo-handler-kind** | **Java Dynamo import ≠ store owner** when class is a Lambda/API handler (extends Prisma-style ownership discipline to AWS SDK client imports) | `done`, 2026-08-08 | Claim **U-persist-import**. Matrix **FY-db-dynamo**. **Real finding: zero new code needed** — the existing `existingServiceFilePaths` exclusion (built for B-ontology) already worked correctly once Y3 supplied the missing entry-point evidence to compete with the bare Dynamo import. Verified on real fixture + locked regression test. HT-ASB-002/005 closed. |
| **B-kinesis** | Kinesis stream detection (Fidelity AWS list) | `todo` P3 / unevidenced | Matrix **FY-msg-kinesis** G-FY-04 — no code until sample + catalogue intake |
| **B-oauth2-import** | Deeper OAuth2 library import / config evidence (beyond OpenAPI schemes) | `todo` P2 | Matrix **FY-ctrl-oauth2** G-FY-05 |

### P2 — Breadth (Session E + catalogue debt)

| ID | Item | Status | Spec / claim |
|---|---|---|---|
| **B-msg-prod** | Messaging **producers** | `done` (Kafka field-type + SQS/SNS, see **B-msg-prod-sqs** in P1) | **U-msg-producer**; T-E1 |
| **B-ontology** | Persist ontology (ORM import ≠ always database) | `done` — see **B-ontology** in P1 for the real fix | **U-persist-import**; T-E2 (Q13) |
| **B-spring-data** | Spring Data repository dispatch | `done` | T-E3 |
| **B-jooq** | jOOQ strategy dispatch | `done` (T-R1-3) | T-E3; real evidence: 229 database units, real Waltz `waltz-data` |
| **B-dynamo-sqs** | Dynamo / SQS architecture units | `done` **for data + queue import only** — DynamoDB verified; SQS/SNS producer closed (**B-msg-prod-sqs**). **Does not** cover Lambda/API Gateway HTTP entry — that was the silent hole; see **B-lambda-http** / **B-dynamo-handler-kind** (P1) | T-E3 |
| **B-openapi-dual** | OpenAPI dual-unit policy | `done` | T-E4 |
| **B-c-contract** | OpenAPI securitySchemes expand | `done`, expanded | **C-contract** |
| **B-java-driver-ref** | (see robustness) | `done` (T-R1-3) | R2 notes |

### P1b — Layered story (exam lock program)

| ID | Item | Status | Spec |
|---|---|---|---|
| **B-layered-story** | Intermediate-layer / multi-root story productization + standing exams (no more RCA on charge gold class) | **`done` — L0-L4 program CLOSED (T-L0-1…T-L4-3), 2026-08-08** | [`AGENT_TASKS_Layered_Architecture_Story.md`](./AGENT_TASKS_Layered_Architecture_Story.md) + [`standing-disconfirming-exams.md`](../../coe-lab/docs/standing-disconfirming-exams.md) + [`AREC_Store_Terminal_Policy.md`](./AREC_Store_Terminal_Policy.md) + [`Multi_Root_Operator_Recipe.md`](./Multi_Root_Operator_Recipe.md). Phases: L0 exam lock ✅ → L1 eval dual gold ✅ → L2 generic terminal code ✅ → L3 multi-root UX ✅ → L4 matrix close ✅. Claim Register R2 row split (T-L0-2), both split cells re-confirmed fresh at close (T-L4-1). **Both headline exams real, not mechanism-level-only, re-run on fresh state at program close**: E-charge-single-L2 (L0/L1 PASS, L2 FAIL, exact protocol, automated) and E-charge-multi-story (L0/L1/L2 all PASS, real hand-authored gold `fineract-charge-provider`). L2: additive `mechanism` field, D-terminal-refine decided "no build" (reasoned, revisitable). L3: operator recipe + `relationshipsByMechanism` breakdown + HITL rationale improvement. Zero detector behavior change across L2+L3. Full 56/56 suite green at every phase boundary, including the final close. **Accepted permanent residuals** (not open work): command-bus/dynamic-dispatch write paths (OOS), entity terminal only recoverable with a real static import chain (Fineract's flagship case has none — architectural fact, not a gap), Python-shaped bridges (no structural `implements` edge to chase). |
| **B-http-client** | Outbound HTTP client catalogue gap (WDL rank 7, `D-outbound-java`) — `outbound-http-detector.ts`/`outboundHttpPass` already built and live; `OkHttpClient`/`HttpURLConnection` missing from `http-client-detection-catalogue.yml`'s library list | `todo` — **found via WDL review 2026-08-08, small + cheap, not built** | Real evidence: Fineract's `ExternalCreditBureauIntegrationWritePlatformServiceImpl.java` (`fineract-provider`) uses real `OkHttpClient`/`HttpURLConnection`; verified by scan — both currently fall through as generic unmapped signals, not even reaching the detector's own unresolved-target bucket. Claim **U-outbound-http** (new cell). Not a new detector — 2 catalogue rows on an already-dispatched mechanism, same shape as every other `Catalogue_Intake.md`-satisfied fix this session. **Corrects `WHERE_NEXT.md`'s WDL rank 7**, which mislabeled this a `gap` (mechanism doesn't exist) when it's actually `partial` (mechanism exists, 2 libraries missing). |
| **B-multihop-direct-delegate** | R2/R2b bridge discovery misses a real, generic pattern: a bridge candidate with **no `implements` edge at all** (a concrete `@Service` class referenced directly, no interface — common real Spring idiom) that itself directly imports exactly one store | `todo` — **found via post-close genericity probe, not built** | [`coe-lab/docs/findings/waltz-multihop-genericity-probe.md`](../../coe-lab/docs/findings/waltz-multihop-genericity-probe.md). Real evidence: fresh full-clone `finos/waltz`, 28 real candidates, 0 fabricated (discipline held), 0 resolved (coverage gap). Tentative mechanism name "R2c" / direct-delegate hop — same never-guess discipline as R2/R2b, entered without an `implements` edge. See `AREC_Store_Terminal_Policy.md` §3.1. |

### P3 — Eval, discovery, residual UX

| ID | Item | Status | Spec |
|---|---|---|---|
| **B-discovery-cadence** | (see robustness) | `done` (T-R3-1/T-R3-2/T-R3-4) | Phase R3 |
| **B-trap-promote** | (see robustness) | `done` (T-R3-3) | Phase R3 |
| **B-hitl-s1** | HITL empty-neighborhood queue (`hitl-review-trigger`) | `done` (T-E5 + T-R4-1) | Phase R4 — queue only, both original triggers (S1/S2 + low-architecture-coverage) now wired; not full residual UX, see **B-review-session** |
| **B-review-session** | Architect-friendly residual session (session pack + VS Code Copilot Chat; Tier A human choice cards / Tier B evidenced LLM drafts → DR+Override only) | `doing` — **RS-0 signed off (Gowri, 2026-08-08)**; next **RS-1** | Design: [`Architect_Residual_Review_Session.md`](./Architect_Residual_Review_Session.md). **Agent tasks:** [`AGENT_TASKS_Residual_Review_Session.md`](./AGENT_TASKS_Residual_Review_Session.md) (T-RS1-1…T-RS5-4). Safety S1–S12 mandatory; no autonomous apply. §0.1: residual ≠ redefine **B-layered-story** exams. |
| **B-calm-portable-ir** | Effective architecture IR as a portable, CALM-round-trippable document (literal `calm-node`/`calm-relationship` fenced fragments; `ir-to-calm.ts`; future module-contract fork for raw-facts vs. reviewed-CALM consumers) | `proposed — **review before implementing, split from B-review-session on honest review 2026-08-08**` | [`Architect_Residual_Review_Session.md`](./Architect_Residual_Review_Session.md) §7.1-§7.4. Split out because it solves a distinct problem (architecture-model portability/distribution) from B-review-session's UX scope — reviewable and schedulable independently. |
| **B-k8s-fp** | Deployment correlation residual FPs | `done` (T-E6, re-checked T-R4-2) — watched under harder conditions, confirmed clean both times, no fix needed | T-E6; T-R4-2 checked whether T-R1-3's 3 new Java driver-import rows introduced any new FP risk into the real BoA k8s-correlation evidence base — grep-confirmed zero of BoA's Java services import any of them, so no new units, no new risk |
| **B-scope-hygiene** | scope-limitations ↔ Claim Register | `ongoing` | every wave |

### Later / platform

| ID | Item | Status | Notes |
|---|---|---|---|
| **B-phase2-engines** | CodeQL / scip-java on measured gap only | `todo` | engine-capability-matrix |
| **B-plugin** | Module discovery / embed API | `todo` | Goal A |
| **B-two-tier-map** | Global + domain mapping-config | `todo` | Gap_Closure |
| **B-adr** | ADR → CALM `adrs[]` | `todo` | design v2 |
| **B-helm** | Helm/Kustomize | `oos` near-term | — |
| **B-lang-expand** | Go / .NET / frontend | `oos` near-term | README |

---

## Health note (robustness)

| Dimension | Assessment |
|---|---|
| Honesty / anti-overclaim | Strong (S1, grades, non-fabricating R2, Claim Register) |
| Hardest story (layered multi-module) | **Closed.** **B-R2b** + **B-charge-jdbc-driver** both `done` — Fineract-charge's own flagship `ChargesApiResource → Charge`-family residual (open since requirements v0.9) is real, `calm validate`-clean, in a real multi-root run. |
| Discovery as a system | **Improving** — Wave R3-1 refresh done (T-R3-1/T-R3-2), cadence policy now written (below); still needs a second real cycle to prove the cadence holds, not just that it was written once |
| Eval enforcement | Good → **B-trap-promote** `done` (7/8 traps promoted, T-R3-3); **B-arch-cov** `done` |
| Pilot readiness | Scorecard shipped; **B-layered-story L0-L4 program closed** (single-root Fineract-charge gold L2 remains expected-fail by design; multi-root S-layered-access story real and gold-scored — see `standing-disconfirming-exams.md`, never say "flagship closed" bare); **robustness R0–R4 MVP done**; **B-ontology** + **B-msg-prod-sqs** both closed with real evidence; **Fidelity yardstick Y0-Y6 program closed** (serverless HTTP + Java Dynamo handler kind both real, proven for Java+explicit-CFN shape on the actual `aws-saas-boost-tier-service` repo — residuals named: Node/Python handlers, SAM shorthand, only one evidenced CFN-authoring style). Remaining UX: residual session (**B-review-session**, RS-0 signed). |
| Residual UX | HITL queue done (S1/S2 + low arch-cov); full architect residual session **not built** — design under review |

### Discovery cadence policy (T-R3-4)

**Cadence:** re-probe the sample set (`coe-lab/docs/pattern-coverage-matrix.md`) at the start of every Robustness phase boundary (i.e. after each `AGENT_TASKS_Weaver_Robustness.md` phase closes, not on a fixed calendar — phase completions are this project's real unit of progress, a fixed N-week timer would fire independent of whether anything changed). At minimum: before any phase whose own tasks depend on "what's the current top risk" (compare `AGENT_TASKS_Weaver_Robustness.md`'s own phase list — R1/R2 both did).

**What a re-probe pass must do** (same shape as Wave R3-1, T-R3-1/T-R3-2 — don't reinvent per cycle):
1. Static probes (grep counts) across current `spikes/`+`coe-lab` samples — no full pipeline run required.
2. Add any real sample used as evidence in the phase just closed but never added to the matrix (Wave R3-1's own finding: Waltz and two Fineract modules were used extensively before ever being added — check for this class of gap every cycle, not just once).
3. Explicitly retire ranked risks that closed during the phase (don't silently carry a closed risk forward — Wave R3-1's own corrective act).
4. Re-rank BACKLOG P1 to match the refreshed top risks; check OOS registry for anything the refresh surfaced (usually nothing — that's fine, the check itself is the discipline, not finding something every time).

**Owner:** whichever agent/session is executing the CURRENT Robustness phase — discovery is not a separate standing role, it's a required first/last step of each phase (mirrors T-R0's own "R0 must exist before R1-R4 have a bar" ordering). If no agent owns a phase actively, the next session picking up `AGENT_TASKS_Weaver_Robustness.md` inherits it.

**Failure mode this prevents** (already observed once, named honestly): Wave 1-B3's #1-ranked risk was closed by Phase R1, but nothing forced a re-rank — without T-R3-1/T-R3-2 explicitly doing it, the matrix would have kept presenting a solved problem as the standing top risk indefinitely, exactly the "one probe table, then chase last pain" failure `AGENT_TASKS_Weaver_Robustness.md` §0.2 already named as a reason this whole phase exists.

See [NEXT_ITERATION.md](./NEXT_ITERATION.md) for sequencing.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | **WDL review post-Fidelity-close**: `WHERE_NEXT.md` §2.1 was stale (still showed WDL-1/2 as `open`) — fixed. Real correction found while reviewing rank 7 (`D-outbound-java`): it was mislabeled `gap` when the mechanism (`outbound-http-detector.ts`/`outboundHttpPass`) is already built and live — real, precise, small residual is 2 missing catalogue library rows (`OkHttpClient`/`HttpURLConnection`), verified by an actual scan of real Fineract source, not assumed. New **B-http-client** row + new Claim Register cell **U-outbound-http** (neither existed despite the mechanism being real — a genuine doc-sync gap). |
| 2026-08-08 | **Fidelity yardstick Y0-Y6 program CLOSED.** Full matrix sweep (T-Y6-1) — every P-http/P-persist Dynamo/CFN row reflects real, dated status, no row left "named only" for Lambda. `B-lambda-http`/`B-dynamo-handler-kind` both `done` for the evidenced (Java+explicit-CFN) shape, verified on the real `aws-saas-boost-tier-service` repo throughout (5/5 real paths exact match to gold), not just synthetic. New S5 completeness flag closes the original HT-ASB-006 finding. `T-Y6-2` (Kinesis/OAuth2 stubs) explicitly skipped — owner-request gate not met, not silently dropped. Residuals carried forward honestly: Node/Python handlers, SAM shorthand, cross-stack refs, only one evidenced CFN-authoring style. |
| 2026-08-08 | **Fidelity yardstick close-out matrix + agent tasks** — `Fidelity_Yardstick_Closeout_Matrix.md` (plane/construct/locus/mechanism/claim/sample/status for one fintech org); `AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md` (Y0–Y6). **B-kinesis**, **B-oauth2-import** thin rows. Implement detectors only after Y0+Y1. |
| 2026-08-08 | **Fidelity serverless HTTP promoted to product P1** — **B-lambda-http** + **B-dynamo-handler-kind** (from CoE hard-test HT-ASB-001/002 on `aws-saas-boost-tier-service`). Claim Register: **U-http-serverless** `specified-unbuilt`; **U-http** narrowed to framework-annotation routes. Process miss recorded: Fidelity named Lambda but scoped it under deploy/k8s; Session E closed **B-dynamo-sqs** for data/queues only. See changelog note + Claim Register process RCA. |
| 2026-08-08 | **B-review-session RS-0 signed off** — owner **Gowri**, go-ahead, do not skip safety; `AGENT_TASKS_Residual_Review_Session.md` created; status `doing` / next RS-1. |
| 2026-08-08 | `Architect_Residual_Review_Session.md` H1–H4 applied: layered-story boundary, RS-* phases, real CALM field names, v1 controls limit; BACKLOG B-review-session note updated. |
| 2026-08-08 | **B-layered-story** + `AGENT_TASKS_Layered_Architecture_Story.md` added — agent implementation tasks for exam lock / multi-root / store-terminal program (Phase L0 first). |
| 2026-08-08 | **Post-close genericity probe** (the item the program's own honest review ranked highest-value): real fresh full-clone `finos/waltz` scan looking for a second R2b-resolved case to justify L2b. Didn't find one — found a different, earlier-stage real gap instead: bridge discovery only enters via `implements` edges, missing Waltz's idiomatic concrete-class-direct-delegation shape entirely (28 real candidates, 0 fabricated, 0 resolved). New backlog item **B-multihop-direct-delegate**, not built — see `coe-lab/docs/findings/waltz-multihop-genericity-probe.md`. `D-terminal-refine` decision (§3, `AREC_Store_Terminal_Policy.md`) unchanged — its trigger condition still genuinely unmet. |
| 2026-08-08 | **`B-layered-story` L0-L4 program CLOSED** (T-L4-1…T-L4-3): full standing exam matrix re-run on genuinely fresh scans (not cached artefacts) — all 5 exams PASS, none regressed. `AGENT_TASKS_Layered_Architecture_Story.md`'s own Definition of Program Done fully satisfied. Also fixed stale forbidden phrasing ("Fineract-charge flagship closed", bare) still sitting in this file's own health-note row — the exact drift the program exists to prevent, caught here at close. |
| 2026-08-08 | **Phase L3 complete** (T-L3-1…T-L3-3): `Multi_Root_Operator_Recipe.md` (when/how/claim-triple guide, linked from README); `coverage-report.ts`'s `relationshipsByMechanism` breakdown, surfaced in the IR; `hitl-review-trigger.ts` now names the specific unresolved-multi-hop residual in S1 rationale instead of a generic pointer. Real correction found while verifying: initial test assertions assumed only the flagship edge would show up (wrong — the real multi-root scan resolves 126 total edges across the whole codebase) and that mechanism buckets would sum to every graphify/calls relationship (wrong — R0's reconciler independently emits unrelated calls edges) — both fixed to real, checked facts. No detector logic changed. Full suite 56/56 green. |
| 2026-08-08 | **Phase L2 complete** (T-L2-0…T-L2-5): design note (`AREC_Store_Terminal_Policy.md`) written before any code per the phase's hard rule, documenting the real Phase-1/R2b mechanism and recording `D-terminal-refine = no build` (reasoned, revisitable). First `pipeline/src` change in the whole program: additive optional `TypedRelationship.mechanism` field, no CONTRACT_VERSION bump, zero detector behavior change — verified via the real Fineract flagship test now asserting `mechanism === 'r2-phase1'` exactly as the design note predicts. T-L2-2/T-L2-5 found already satisfied by pre-existing fixtures once checked against their stated bars. T-L2-4 noise-filter spike concludes defer (traced the real invariant, already enforced). Full suite 56/56 green. |
| 2026-08-08 | **Phase L0 complete** (T-L0-1…T-L0-4): `coe-lab/docs/standing-disconfirming-exams.md` created (5 immutable exam IDs, seeded from real regression evidence); `Claim_Register.md` R2 row split into `R2-mechanism`/`R2-gold-charge-single`/`R2-multi-root-access-terminal` (corrects prior claim-drift wording); `fineract-gold-vs-platform-finding.md` retest addendum added; STATUS §F + this file + `multi-root-l2-protocol.md` cross-linked. Docs-only, no detector changes. L1 not started. |
| 2026-08-08 | **Robustness R0–R4 MVP complete** (agent delivery reviewed): Now/next flipped **RB** `doing` → `done`; P1-next/UX-next called out. Suite 55/55. |
| 2026-08-08 | **B-review-session** added (P3): architect residual review session design in `Architect_Residual_Review_Session.md` — status `proposed — review before implementing`. **B-hitl-s1** flipped to `done` (T-E5 already shipped queue CLI; full residual UX is B-review-session, not a second hitl-s1). Doc link added to “How to use” table. |
| 2026-08-08 | **Phase L1 complete** (T-L1-1…T-L1-5): hand-authored multi-root gold `fineract-charge-provider` (real source evidence); root-set/scan-mode refuse-by-default guard in `validate-calm-pair.mjs` (reads platform's real `x-aac-package-roots`, verified both directions with real data); expected-fail harness (verified both branches); opt-in endpoint-aware L2 (synthetic test proves it catches what type-multiset L2 cannot). Both standing exams `E-charge-single-L2`/`E-charge-multi-story` now have real protocol-run evidence (previously mechanism-level-test-only). No `pipeline/src` changes — L2 (detector code) not started. |
| 2026-08-08 | Honest pre-mortem review of `Architect_Residual_Review_Session.md` (rubric reuse per `AaC_Solution_Design_Critical_Review_Prompt.md`) found a real blocking gap (agent-mode terminal execution could bypass the drafts/-only write path — §4.4 fix applied) plus several should-fix items, all resolved same day. **B-calm-portable-ir** split out of B-review-session (§7.1-§7.4 solve a distinct portability problem, not UX) — see new row above. |
| 2026-08-08 | Initial thin index after Wave 3 A–D |
| 2026-08-08 | Robustness track folded in; link to AGENT_TASKS_Weaver_Robustness.md |
| 2026-08-08 | Session E (T-E1–T-E6) marked done — was stale `todo` from before this session's work landed |
| 2026-08-08 | Robustness Phase R0 (T-R0-1…T-R0-5) done: B-pilot-scorecard, B-R2-eval, B-oos-registry flipped; new Pilot_Ready_Scorecard.md / multi-root-l2-protocol.md / OOS_Registry.md linked above |
| 2026-08-07 | Backlog-hygiene pass: B-arch-cov and B-graphify-partial were shipped in R0 (T-R0-2/T-R0-5 per STATUS.md) but never flipped from `todo`; B-R2-eval was `done` in the Robustness track table but still `todo` in the duplicate P1 reference — both classes of staleness fixed, health note reworded to match |
| 2026-08-07 | T-R1-1 (R2b design addendum) done — see `AREC_R2b_Implementer_Store_Hop.md`; B-R2b flipped `todo` → `doing`. Separately: real-repo scan sweep against Fineract found and fixed a real crash (`.push(...arr)` spread exceeding V8's argument limit on `fineract-provider`, 2733 files, 167k+ ignored items) — 13 call sites converted to a loop-based `pushAll()`, regression-locked (200k-element synthetic test, no real-repo dependency needed to catch a regression). Not a BACKLOG-tracked item (no open row existed for it — found and fixed same-session); see STATUS.md §E for full detail. |
| 2026-08-07 | T-R1-2 (R2b implementation) done — `multi-hop-bridge-detector.ts` extended with the implementer-import hop; B-R2b flipped `doing` → `done`. Real multi-root remeasure: 11 new architecture relationships resolved in `fineract-provider`, 3 more in `fineract-core` (single-root) — Fineract-charge's own flagship case stays an honest, named residual (implementer imports 0 candidate stores, confirmed via real run). New backlog row **B-charge-jdbc-driver** names the one concrete remaining path to close it. Claim Register R2 row and STATUS.md §E updated same-session. 48/48 tests green. |
| 2026-08-08 | T-R1-3 (Java Graphify import target normalization) done — new `java-import-resolver.ts` reads the real import line back from source (Graphify's Java `imports` edges only ever carry the bare symbol, never the qualified package). B-java-driver-ref, B-jooq flipped to `done`; real evidence: `org.postgresql` (Fineract `fineract-security`), `org.jooq` (229 real units, Waltz `waltz-data`). **Follow-up evidence check closes the flagship Fineract residual**: added `org.springframework.jdbc.core`, re-ran the real `fineract-charge`+`fineract-provider` multi-root scan — `ChargesApiResource → ChargeReadPlatformServiceImpl` is now a real, `calm validate`-clean, confidence-10 relationship. B-charge-jdbc-driver flipped `todo` → `done`. Phase R1 complete. 3 new regression tests (2 fast, 1 slow/gated); 1 pre-existing test's hardcoded count moved 85→96 with a real, explained reason. 51/51 tests green. |
| 2026-08-08 | Phase R2 complete (T-R2-1, T-R2-2, T-R2-3). New `Catalogue_Intake.md` (B-catalogue-intake → done). Two new C-call rows: Waltz `hasRole` (security-rbac-003, real 4-call-site evidence) and Fineract `isAuthenticated` (security-auth-002, weighted lower on a real stated authn-vs-authz distinction) — B-C-call-expand → done. New `authorityRef` structured field (control-builder.ts) — B-C-rich-authority → done. 4 new/extended regression tests. 53/53 tests green. |
| 2026-08-08 | T-R3-1/T-R3-2 (discovery refresh + re-rank) done — `coe-lab/docs/pattern-coverage-matrix.md`'s Wave R3-1 section: 18 samples probed (9 carried forward + Waltz data/web, Fineract security/provider, and 5 previously-unprobed lab fixtures — none had ever been added to this matrix despite being real evidence repos this whole session). Wave 1-B3's #1/#2/#6 ranked risks (R2 multi-hop, call-site auth, Spring Data/jOOQ) retired as closed; **B-ontology** and a new, split-out **B-msg-prod-sqs** promoted to P1 as the new #1/#2 ranked risks. `OOS_Registry.md` checked — nothing new warranted an OOS row, both promoted to active backlog instead; its stale "B-java-driver-ref not listed" note updated to reflect it's now done. |
| 2026-08-08 | Phase R4 complete (T-R4-1, T-R4-2). T-R4-1 found and closed a real gap, not just doc-sync: the task's own original goal named two triggers ("S1 fires OR arch coverage below threshold"), but `hitl-review-trigger.ts` had only ever wired in S1/S2 (T-E5 shipped before T-R0-2's `architectureOutboundCoverage` metric existed). New `low-architecture-coverage` trigger added, mutually exclusive with S1, real-verified against Fineract `fineract-security` (17% coverage, 5 real services flagged). T-R4-2 legitimately skipped — checked (not assumed) whether T-R1-3's 3 new Java driver-import rows introduced new FP risk into the real BoA k8s evidence base; grep-confirmed zero BoA Java services import any of them. 1 new regression test. **Robustness program (R0-R4) now fully complete.** |
| 2026-08-08 | **B-ontology** and **B-msg-prod-sqs** (P1 #1/#2 ranked risks) both closed with real evidence. B-ontology: new `ownerBaseClass` catalogue field + `class-ownership-resolver.ts` — a real finding falsified Q13's own proposed fix before it was implemented (Graphify emits no `inherits` edge for an external base class like `PrismaClient`), so ownership is verified via bounded multi-line source read-back instead; real Ghostfolio re-run: `AccessService` correctly no longer `database`, `PrismaService` correctly still is (1 real unit, down from 87 mislabeled). B-msg-prod-sqs: `messaging-pass.ts` now merges messaging evidence onto an already-typed unit instead of silently dropping it (T-E3's original fix's real cost); real lab `ts-orders-dynamo` evidence: `OrdersDynamoStore` now carries both persistence and messaging evidence on one unit. 2 pre-existing regression tests fixed for a real, expected side effect (1 new `architecture-nodes-must-be-referenced` warning where a removed false-positive node orphaned a real one) — not silenced, the assertion was corrected to expect the honest new count. 3 new/updated regression tests. |
