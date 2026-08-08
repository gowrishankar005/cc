# WDL Implementation Plan

**Name:** Weaver Discovery Ladder (WDL) — implementation plan  
**Date:** 2026-08-08  
**Authority:** [`WHERE_NEXT.md`](./WHERE_NEXT.md) §2 (WDL ranks) · hard-tests #2–#3 (saas-boost tier + tenant)  
**Status:** **Phase I (WDL-1/2) CLOSED, 2026-08-08** (via `AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md` Y0-Y6). One goal (G6/WP I-5, test-class noise) shipped without its fix — named open residual, not silently dropped. See §6 and changelog. Later ranks (Phase II+) not started — next pick per `WHERE_NEXT.md` is rank 7 (`D-outbound-java`), not this plan's own Phase II.

**Rules (locked):** Java → TS → Python; **cloud/K8s first**; hard-tests do not patch detectors in-session.

---

## 0. Evidence that drives Phase I

| Exam | Result | WDL |
|---|---|---|
| aws-saas-boost-**tier**-service | 0 services; handler **wrong-kind database**; DAL true DB | WDL-1, **WDL-2** |
| aws-saas-boost-**tenant**-service | 0 services; handler **invisible**; DAL true DB; test noise | **WDL-1** systematic; WDL-2 not required for *this* shape |

**Conclusion:** Implement **WDL-1 first** (makes handlers `service`). Then **WDL-2** (handler that imports Dynamo must not become `database`). Paths from CFN/SAM in same program (Y4) or immediately after unit kind is green.

Agent tasks already drafted: [`AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md`](./AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md) (Y0–Y6).

---

## 1. Phase map (implementation)

```text
Phase I   — WDL-1 + WDL-2 Java cloud (P0)     ← NEXT BUILD
Phase II  — WDL-3..5 cloud/k8s maintain + S3   (after I green on exams)
Phase III — WDL-6..9 Java app core             (Spring, outbound, Kafka, OAuth)
Phase IV  — WDL-10..13 Java breadth + Fluxnova
Phase V   — WDL-14..18 TS then Python
```

Do **not** start Phase III while Phase I exams fail.

---

## 2. Phase I — detailed (WDL-1, WDL-2)

### 2.1 Goals

| Goal | Pass criteria |
|---|---|
| G1 | `TenantService` / `TierService` → **service** units (not invisible / not database-only) |
| G2 | Gold paths present **or** honest S-flag until CFN join ships (prefer paths in same phase if cheap) |
| G3 | `DynamoTierDataStore` / `TenantServiceDAL` remain **database** |
| G4 | TierService **not** database solely due to Dynamo import when it is a handler |
| G5 | Architecture-grade **service→database** when dual-unit edge exists |
| G6 | Tests not preferred as database units (or excluded) |
| G7 | BoA / Fineract / Nest / Prisma regressions green |

### 2.2 Work packages (map to Y tasks)

| WP | WDL | Work | Agent task ref | Verify | Status |
|---|---|---|---|---|---|
| **I-0** | — | Design note + lab gold `java-lambda-apigw` (if not done) | T-Y1-* | Design answers both tier+tenant shapes | ✅ done — `Serverless_HTTP_and_Dynamo_Ownership_Design.md`, `coe-lab/fixtures/monorepo/packages/java-lambda-apigw/` |
| **I-1** | WDL-1 | Catalogue/signals: `RequestHandler`, `APIGatewayProxyResponseEvent`, handler method surface → `service` / http-entry | T-Y3-1 | tenant: ≥1 service unit for TenantService | ✅ done — `lambda-request-handler-implements` catalogue row, `serverless-entry-point` category |
| **I-2** | WDL-2 | Kind priority: http/handler beats bare Dynamo import | T-Y2-1 | tier: TierService not database; store still is | ✅ done — Dynamo-priority tie-break, `signal-mapper.ts` |
| **I-3** | WDL-1 | CFN/SAM path join (minimal API GW Method+Path+Handler) | T-Y4-1 | gold paths on interfaces (tenant+tier) | ✅ done — `cfn-manifest-provider.ts`/`cfn-route-pass.ts`, 5/5 real paths matched gold on the wild `aws-saas-boost-tier-service` repo |
| **I-4** | WDL-1 UX | Silence when 0 services but Dynamo-only / or infra hints | T-Y5-1 | silenceFlags non-empty on pre-fix artefact class | ✅ done — S5 silence flag (`coverage-report.ts`), closes HT-ASB-006 |
| **I-5** | noise | Test path exclusion for Dynamo import units | with I-2 | *Test not database (or low-noise) | ❌ **not built** — no test-path exclusion mechanism exists in `src/`; open as HT-ASB-003 (test noise) / HT-ASB-004 (method-as-unit noise), named not silently dropped |
| **I-6** | exam | Re-run tier + tenant hard-test protocols; update findings | T-Y5-2 | L1 service+paths improve; L2 story path | ✅ done — both standing exams (`E-fidelity-lambda-lab`, `E-saas-boost-tier`) re-run fresh, PASS |

### 2.3 Suggested agent sessions

| Session | WP | Notes |
|---|---|---|
| S1 | I-0 | Docs/lab only |
| S2 | I-1 + I-2 + I-5 | Kind + handler service |
| S3 | I-3 | Path join |
| S4 | I-4 + I-6 | Silence + exam close |

### 2.4 Non-goals for Phase I

- Fluxnova, GraphQL, Feign, Prethink parity  
- Multi-service saas-boost multi-root (optional regression only)  
- EventBridge as first-class network (tenant uses it; leave OOS unless free)

---

## 3. Later phases (thin)

| Phase | WDL ranks | Trigger to start |
|---|---|---|
| **II** | 3–5 k8s, S3, SQS | Phase I L1 green on tier+tenant |
| **III** | 6–9 Spring, **Java outbound**, Kafka, OAuth | Hard-test calm-hub / Spring or product ask |
| **IV** | 10–13 Rabbit, Redis, GraphQL, Fluxnova | Sample + pilot |
| **V** | 14–18 TS then Python | After Java P0–P1 stable |
| **Prethink pick-up** | separate | Explicit owner reopen — not auto-expand WDL |

---

## 4. Hard-test queue vs implement

| Mode | Action |
|---|---|
| **Implement now** | Phase I only; use tier+tenant as standing exams |
| **More hard-tests first** | Optional: calm-hub (WDL-6) — not required before Phase I |
| **Do not** | Patch detectors during hard-test sessions |

**Standing exams for Phase I exit:**

1. `aws-saas-boost-tier-service`  
2. `aws-saas-boost-tenant-service`  
3. Lab `java-lambda-apigw` (when exists)  
4. Regression: BoA, Nest, Fineract charge single/multi, Prisma ontology

---

## 5. Claim / backlog updates on Phase I ship

| Artefact | Update |
|---|---|
| Claim **U-http-serverless** | `specified-unbuilt` → `partial` (then proven when paths+exams green) |
| **B-lambda-http**, **B-dynamo-handler-kind** | `todo` → `done` / partial with residuals |
| HT-ASB-001…007 | closed or residual-named in findings |
| WDL ranks 1–2 | marked built in WHERE_NEXT |

---

## 6. Owner checkpoint

- [x] Hard-test #2 tier-service  
- [x] Hard-test #3 tenant-service (generalizes WDL-1)  
- [x] Owner: **go implement Phase I** — executed as Y0-Y6, CLOSED 2026-08-08  
- [x] G1-G5, G7 shipped and regression-verified; **G6 (I-5, test-class noise) shipped without its fix** — real, named residual (HT-ASB-003/004), not a silent gap  

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Plan written after hard-test #3 tenant-service; Phase I = WDL-1/2 Java cloud |
| 2026-08-09 | **Phase I CLOSED** — verified against real code/docs, not re-asserted from this plan. WP I-0/I-1/I-2/I-3/I-4/I-6 all confirmed built with real evidence (5/5 gold-path match on the wild `aws-saas-boost-tier-service` repo, both standing exams PASS, full regression suite green). **WP I-5 confirmed NOT built** — no test-path exclusion exists in `pipeline/src/`; this is `HT-ASB-003`/`HT-ASB-004`, both already correctly named "still open" in `STATUS.md`, not a newly-found gap. Phases II-V not started, as the plan's own rule required (Phase I exams had to go green first) — but `WHERE_NEXT.md` has since converged on rank 7 (`D-outbound-java`/`B-http-client`) as the actual next pick, not this plan's own Phase II (k8s/S3/SQS). See `WHERE_NEXT.md` §2.1/§4 for current ladder state. |
