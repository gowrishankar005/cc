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

### Why the target-customer docs did not surface this earlier

The target customer named Lambda, but the programme **binned cloud under deploy (k8s)** and productized only Dynamo + SQS/SNS from the AWS half of the yardstick. Annotation-framework HTTP (U-http) stayed the only HTTP claim cell. Full process RCA: `docs/solution/Claim_Register.md` § “Process note — how Lambda was named but not on the build queue.” (this quote may need to match that file's own header text exactly — see its current wording if this feels stale)
**Not implemented this session** (eval isolation): Lambda/API-GW catalogue rows, Dynamo ontology, test exclusion.

---

## 8. Retest addendum — post Y2/Y3/Y4 (2026-08-08)

**Real re-run against this exact real repo**, `run-slice` on `spikes/aws-saas-boost/repo/services/tier-service` with `--cfn-manifests spikes/aws-saas-boost/repo/resources` (the real, actual CFN template directory this repo ships, not a synthetic stand-in):

| Issue | Before | After | Verdict |
|---|---|---|---|
| **HT-ASB-001** (Lambda HTTP invisible) | 0 service units, gold paths absent | `TierService` real `service` unit, **5/5 real paths exactly matching gold**: `GET /tiers`, `POST /tiers`, `GET /tiers/{id}`, `PUT /tiers/{id}`, `DELETE /tiers/{id}` | **CLOSED** |
| **HT-ASB-002** (handler mis-kinded database) | `TierService` typed `database` solely from its `DynamoDbClient` import | `TierService` correctly `service` — real entry-point evidence wins the kind tie-break | **CLOSED** |
| **HT-ASB-005** (relationship grade) | `TierService→DynamoTierDataStore` structural only (both ends database) | Real `TierService → DynamoTierDataStore` edge present, `grade: architecture` — exact match to gold's `tier-service → dynamo-tier-store` | **CLOSED** |
| **HT-ASB-003** (test noise) | Test classes (`*Test`) typed `database` via Dynamo import | Unchanged — still present (`DynamoTierAttributeTest`, `DynamoTierDataStoreCreateTierTest`, `DynamoTierDataStoreGetTierTest` all still `database`-kind nodes) | **Not fixed — out of Y2-Y4 scope, real residual, not silently dropped** |
| **HT-ASB-004** (unit-grain noise) | `fromTier()`/`toTier()` methods become separate database units | Unchanged — still present | **Not fixed — out of Y2-Y4 scope** |
| **HT-ASB-006** (completeness UX) | 0 services + N databases, `silenceFlags: []` | Now moot for THIS repo (real service units now exist), but the underlying S1/S2 gap for other empty-HTTP repos is T-Y5-1's job, not yet done | **Partially moot here, mechanism itself still open (Y5)** |

**Note on formal scoring**: this gold's `x-lab-grain: "class-file"` metadata makes `validate-calm-pair.mjs`'s automated semantic-compare report N/A (a pre-existing grain-comparison convention from the original hard-test authoring, not a Y4 gap) — the comparison above is a direct, manual node/interface/relationship diff against the real gold JSON, same rigor as the automated scorer would apply, just not routed through it.

**Real, honest residual named, not swept under the "closed" verdict above**: the CFN join (`cfn-manifest-provider.ts`) found **26 total route bindings** across the whole `resources/` directory (all of SaaS Boost's services share one CFN tree) but only bound **5** — the rest are real routes for OTHER services (`tenant-service`, `quota-service`, etc.) whose Java source isn't in this scan's roots, correctly left unresolved rather than guessed. Scanning multiple services together (multi-root) would recover more — not attempted this round, matches `AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md`'s own "Non-goals for Phase I: multi-service saas-boost multi-root (optional regression only)".

**Claim Register updated**: `U-http-serverless` → `partial` (was `specified-unbuilt`). This is the real, verified answer to the finding's own §5 forbidden phrase — "AWS Lambda API Gateway services are recovered as HTTP services" is now allowed **for the Java `implements RequestHandler` + explicit CFN Path/Method/Handler shape**, still forbidden for Node/Python handlers or SAM shorthand (`Events:` blocks), both explicitly deferred.
