# Finding: aws-saas-boost-tier-service gold vs platform

**Package-id:** `aws-saas-boost-tier-service`  
**Date:** 2026-08-08  
**Source:** [awslabs/aws-saas-boost](https://github.com/awslabs/aws-saas-boost) — `services/tier-service`  
**Gold:** `coe-lab/gold/calm/aws-saas-boost-tier-service/architecture.calm.json`  
**Generated:** `tmp/coe-lab-hard-tests/aws-saas-boost-tier-service/`  
**Track:** hard-test eval only — no platform code changed this session.

---

## 0. Scope (why this package)

AWS SaaS Boost is a **fintech-adjacent multi-tenant SaaS control plane** (tenant onboarding, tiers, settings, Cognito/API Gateway, DynamoDB).  

**Deep slice:** `tier-service` only — Lambda `RequestHandler` + API Gateway `/tiers*` + DynamoDB store. High relevance to cloud SaaS; **different HTTP shape** from Spring/JAX-RS (no route annotations in Java).

---

## 1. Scorecard

| Layer | Gold | Generated | Verdict |
|---|---|---|---|
| **L0** | PASS (after protocol field fixed) | PASS (0 errors) | OK |
| **L1 service** | 1 service (`TierService`) + 5 path interfaces | **0 service nodes**; TierService typed **`database`** | **FAIL** service; **wrong kind** on handler |
| **L1 database** | 1 store (`DynamoTierDataStore`) | **9 database units** including store, TierService, model helpers, **tests**, methods | Partial true positive + **noise / wrong positives** |
| **L2** | 1 `service→database` connects | **0 architecture-grade service→db**; structural db↔db / imports only | **FAIL** gold story |
| **L3 silence** | expect incomplete HTTP if services missing | **No S1** (needs service+db; has only db) | Incomplete loudness for “no service surface” |

### Platform run metrics

| Metric | Value |
|---|---|
| Units | 9 (all `database`, conf 20) |
| Relationships | 10 (all structural) |
| Native routes | **0** |
| Graphify | ok; dual-unit edges among persistence units |
| DynamoDbClient import detection | **Yes** (`software.amazon.awssdk.services.dynamodb`) |

---

## 2. Strengths

1. **Java AWS SDK v2 DynamoDB import is detected** (catalogue row `software.amazon.awssdk.services.dynamodb`) — real persistence signal on a fintech-shaped SaaS service.  
2. **DynamoTierDataStore** correctly becomes a database-class unit.  
3. Structural graph among DDB model/store classes is recovered (Graphify + dual-unit).  
4. Run completes; generated CALM schema-valid.  
5. **High product relevance** vs Doxia: SaaS control plane + Dynamo is in fintech/cloud SaaS yardstick.

---

## 3. Weaknesses / issues (mechanism class)

| ID | Class | Observation |
|---|---|---|
| **HT-ASB-001** | HTTP / Lambda entry | **No detection** of `RequestHandler` / `APIGatewayProxyResponseEvent` as http-entry-point → 0 `service` units; gold paths never appear |
| **HT-ASB-002** | Ontology / kind | **TierService mis-typed as `database`** solely because it imports `DynamoDbClient` (same file constructs the store) — inverse of Prisma “import ≠ owner” but here **handler is not a store** |
| **HT-ASB-003** | Test noise | Test classes (`*Test`) become **database** units via Dynamo imports |
| **HT-ASB-004** | Unit grain noise | Methods `fromTier()` / `toTier()` become separate database units via contains walk |
| **HT-ASB-005** | Relationship grade | `TierService → DynamoTierDataStore` edge exists as **structural** (both ends database-kind), not **architecture** service→db |
| **HT-ASB-006** | Completeness UX | With only databases and no services, **S1 does not fire**; missing HTTP surface is not loud |

### RCA (HT-ASB-001/002/005 — systematic)

```text
Gold story: service (Lambda API) → database (Dynamo store)
Platform:
  - HTTP: no Spring/JAX-RS → no native routes / no service units
  - Persistence: DynamoDbClient import → database units for ANY class importing SDK
  - TierService imports DynamoDbClient → typed database (not service)
  - Dual-unit edge TierService→DynamoTierDataStore: both database → grade structural
  - No service endpoint → no architecture-grade service→db story
Not root cause: calm-builder; Graphify missing entirely; gold circularity
```

---

## 4. Gold vs platform (semantic)

| Gold | Platform |
|---|---|
| TierService **service** + GET/POST/PUT/DELETE `/tiers` | Missing as service; **no path interfaces** |
| DynamoTierDataStore **database** | Present among 9 DBs |
| service→database connects | Missing architecture story; structural import edge only |

---

## 5. Claim language

| Forbidden without caveats | Allowed |
|---|---|
| “AWS Lambda API Gateway services are recovered as HTTP services” | “DynamoDB Java SDK v2 **import** persistence is detected; **Lambda RequestHandler HTTP is not**” |
| “Any class importing DynamoDbClient is a database store” | “Driver-import is coarse; handlers that construct clients can be mis-typed as database” |

---

## 6. Comparison to Doxia hard-test

| | Doxia | SaaS Boost tier-service |
|---|---|---|
| Product fit | Out of fintech app scope | **In** SaaS/fintech control-plane scope |
| Empty? | Fully empty | **Partial** — persistence yes, service wrong/absent |
| Value | Negative control | **Positive + gap** on cloud serverless shape |

---

## 7. Follow-ups

See `coe-lab-hard-test-backlog.md` HT-ASB-*.

**Promoted to product (2026-08-08):** HT-ASB-001 → `docs/solution/BACKLOG.md` **B-lambda-http**; HT-ASB-002 → **B-dynamo-handler-kind**. Claim Register: **U-http-serverless** (`specified-unbuilt`). This finding remains the standing exam evidence, not CoE-only noise.

### Why Fidelity docs did not surface this earlier

Fidelity named Lambda, but the programme **binned cloud under deploy (k8s)** and productized only Dynamo + SQS/SNS from the AWS half of the yardstick. Annotation-framework HTTP (U-http) stayed the only HTTP claim cell. Full process RCA: `docs/solution/Claim_Register.md` § “Process note — how Lambda was in Fidelity but not on the build queue.”
**Not implemented this session** (eval isolation): Lambda/API-GW catalogue rows, Dynamo ontology, test exclusion.
