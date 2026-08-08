# Finding: gold CALM relationship-connectivity audit

**Scope:** all 19 packages under `coe-lab/gold/calm/*/architecture.calm.json` (both `gold/calm/` full CALM and `gold/packages/*.gold.json` semantic gold).
**Date:** 2026-08-09
**Track:** gold-authoring audit only — no platform code read or changed, no gold files edited yet.
**Trigger:** direct question — "most of the CALM jsons don't have their nodes connected, they're pretty much standalone; how did the hand-authored ones end up this way?"

---

## 0. Method

For every `gold/calm/*/architecture.calm.json`, computed which nodes are reachable by a **real architectural edge** (`connects` or `interacts`) versus only reachable via a **grouping/boundary edge** (`composed-of`, `deployed-in`). A node touched only by `composed-of` into its package's `lab-system` container was *not* counted as a bug — that edge exists purely to satisfy CALM's "every node should be referenced" convention, not to assert an architectural relationship. Cross-checked every apparent gap against:

1. The governing semantic gold at `coe-lab/gold/packages/<id>.gold.json` (the actual spec `gold/calm/` is authored against).
2. `coe-lab/gold/calm/FINERACT_GOLD.md`, `coe-lab/docs/wild-type-gold-policy.md`, `coe-lab/docs/package-catalog.md` for any documented grain/scope decision that would make sparse connectivity intentional.
3. Git blame (`git log --diff-filter=A`) to see whether related files were authored together or drifted apart over time.

## 1. Result table

| Package | Nodes | Real edges (connects/interacts) | Verdict |
|---|---|---|---|
| `java-jaxrs-charges` | 2 (+system) | **0** | **BUG** — see §2 |
| `java-spring-payments` | 2 (+system) | **0** | **BUG** — see §2 |
| `java-rbac-datatable` | 2 (+system) | 0 | OK — intentional, see §3.1 |
| `lib-fintech-common` | 0 | 0 | OK — intentional "trap" tier, see §3.2 |
| `fineract-core` | 12 (+system) | 2 | OK — intentional, see §3.3 |
| `fineract-system-map` | 24 (+system) | 5 | OK — intentional, see §3.4 |
| `maven-doxia-system-map` | 8 (+system) | 3 | OK — intentional, same class as §3.4 |
| `py-jwt-gateway` | 1 (+system) | 0 | OK — single unit, nothing to connect |
| `ts-nestjs-users` | 1 (+system) | 0 | OK — single unit, nothing to connect |
| `fineract-charge` | 2 (+system) | 1 | OK — has the edge (this is `java-jaxrs-charges`'s wild-type twin) |
| `fineract-charge-provider` | 2 (+system) | 1 | OK |
| `java-kafka-settlement` | 2 (+system) | 2 | OK |
| `java-lambda-apigw` | 3 (+system) | 1 | OK |
| `deploy-k8s-trust` | 2 (+system) | 1 | OK |
| `py-accounts-api` | 2 (+system) | 1 | OK |
| `py-ledger-worker` | 2 (+system) | 1 | OK |
| `py-multi-root` | 4 (+system) | 2 | OK |
| `ts-orders-dynamo` | 3 (+system) | 2 | OK |
| `aws-saas-boost-tenant-service` | 2 (+system) | 1 | OK |
| `aws-saas-boost-tier-service` | 2 (+system) | 1 | OK |

**Net: 2 of 19 packages have a real, unexplained connectivity gap.** The rest of the "standalone-looking" nodes the eyeball scan flags are either single-node packages (nothing to connect) or module/entity-grain gold that is *documented* as deliberately partial.

---

## 2. The real bug: `java-jaxrs-charges` and `java-spring-payments`

Both packages model an HTTP service node plus **its own** persistence entity node in the same fixture (`charges-api`/`charge-entity`; `payments-api`/`payment-entity`) — the single most obvious case for a `connects` edge, and exactly the shape every other API+DB pair in this gold set (`py-accounts-api`, `py-ledger-worker`, `py-multi-root`, `ts-orders-dynamo`, `aws-saas-boost-*`, and `java-jaxrs-charges`'s own wild-type twin `fineract-charge`) *does* connect. Neither does.

### Root cause, confirmed at the spec level

The full CALM under `gold/calm/` is not where the gap originates — it correctly mirrors its governing semantic gold at `gold/packages/*.gold.json`. The gap is one level up, in that semantic gold:

```json
// gold/packages/java-jaxrs-charges.gold.json
"relationships": []

// gold/packages/java-spring-payments.gold.json
"relationships": []
```

versus the structurally identical Python pairs, authored **in the same commit**:

```json
// gold/packages/py-accounts-api.gold.json
"relationships": [{ "from": "accounts-api", "to": "accounts-db", "kind": "connects" }]

// gold/packages/py-ledger-worker.gold.json
"relationships": [{ "from": "ledger-api", "to": "ledger-db", "kind": "connects" }]
```

All five files (`py-accounts-api`, `py-ledger-worker`, `java-jaxrs-charges`, `java-spring-payments`, and the `gold/calm/` files under them) trace to the same commit, `32f496f` ("Advance platform to modular pipeline, CoE lab gold, and claim-honesty program", 2026-08-07) — so this isn't stale drift between an old and a new authoring pass. It's a same-session, **cross-language inconsistency**: the Python core-tier packages got the obvious same-package API→DB edge, the Java core-tier packages with the identical shape didn't.

Nothing in `package-catalog.md`, `FINERACT_GOLD.md`, or `wild-type-gold-policy.md` calls this out as an intentional scope decision the way it does for the packages in §3 below — there is no `x-lab-*` metadata key, `outOfScope` entry, or `expectedPlatformGaps` note explaining why these two specifically should stay disconnected. `java-jaxrs-charges.gold.json`'s own description — `"JAX-RS routes + JPA entity database"` — names both halves of the pair as in-scope coverage, which argues the relationship between them was meant to be modeled and simply wasn't.

**This looks like a real authoring omission, not a documented design choice.** Recommended fix (not applied in this pass — this is a findings write-up, not a gold edit):

- `gold/packages/java-jaxrs-charges.gold.json` → add `{"from": "charges-api", "to": "charge-entity", "kind": "connects"}`
- `gold/packages/java-spring-payments.gold.json` → add `{"from": "payments-api", "to": "payment-entity", "kind": "connects"}`
- Mirror both into the corresponding `gold/calm/*/architecture.calm.json` `relationships` array (see `gold/calm/fineract-charge/architecture.calm.json`'s `charges-api-connects-charge-entity` entry as the template — description + `protocol: "JDBC"`).
- Re-run `calm validate` on both after editing.

## 3. Confirmed-intentional sparsity (not bugs)

### 3.1 `java-rbac-datatable`

`datatable-write-service` (a pure `@PreAuthorize`-annotated interface, no HTTP route) and `account-read-api` (an unrelated Spring controller) are two **independent** RBAC control-detection examples bundled into one fixture — not two components that call each other in real Fineract. Confirmed against the governing semantic gold: `"relationships": []` plus `"expectControls": true` / `"controlNotes": "At least one service node should carry CALM controls..."` — the fixture's entire purpose is control-evidence coverage, not architectural connectivity. Correctly disconnected.

### 3.2 `lib-fintech-common`

`package-catalog.md` lists this as tier `core trap` with the explicit note **"zero service nodes"** — an intentional negative-test fixture (proves the pipeline doesn't hallucinate architecture from a pure library with no HTTP/persistence surface). Zero nodes, zero edges, by design.

### 3.3 `fineract-core`

13 nodes, only 2 `connects` edges (`business-date-api`↔`business-date-entity`, `payment-type-api`↔`payment-type-entity`). The other 9 nodes are orphaned, but the gold's own metadata explains why:

```json
{"key": "x-lab-coverage", "value": "all-ApiResource-in-module + DatatableWriteService + representative entities (BusinessDate, PaymentType, AccountNumberFormat, Client)"},
{"key": "x-lab-out-of-scope", "value": "Remaining core @Entity classes; call-based auth via PlatformSecurityContext.validateHasReadPermission (not @PreAuthorize)"}
```

`account-number-format-entity` and `client-entity` are "representative entities" included for entity-typing coverage, but their real owning API resources (`AccountNumberFormatApiResource`, `ClientApiResource`, etc.) were never added as nodes in this slice — so there is no legitimate node to connect them to without inventing one. `batch-api`, `cache-api`, `external-event-config-api`, `internal-external-events-api`, `currencies-api`, `datatable-write-service` are real Fineract API resources included for route/control coverage whose backing entities were likewise left out of this representative slice. This is a disclosed coverage-scope decision (`FINERACT_GOLD.md`: *"documents remaining entities as out-of-scope"*), not an omitted edge.

### 3.4 `fineract-system-map` and `maven-doxia-system-map`

Both are **module-grain** gold (Gradle/Maven modules as nodes, not classes) — a fundamentally different grain from every other package in this set. `FINERACT_GOLD.md` states the purpose directly: *"Gradle modules as nodes... Monorepo topology **without inventing every class**."* `wild-type-gold-policy.md` §Authoring rules: *"Document grain (class vs module) — system-map is module grain."*

`fineract-system-map` models only 5 of the ~20 plausible "every domain module depends on `mod-core`" edges (real Gradle `build.gradle` dependencies that almost certainly exist for `mod-security`, `mod-loan-origination`, `mod-accounting`, etc. too) — this is a deliberately **representative**, not exhaustive, sample of monorepo topology, matching the same policy that governs `fineract-core`'s entity sparsity. `maven-doxia-system-map` is the same grain (`x-lab-grain: maven-module`), confirmed in `docs/findings/maven-doxia-system-map-gold-vs-platform.md` §0, which explicitly frames it as module-grain gold for a non-fintech disconfirming sample.

### 3.5 Single-node packages (`py-jwt-gateway`, `ts-nestjs-users`)

Each has exactly one real architectural unit (`jwt-gateway`, `users-api`) plus the `lab-system` container. There is nothing else in the package for that one node to connect *to* — the "orphan" reading is an artifact of the eyeball scan counting `lab-system` as a node, not a real gap.

---

## 4. Summary

The instinct that "most of these gold files look standalone" is correct as a raw count (13 of 20 `gold/calm/` files have more nodes touched only by `composed-of` than by a real edge), but **only 2 of those 13 are unexplained** — the rest are either genuinely single-node packages or module/entity-grain gold whose sparsity is named and justified in this project's own policy docs (`FINERACT_GOLD.md`, `wild-type-gold-policy.md`, `package-catalog.md`, per-package `x-lab-*` metadata). The real, actionable gap is narrow and specific: **`java-jaxrs-charges` and `java-spring-payments` are missing the same-package API→entity `connects` edge that every structurally identical sibling package has**, and the omission traces to the semantic gold (`gold/packages/*.gold.json`), not to `gold/calm/` itself.

## 5. Not done in this pass

- Gold files were **not edited** — this is a findings write-up only, per the user's read-only-then-write-back-on request flow this session.
- `calm validate` was not re-run (no edits made yet).
- `java-kafka-settlement`'s two `connects` edges are both `settlement-service → settlement-completed-topic` (consume + publish) — technically two separate relationship records for the same node pair. Not flagged as a bug (real Kafka listener+publisher shape, matches `x-lab-fixture` description), but worth a second look if a future pass tightens gold-authoring lint rules (e.g. should consume/publish collapse to one bidirectional edge or stay two directional ones — CALM has no directionless "topic" relationship type, so two `connects` may be the only faithful representation).
