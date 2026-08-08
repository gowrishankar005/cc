# CoE lab hard-test backlog

**Purpose:** Capture strengths, weaknesses, issues, and RCAs from **wild-type hard-test** compares (hand gold vs platform).  
**Not** the product coding backlog (`docs/solution/BACKLOG.md`). Promote rows there only after human prioritization.

**Playbook:** [`hard-test-eval-playbook.md`](./hard-test-eval-playbook.md)  
**Registry:** [`hard-test-repo-registry.md`](./hard-test-repo-registry.md)

**Rules:**

1. One package cycle → update this file (even if “no new HT rows”).  
2. Prefer **mechanism class** language (R1, R2, C-call, import-resolve, crash, gold-scope) over sample names in `class`.  
3. `for-platform: yes` means “candidate for a later pipeline task” — **not** “fix in this eval session.”  
4. Do not close HT rows by editing gold to match a bad generator without documenting **gold-error**.

---

## Open items

| ID | package-id | severity | class | summary | detail / finding | for-platform? | status |
|---|---|---|---|---|---|---|---|
| **HT-DOX-001** | maven-doxia-system-map | high (scope) | mechanism / product-scope | Library monorepo → **0 TypedUnits / empty CALM**; module-grain architecture not extracted | `findings/maven-doxia-system-map-gold-vs-platform.md` | yes — if product wants library/module maps; else document as OOS for AaC HTTP/DB product | open |
| **HT-DOX-002** | maven-doxia-system-map | medium | completeness UX | **S1 does not fire on total emptiness** (requires service+db present); empty run looks quiet | same finding §3 | yes — silence precondition for zero-unit runs | open |
| **HT-DOX-003** | maven-doxia-system-map | medium | operator UX | **Empty CALM still calm-validate 0 errors** — L0 green without architecture | same finding §1/§6 | yes — operator/docs or non-empty check optional | open |
| **HT-DOX-004** | maven-doxia-system-map | low | noise | 14k INSUFFICIENT_EVIDENCE / unmapped dominated by tests & HTML entity noise | same finding §3 | yes — later filter/test-code exclusion quality | open |
| **HT-DOX-005** | maven-doxia-system-map | note | gold / grain | Module-grain gold vs class-grain pipeline: L1 compare is grain-mismatched by construction | same finding §5 | no — eval design; use grain metadata N/A in compare | noted |
| **HT-ASB-001** | aws-saas-boost-tier-service | high | mechanism U-http / Lambda | API Gateway + `RequestHandler` / `APIGatewayProxyResponseEvent` **not** detected as HTTP service; 0 service units; gold `/tiers*` paths missing | `findings/aws-saas-boost-tier-service-gold-vs-platform.md` | **yes** — serverless SaaS shape common in fintech cloud | **promoted → product P1 `B-lambda-http`** (`docs/solution/BACKLOG.md`); Claim **U-http-serverless** `specified-unbuilt` |
| **HT-ASB-002** | aws-saas-boost-tier-service | high | ontology U-persist-import | **TierService mis-kinded `database`** because it imports `DynamoDbClient` (handler, not store) | same | **yes** — Java Dynamo client import too coarse (Prisma ownerBaseClass-class problem) | **promoted → product P1 `B-dynamo-handler-kind`** |
| **HT-ASB-003** | aws-saas-boost-tier-service | medium | test-code | `*Test` classes become database units via Dynamo imports | same | yes — strengthen TEST_CODE / test path exclusion for graphify persistence | open |
| **HT-ASB-004** | aws-saas-boost-tier-service | medium | unit formation | Methods (`fromTier`/`toTier`) become database units | same | yes — contains walk should prefer types/classes | open |
| **HT-ASB-005** | aws-saas-boost-tier-service | high | R0/R1 grade | Real TierService→DynamoTierDataStore edge is **structural** (both ends database), not architecture service→db | same | yes — follows from HT-ASB-001/002 | open |
| **HT-ASB-006** | aws-saas-boost-tier-service | medium | completeness UX | No S1 with databases-only (no service units); missing HTTP not loud | same | yes — related HT-DOX-002 | open |

---

## Closed / noted (historical or accepted)

| ID | package-id | summary | disposition |
|---|---|---|---|
| HT-FIN-001 | fineract-charge | Single-root L2 fail: layered multi-hop / out-of-module implementer | Accepted residual; tracked under **B-layered-story** / standing exams — not reopened here as new HT unless retest regresses L1 |
| HT-FIN-002 | fineract-charge (+provider) | Multi-root recovers access-layer terminal ≠ gold entity grain | Documented; multi-root gold / claim triple — layered-story program |

---

## Per-package scoreboard (fill as compared)

| package-id | L0 gold | L0 gen | L1 | L2 | L3 silence | Date | Finding doc |
|---|---|---|---|---|---|---|---|
| fineract-charge (single) | PASS | PASS | PASS | FAIL | S1 | 2026-08 retest | `fineract-gold-vs-platform-finding.md` |
| **maven-doxia-system-map** | PASS | PASS (empty) | FAIL (0 modules) | FAIL (0 connects) | **no S1** (empty) | 2026-08-08 | `findings/maven-doxia-system-map-gold-vs-platform.md` |
| **aws-saas-boost-tier-service** | PASS | PASS | FAIL (no service; wrong kind) | FAIL (no arch service→db) | no S1 (db-only) | 2026-08-08 | `findings/aws-saas-boost-tier-service-gold-vs-platform.md` |

---

## Strengths log (cumulative — what platform does well)

| Date | package-id | Strength |
|---|---|---|
| 2026-08 | fineract-charge | JAX-RS route assembly + entity detection (L1); schema-valid CALM |
| 2026-08 | fineract multi | S-layered-access edge when implementer in root set |
| 2026-08-08 | maven-doxia-system-map | Completes without crash; no false HTTP/DB architecture; rich ignored/unmapped artefacts |
| 2026-08-08 | aws-saas-boost-tier-service | Java DynamoDB SDK v2 import detection works; DynamoTierDataStore recovered; dual-unit structural graph among DDB types |

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | File created; hard-test track prepared; Fineract historical notes seeded so we don’t re-RCA blindly |
| 2026-08-08 | **maven-doxia-system-map** first hard-test cycle complete: HT-DOX-001…005; empty CALM / no module map |
| 2026-08-08 | **aws-saas-boost-tier-service** second hard-test: HT-ASB-001…006; Dynamo yes, Lambda HTTP no, TierService mis-kinded database |
| 2026-08-08 | **HT-ASB-001/002 promoted to product P1** — `B-lambda-http`, `B-dynamo-handler-kind` in `docs/solution/BACKLOG.md`; Claim **U-http-serverless** |
