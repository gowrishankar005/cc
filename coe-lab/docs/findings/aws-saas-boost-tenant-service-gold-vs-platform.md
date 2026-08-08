# Finding: aws-saas-boost-tenant-service gold vs platform

**Package-id:** `aws-saas-boost-tenant-service`  
**Date:** 2026-08-08  
**Hard-test #:** 3 (WDL-aligned: Java cloud)  
**Source:** [awslabs/aws-saas-boost](https://github.com/awslabs/aws-saas-boost) — `services/tenant-service`  
**Gold:** `coe-lab/gold/calm/aws-saas-boost-tenant-service/architecture.calm.json`  
**Generated:** `tmp/coe-lab-hard-tests/aws-saas-boost-tenant-service/`  
**Track:** hard-test eval only — no platform code changed this session.  
**WDL:** confirms **WDL-1** (Lambda HTTP); refines **WDL-2** (Dynamo ownership — cleaner split than tier-service).

---

## 0. Scope

Same SaaS control-plane family as hard-test #2 (tier-service), different package:

| Class | Role | Dynamo import? |
|---|---|---|
| `TenantService` | Lambda `RequestHandler` + API GW methods (`getTenants`, …) | **No** — constructs `TenantServiceDAL` only |
| `TenantServiceDAL` | DynamoDB store (`DynamoDbClient`, `TENANTS_TABLE`) | **Yes** |

**Why this package after tier-service:** disconfirm “Lambda miss is one-off”; separate **handler ontology** (handler never imports Dynamo) from **store detection**.

**Gold HTTP surface** (public API CFN + svc-tenant Handlers):  
`GET/POST /tenants`, `GET/PUT/DELETE /tenants/{id}`, `PATCH /tenants/{id}/enable|disable`.

---

## 1. Scorecard

| Layer | Gold | Generated | Verdict |
|---|---|---|---|
| **L0** | schema-valid hand gold | **PASS** (`calm validate` 0 errors) | OK |
| **L1 service** | 1 service + 7 path interfaces | **0 service units**; `TenantService` **invisible** | **FAIL** |
| **L1 database** | 1 store (`TenantServiceDAL`) | **2 database units:** DAL ✅ + `TenantServiceDALTest` ❌ | Partial true + **test noise** |
| **L2** | 1 `service→database` connects | **0** architecture service→db; only structural **test→DAL** | **FAIL** gold story |
| **L3 silence** | missing HTTP should be loud | `serviceUnitCount=0`, `databaseUnitCount=2`, **`silenceFlags: []`** | **No S1** (same class as HT-ASB-006) |

### Platform run metrics

| Metric | Value |
|---|---|
| Units | 2 (both `database`, conf 20) |
| Relationships | 1 structural (`TenantServiceDALTest` → `TenantServiceDAL`) |
| Native routes | **0** |
| Decorator facts | 14 (not forming service units) |
| Graphify | ok |
| Dynamo on DAL | **Yes** |
| EventBridge client on handler | not architecture-typed (OOS this gold) |

---

## 2. Strengths

1. **WDL-1 generalized:** second SaaS Boost Lambda package, same empty HTTP story — not tier-service one-off.  
2. **DAL correctly database** via Dynamo SDK import.  
3. **Cleaner ontology case:** handler does **not** import Dynamo → not mis-kinded as database (contrast tier-service HT-ASB-002). Handler is simply **missing**, not wrong-kind.  
4. Schema-valid CALM; run completes.

---

## 3. Weaknesses / issues

| ID | Class | Observation | vs tier-service |
|---|---|---|---|
| **HT-ASB-001** | Lambda HTTP | No `RequestHandler` / API GW path → 0 services; gold paths absent | **Reproduced** |
| **HT-ASB-002** | Handler as database | N/A here — handler has no Dynamo import | **Not reproduced** (good split) |
| **HT-ASB-003** | Test noise | `TenantServiceDALTest` → database | **Reproduced** |
| **HT-ASB-005** | Architecture edge | No service→DAL connects | **Reproduced** (no service end) |
| **HT-ASB-006** | Completeness UX | silenceFlags empty despite 0 services | **Reproduced** |
| **HT-ASB-007** (new nuance) | Invisible handler | Service class with **no** persistence import and **no** HTTP catalogue hit → **zero units** (falls out of TypedFacts entirely) | New relative to tier (there handler was wrong-kind DB unit) |

### RCA

```text
Gold: TenantService (service) → TenantServiceDAL (database)
Platform:
  - HTTP: no framework routes → no service unit for TenantService
  - Dynamo: only classes importing DynamoDbClient become units → DAL + Test
  - TenantService: no route, no Dynamo import → not a unit at all
  - Edge test→DAL only (structural); no architecture service→db
Same systematic class as tier-service HT-ASB-001/003/005/006;
HT-ASB-002 is shape-specific to handler-that-imports-Dynamo
```

---

## 4. Gold vs platform (semantic)

| Gold | Platform |
|---|---|
| TenantService **service** + 7 paths | Missing entirely |
| TenantServiceDAL **database** | Present |
| service→database connects | Missing |
| (no test nodes) | Test class as database |

---

## 5. Claim language

| Forbidden | Allowed |
|---|---|
| “SaaS Boost Lambda services recovered” | “Dynamo DAL import detected; Lambda RequestHandler HTTP still not” |
| “Handler mis-kind only blocks Lambda story” | “Even when handler is not mis-kinded as DB, it stays invisible without WDL-1” |

---

## 6. WDL impact

| WDL | Impact of this exam |
|---|---|
| **WDL-1** | **Confirmed systematic** on 2/2 SaaS Boost services → implement B-lambda-http |
| **WDL-2** | Still needed for **tier-service** shape; tenant shows **invisible handler** is enough to kill story even when ownership is “clean” |
| **WDL-3+** | Unchanged |

---

## 7. Follow-ups

- Product: **B-lambda-http**, **B-dynamo-handler-kind** (tier shape), test exclusion strengthen  
- Eval: optional multi-service later; next WDL hard-test can move to calm-hub (Java REST) after implement plan lock  
- Implementation plan: `docs/solution/WDL_Implementation_Plan.md`
