# CoE Lab baselines (locked measurement)

**Baselined:** 2026-08-07 (post-MVP platform, `CONTRACT_VERSION` **4.0.0**)  
**Updated:** 2026-08-07 — full CALM gold switched from generator-bootstrap to **hand-authored**; Wave 1 claim honesty + Fineract finding recorded  
**Pipeline:** rebuild + full re-run of `run-slice` per package  
**Semantic scorer:** `score-calm.mjs` v0.1.2  
**Full CALM gold:** hand-authored `gold/calm/<pkg>/architecture.calm.json` (calm validate 0 errors / 0 warnings)  
**Validate layers:** see `validation-approach-vnext.md` — lab core **L0+L1** semantic PASS is **not** Fineract **L2** story pass  
**Fineract wild gold:** L0 pass; L1 strong; **L2 story FAIL** on current platform — `fineract-gold-vs-platform-finding.md`  
**Validate:** `validate-calm-pair.mjs --all-core` → lab core L1-style semantic PASS + schemaOk (independent gold)

---

## How this baseline was produced

```bash
cd pipeline && npm run build
# hand-author gold/calm from fixtures → calm validate --all-gold --gold-only
# per package: run-slice → score-calm vs gold/packages
node coe-lab/scripts/generate-calm.mjs --all-core
node coe-lab/scripts/validate-calm-pair.mjs --all-core
node coe-lab/scripts/scoreboard.mjs
```

`eval-results/` and `generated/` are gitignored (local regenerate).  
**Committed gold:** `gold/packages/*.gold.json` + hand-authored `gold/calm/**/architecture.calm.json`.

---

## Semantic scores (gold/packages)

### Core / trap (enforced gates)

| package | pass | node P/R | iface R | rel R | ctrl# | viol |
|---|---|---|---|---|---|---|
| py-accounts-api | **true** | 1/1 | 1 | 1 | 0 | 0 |
| py-ledger-worker | **true** | 1/1 | 1 | 1 | 0 | 0 |
| py-multi-root | **true** | 1/1 | 1 | 1 | 0 | 0 |
| ts-nestjs-users | **true** | 1/1 | 1 | 1 | 0 | 0 |
| java-jaxrs-charges | **true** | 1/1 | 1 | 1 | 0 | 0 |
| java-spring-payments | **true** | 1/1 | 1 | 1 | 0 | 0 |
| java-rbac-datatable | **true** | 1/1 | 1 | 1 | **2** | 0 |
| lib-fintech-common | **true** | 1/1 | 1 | 1 | 0 | 0 |

### Stretch / trust

| package | pass* | node P/R | notes |
|---|---|---|---|
| java-kafka-settlement | true | **1/1** | `@KafkaListener` → `network` unit (gold v0.2.0). Producer path still open. |
| py-jwt-gateway | true | 1/1 | Routes yes; call-based JWT controls still 0 |
| deploy-k8s-trust | true | 1/1 | **1** shares-secret edge (rel R=1) |
| ts-orders-dynamo | true* | 1/**0** | **0 units** — Dynamo/SQS still not architecture units |

\*stretch node P/R is **report-only** (does not fail gate on low recall).

---

## Full CALM validation (hand-authored gold vs generated)

| package | gold calm validate | gen calm validate | semantic match |
|---|---|---|---|
| py-accounts-api | true (0w) | true | true |
| py-ledger-worker | true (0w) | true | true |
| ts-nestjs-users | true (0w) | true | true (~extra openapi service) |
| java-jaxrs-charges | true (0w) | true | true |
| java-spring-payments | true (0w) | true | true |
| java-rbac-datatable | true (0w) | true | true |
| lib-fintech-common | true (0w) | true | true |

Stretch packages also have hand-authored gold under `gold/calm/` (kafka, jwt-gateway, dynamo, k8s-trust, multi-root) — all pass `calm validate` independently.

---

## Platform performance snapshot (this baseline)

| Area | Lab verdict |
|---|---|
| HTTP + persistence (Flask, Nest, Spring, JAX-RS) | Strong |
| Decorator RBAC (`@PreAuthorize`) | Strong (2 controlled nodes) |
| Multi-root Python | Strong |
| Utility trap | Strong |
| Kafka **consumer** | Detected (network) |
| K8s shared-secret trust | Detected |
| Kafka **producer** / Dynamo architecture units | Still weak / open |
| Call-based JWT controls | Still open |

---

## Gold updates in this baseline

| File | Change |
|---|---|
| `gold/packages/java-kafka-settlement.gold.json` | v0.2.0 — expect `network`/`SettlementListener` (not dual service+topic) |
| `gold/calm/*` | **Hand-authored** CALM 1.2 from fixture source; bootstrap/SOT-from-generator removed |

---

## Re-baseline checklist (next time)

1. `cd pipeline && npm run build`  
2. Re-run all packages + multi-root + k8s (this doc’s commands)  
3. If **intended architecture** changed: edit fixture + hand-update `gold/calm/` + `calm validate`  
4. If only **platform emission** changed: regenerate `generated/`, re-run semantic compare — do **not** overwrite gold from generator  
5. Update this file’s date and tables  
6. Keep wild-type: `cd pipeline && npm test`  
