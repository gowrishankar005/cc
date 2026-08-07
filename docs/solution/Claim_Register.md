# Claim Register — what we may say is “built”

**Status:** active (Wave 1-A0)  
**Authority:** Prefer this file over marketing language in STATUS/CLAUDE when they disagree on **relationship or control completeness**.  
**Master sequence:** `AGENT_TASKS_Master_Sequence_Claim_Honesty_and_AREC.md`  
**Last updated:** 2026-08-07

---

## How to use this register

| Status | Meaning | Allowed green |
|---|---|---|
| **proven** | Verified on real evidence + regression or documented run | L1 unit recall; L2 only if claim says so |
| **partial** | Some strategies work; not the full product claim | L0–L1; L2 only for proven sub-shapes |
| **specified-unbuilt** | Design/requirements named it; code incomplete or absent | Must not claim “works”; OOS or fail L2 |
| **unevidenced** | No solid sample yet | No product claim |
| **OOS** | Explicitly out of product scope for now | Silence OK only if scope-limitation id present |

**Rule:** Do not mark STATUS “built” for a cell here without evidence pointer + validation layer that is allowed to green.

---

## Dual-unit Graphify decision (product, not implementation accident)

| Decision | **Dual-unit structural edges are an interim / structural product (R0), not the full definition of “architecture relationship.”** |
|---|---|
| Meaning | Graphify reconciler only emits edges when **both** endpoints are TypedUnits. That is correct for **code-level structural** edges. It is **insufficient** alone for enterprise **architecture stories** (e.g. layered Fineract API → platform service → entity). |
| Claim language | May say: “structural/code-graph relationships between discovered units.” Must **not** say: “service→persistence architecture is recovered for Java enterprise monorepos” without R1/R2 strategies (AREC). |
| Date | 2026-08-07 (Wave 1-A0 lock for claim honesty; AREC details in Wave 2) |

---

## Mechanism-class matrix

| ID | Mechanism class | Status | Evidence | Validation allowed green | Notes |
|---|---|---|---|---|---|
| **U-http** | HTTP entry (native route / composed JAX-RS / Nest) | **proven** | BoA Flask, Nest fixture, Fineract charge/core, lab fixtures | L1 paths | |
| **U-entity** | JPA `@Entity` → database unit | **proven** | Fineract charge/core, lab java | L1 database nodes | |
| **U-persist-import** | Driver/import persistence (SQLAlchemy, Prisma `ref_`, …) | **partial** | BoA SQLAlchemy; Ghostfolio Prisma after `ref_` fix | L1 with low confidence ok | Prisma service-as-database ontology is a KNOWN, DECIDED limitation (Q13, T-E2, 2026-08-08) — a class merely importing a driver's TYPES (e.g. Ghostfolio's `AccessService`) is indistinguishable from a class that OWNS the client (`PrismaService extends PrismaClient`); fix deliberately not shipped without re-verifying an inherits-based rule against BoA/Fineract too |
| **U-msg-consumer** | `@KafkaListener` → network/topic | **partial** | Fineract listener + lab kafka; gold maps to network | L1 network unit | Producer call-site still open |
| **U-msg-producer** | `KafkaTemplate.send` / SQS send | **partial** (T-E1, 2026-08-08) | Real Fineract `KafkaExternalEventProducer.java` (`fineract-provider`) — `topic`/`network` node from its `KafkaTemplate`-typed field | L1 network unit for Kafka; SQS/SNS producers still `specified-unbuilt` | Detects the field TYPE (architectural commitment), not a paired `.send()` call — see `scope-limitations.yml`'s `messaging-producer-field-type-only` |
| **U-spring-data** | Spring Data repository interfaces (`extends JpaRepository`) | **partial** (T-E3, 2026-08-08) | Real Fineract `ChargeRepository.java` — `extends` reference detection, plus a real knock-on `connects` relationship to `Charge` via R0 | L1 database unit | |
| **U-jooq** | jOOQ (`org.jooq.*` import) | **specified-unbuilt; re-confirmed** (T-E3) | Real Waltz `GenericSelector.java` re-checked — CONFIRMS Graphify normalizes Java imports to bare symbol names (not qualified packages), the SAME root-cause already disclosed for `org.postgresql`, now known to be general across ALL Java driver-import rows, not jOOQ-specific | L2 fail | Deliberately not fixed this round — a cross-cutting Java import-matching change needs its own verified pass, not a rushed one-catalogue-row patch |
| **R0** | Dual-unit Graphify structural edges | **proven** (as structural, now graded) | Core entity–entity; BoA service–db when one-hop | L2 **only** for shapes that match R0 | Not Fineract API→entity. `TypedRelationship.grade`/`x-aac-relationship-grade` (T-A2, 2026-08-07) labels every relationship `structural`\|`architecture`\|`trust` — Fineract-core's 64 entity–entity edges verified `structural`, BoA's service→db edge verified `architecture` |
| **R1** | One-hop architecture service→db (import/calls between units) | **partial, regression-locked** | BoA Python service→AccountDb | L2 BoA-class | T-B1 (2026-08-07): hard regression asserts a real service->database `connects` edge by endpoint KIND + `grade: architecture`, not just a relationship count — R2 work (Session C/D) cannot silently regress this shape |
| **R2** | Multi-hop / layered (API→app service→entity) | **partial (T-C1 + R2b/T-R1-2)** | `multi-hop-bridge-detector.ts` (Phase 1 + R2b implementer-import hop); synthetic `test/fixtures/r2-bridge-sample` (Phase 1 positive case) + `test/fixtures/r2b-implementer-hop-sample` (R2b positive + ambiguity cases, both verified correct); real Fineract `fineract-charge` single-root AND `fineract-charge`+`fineract-provider` multi-root re-measured with R2b active | L2 for a shape where the bridge's sole implementer is itself a real persistence/messaging unit (Phase 1) OR imports exactly one directly (R2b), within scanned roots; L2 **fail** (honest residual, not a bug) for Fineract-charge specifically — its real implementer (`ChargeReadPlatformServiceImpl`) is raw-JDBC and imports NEITHER the entity NOR a catalogue-recognized driver, so even R2b's hop finds 0 candidates (confirmed via a real re-run, ignored-item explicitly says "imports 0 candidate store unit(s)") | Primary Fineract gap — mechanism built, extended (R2b), and verified correct/non-fabricating. **Real, substantial win beyond Fineract-charge**: re-measuring `fineract-charge`+`fineract-provider` with R2b active resolved **11 real new architecture-grade relationships** across `fineract-provider` (e.g. `EntityDatatableChecksApiResource→EntityDatatableChecksRepository`, `HookApiResource→HookRepository`, `ClientChargesApiResource→ClientTransactionRepository`), each confidence 8, grep-verified real service→repository chains R2 Phase 1 could not see. `fineract-provider` alone: 97.5% `architectureOutboundCoverage`. The flagship Fineract-charge case remains a genuine, evidenced residual — closing it needs a Spring-JDBC driver-import catalogue row (`org.springframework.jdbc.core`) combined with the Java Graphify symbol-vs-package fix (`B-java-driver-ref`/T-R1-3), out of R2b's own scope, named in `docs/solution/AREC_R2b_Implementer_Store_Hop.md` before code was written. See `docs/solution/AREC_R2_MultiHop_Strategy.md` (Phase 1 design) and `AREC_R2b_Implementer_Store_Hop.md` (R2b design + evidence) for the full detail. Real, pre-existing, separately-disclosed gap surfaced while proving this: Graphify normalizes a Java driver import to its bare symbol name, not the qualified package, so `persistence-detection-catalogue.yml`'s `org.postgresql` row remains unverified via Graphify for Java |
| **R-k8s** | shares-secret / env soft-graph | **partial** | BoA k8s; deployment correlation post-MVP | L2 when manifests passed | T-E6 (2026-08-08, watch — no fix needed): re-ran the full real 6-service BoA k8s+env-soft-graph scan under HARDER conditions than the original fix was verified against (T-E3 added new, similarly-named `Transaction`/`TransactionRepository` database units for all 3 Java services since then) — confirmed 0 unresolved k8s deployments, 0 substring leaks into any k8s/env-derived relationship endpoint. Service-kind-only guard holds |
| **C-dec** | Decorator controls (`@PreAuthorize`) | **proven** | DatatableWriteService | L1 controls presence | Now also carries `expression` when the decorator has one (C-rich, T-D2) |
| **C-call** | Call-site auth (`validateHasReadPermission`, `jwt.decode`) | **partial** (T-D1, 2026-08-07) | Real `ChargesApiResource.java` (fineract-charge, lines 84/101/129), real `AppUser.java` (fineract-core), real lab `py-jwt-gateway` (line 14) | L1 controls presence for the 2 named vocabularies (Java `validateHas*Permission`, Python `jwt.decode`) | Only 2 vocabularies — not a general call-graph auth inference; see `scope-limitations.yml`'s `call-site-controls-partial` |
| **C-contract** | OpenAPI securitySchemes | **partial, expanded** (T-E4, 2026-08-08) | Real lab `ts-nestjs-users` (`bearerAuth: {type: http, scheme: bearer}`) — matched against the scheme's real structural `type`/`scheme` fields (never the author-chosen name), attaches a real `security-contract-http-bearer-001` control | L1 controls presence for http-bearer/http-basic/apiKey/oauth2 | `openIdConnect` and richer OAuth2-flow detail not modeled |
| **C-rich** | Control config richness (expression, authority) | **partial** (T-D2, 2026-08-07) | Real `expression` field on Fineract's `security-rbac-002` (`RESOURCE_NAME_FOR_PERMISSIONS`) and lab jwt-gateway's `security-auth-001` (shows the real `verify_signature: False` anti-pattern in source) | L1 requirement not yet raised to require it | Raw source-line TEXT only, never a resolved constant value; `authority`/richer fields still not modeled |
| **S-silence** | Completeness / empty neighborhood loudness | **partial** | Fineract charge: S1 fires (service+db, 0 service-touching rels); BoA: S1 correctly does not fire (R1 present) — `coverage-report.json`'s `completeness` block + `intelligence-ir.md` | L3 for S0/S1/S2; S3 (narrative) is T-D3, S4 documented in scope-limitations | AREC Wave 3 T-A1, 2026-08-07. T-E5 (2026-08-08): a thin offline `hitl-review-trigger.js` CLI turns S1/S2 into a concrete, per-unit `review-queue.json` (real fineract-charge → 3 items; real BoA → 1 item; no flags → empty array) — deterministic, no LLM, never imported by run-slice.ts's call graph. Robustness T-R0-5 (2026-08-08): new S0 flag (`graphifyStatus !== 'ok'`) folded into the same `silenceFlags` array — a degraded/failed Graphify pass silently starves S1's own precondition otherwise. Robustness T-R0-2: `architectureOutboundCoverage` rate (real BoA 100%, real Fineract-charge 0%) alongside the binary flags |

---

## Product claims — allowed vs forbidden phrases

| Forbidden (without caveats) | Allowed |
|---|---|
| “Java relationships work end-to-end” | “JAX-RS routes and JPA entities are discovered; architecture service→store links are partial (R1 where one-hop; R2 unbuilt)” |
| “Security/controls captured for Fineract APIs” | “`@PreAuthorize` on service interfaces is captured; call-based PlatformSecurityContext auth is not” |
| “Graphify recovers full architecture graph” | “Graphify supplies structural edges between TypedUnits (R0)” |
| “Node persistence verified” (pre-ref_ fix) | “Prisma/import detection works with Graphify `ref_` normalization (Ghostfolio)” |

---

## Open questions (Q1–Q12) — decide / park

Living cadence: re-open when claim cells or AREC DoD change. Full narrative: `Open_Questions_Validation.md`.

| Q | Topic | State | Decision / park |
|---|---|---|---|
| Q1 | Definition of done: schema vs unit vs story | **decided** | Layered L0–L5 (`validation-approach-vnext.md`); story = L2 |
| Q2 | Meaning of relationship: code vs architecture | **decided** | R0 structural ≠ architecture claim; R1+ for architecture |
| Q3 | What incompleteness must be loud | **decided; L3 shipped (T-A1)** | Service+db with zero service-touching edges must not L2-pass; `completeness.silenceFlags` (S1/S2) now computed per run, exposed in `coverage-report.json` + `intelligence-ir.md` |
| Q4 | Dual-unit product boundary | **decided** | Interim structural (see above) |
| Q5 | Disconfirming samples for relationship claims | **decided (process)** | BoA shallow + Fineract layered required before “Java rels complete” |
| Q6 | Lab shape-representative? | **decided** | Lab under-represents layering; wild gold mandatory for enterprise claims |
| Q7 | Wild gold owner | **parked** | Lab maintainer / eval owner; refresh on fixture or Fineract module intent change |
| Q8 | Validation stack | **decided; L0-L2 tooling shipped (T-A3)** | L0 calm validate; L1 semantic/unit; L2 story; L3 silence; L4 scope; L5 HITL residual. `validate-calm-pair.mjs` now prints these as distinct lines (not one bundled "semantic" verdict); exit code = L0+L1 by default, `--require-l2` opts into gating on L2 |
| Q9 | HITL → catalogue promotion | **parked** | Follow existing unmapped≥5 promotion; AREC residual separate |
| Q10 | Forever OOS vs deferred | **partial** | Register + scope-limitations; refresh when strategies ship |
| Q11 | Full monorepo vs module scan product mode | **decided (T-A6, 2026-08-07)** | **Module-root scan is the primary/default claim mode** — one `run-slice` invocation against a single package root is what every R0/R1/U-* mechanism-class cell above is proven/partial against, unless a cell's evidence explicitly says otherwise. **Multi-root scans are a real, supported, but secondary mode** — passing 2+ roots to one `run-slice` invocation runs ONE combined Graphify pass over their common ancestor, which is what makes cross-package (`crossPackage: true`) relationships possible at all (single-root runs structurally cannot produce them — there is nothing to cross). A claim of "N cross-package relationships found" is **only valid for the specific multi-root run that produced it** — re-running the same roots individually will show 0 cross-package edges, correctly, not a regression. Real evidenced case: Fineract `fineract-charge`+`fineract-core` combined scan → 265 real cross-module edges (`docs/solution/language/java.md`); every coe-lab/AREC remeasure in this register (§0.6) uses single-root scans and must not be read as having exercised cross-package detection. **Written procedure (T-R0-3, 2026-08-08):** `coe-lab/docs/multi-root-l2-protocol.md` — root-set declaration template, generic root-set shapes, and the rule that any multi-root finding must name its exact root set. |
| Q12 | STATUS “built” vs mechanism subset | **decided** | This register is authoritative for completeness claims |

---

## AREC DoD binding (Wave 2-3)

Architecture completeness claims also require `Architecture_Relation_Evidence_Completeness.md` §7.  
In short: R0 structural ≠ architecture L2; R2 + C-call (or OOS) before Fineract-class story green. Both R2 (T-C1) and C-call (T-D1) are now `partial` — mechanisms real and verified, but Fineract-charge's own L2 story remains FAIL (an evidenced residual: R2's bridge implementer lacks persistence evidence; C-call correctly adds real controls but that alone doesn't produce a service→db relationship). "Partial + partial" is not yet "Fineract L2 green" — see `coe-lab/docs/validation-approach-vnext.md`'s expected-fail table.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-07 | Wave 1-A0 initial register from Fineract RCA + dual-unit decision |
| 2026-08-07 | Wave 2-3 AREC DoD cross-link |
| 2026-08-07 | Wave 3 T-A1: S-silence → partial (S1/S2 computed real, per-run); Q3 L3 shipped |
| 2026-08-07 | Wave 3 T-A2: R0 grading shipped (`grade` field, design A) — structural/architecture/trust verified on real Fineract-core + BoA |
| 2026-08-07 | Wave 3 T-A3: eval L0/L1/L2 labels shipped in `validate-calm-pair.mjs`; Q8 tooling note |
| 2026-08-07 | Wave 3 T-A4: `scope-limitations.yml` hygiene pass (v0.1.0→v0.2.0) — k8s/env/OpenAPI/messaging bullets de-staled to match this register; new dedicated R2/C-call bullets |
| 2026-08-07 | Wave 3 T-A6: Q11 decided — module-root primary claim mode, multi-root secondary/scan-specific. Session A complete. |
| 2026-08-07 | Wave 3 T-B1: R1 → partial, regression-locked (hard endpoint-kind + grade assertion on BoA service->database) |
| 2026-08-07 | Wave 3 T-B2: R2 design note shipped (`AREC_R2_MultiHop_Strategy.md`), grounded in fresh real Fineract re-investigation — found the interface bridge is real and Graphify-visible, but its implementation is in a third, unscanned module |
| 2026-08-07 | Wave 3 T-C1: R2 → partial. `multi-hop-bridge-detector.ts` built and verified on a synthetic positive fixture + two real Fineract scan shapes (single-root and multi-root), both honest residuals with 0 fabricated relationships. 35/35 tests green |
| 2026-08-07 | Wave 3 T-C2: confirmed `validate-calm-pair.mjs` correctly still reports `fineract-charge` L2 FAIL post-R2 (real regenerate + re-run, not assumed); gold not weakened. Session C complete. |
| 2026-08-07 | Wave 3 T-D1/T-D2/T-D3: C-call → partial (real Fineract + lab evidence), C-rich → partial (real `expression` field), threat-signals rationale softened (S3). `CONTRACT_VERSION` 4.0.0→5.0.0 (`Evidence.source: 'call'`). 38/38 tests green. Session D complete. |
| 2026-08-08 | Wave 3 T-E1: U-msg-producer → partial (real Fineract KafkaExternalEventProducer.java, field-type detection). `CONTRACT_VERSION` 5.0.0→6.0.0 (`Evidence.source: 'field-type'`). 39/39 tests green. |
| 2026-08-08 | Wave 3 T-E2: Q13 decided — persistence import-vs-ownership ambiguity is a real, disclosed, deliberately-not-fixed-this-round limitation (regression risk to proven BoA/Fineract detection outweighed the fix without a full re-verify). No code change; scope-limitations.yml + Open_Questions_Validation.md updated. |
| 2026-08-08 | Wave 3 T-E3: U-spring-data → partial (real Fineract ChargeRepository), U-jooq re-confirmed unbuilt (same Java Graphify import-symbol gap as org.postgresql, now generalized). Real bug found+fixed: persistence/messaging detector double-emit on files with both library types produced duplicate unique-ids — fixed via existingUnitFilePaths. DynamoDB verified via lab fixture. `CONTRACT_VERSION` 6.0.0→7.0.0 (`Evidence.source: 'extends'`). 40/40 tests green. |
| 2026-08-08 | Wave 3 T-E4: trap card T8 promoted — openapi-pass.ts now merges an openapi.yaml unit into an overlapping code-derived unit instead of spawning a competing node (real lab ts-nestjs-users fixture). C-contract → partial, expanded: securitySchemes now matched by real structural type/scheme, not author-chosen name — real http-bearer/http-basic/apiKey/oauth2 control rows. 41/41 tests green. |
| 2026-08-08 | Wave 3 T-E5: S-silence note extended — thin offline `hitl-review-trigger.js` CLI ships (review-flow-capability-map.md's own recommended decision), turning S1/S2 into a concrete per-unit review-queue.json. No LLM, no core-path import. 43/43 tests green. |
| 2026-08-08 | Wave 3 T-E6: k8s substring residual re-watched under harder conditions (T-E3's new Transaction/TransactionRepository database units) — 0 new false positives, no fix needed. Session E complete (T-E0 skipped, T-E1–T-E6 all done). |
| 2026-08-08 | Robustness Phase R0 (T-R0-1…T-R0-5) complete: `Pilot_Ready_Scorecard.md`, architecture-coverage rate metric, `multi-root-l2-protocol.md`, `OOS_Registry.md`, S0 Graphify-backbone flag all shipped. S-silence note extended (S0 + architectureOutboundCoverage). 46/46 tests green. |
| 2026-08-07 | Robustness T-R1-1: R2b design addendum (`AREC_R2b_Implementer_Store_Hop.md`) — real evidence re-checked against `fineract-provider`, honest prediction stated before code: mechanism will generalize but won't close Fineract-charge's own flagship residual. |
| 2026-08-07 | Robustness T-R1-2: R2b implemented (`multi-hop-bridge-detector.ts` implementer→store hop), new fixture `r2b-implementer-hop-sample` (positive + ambiguity). Real multi-root remeasure confirms the T-R1-1 prediction exactly: 11 new real architecture relationships resolved elsewhere in `fineract-provider`, Fineract-charge's own case stays an honest, named residual. R2 row → partial (T-C1 + R2b). Fineract-core T-A2 regression test updated (was asserting "never architecture" — now correctly distinguishes R0 direct-reconciler edges (still structural) from R2/R2b edges (architecture), since R2b now legitimately closes 3 real fineract-core cases too. 48/48 tests green. |
