# Weaver — Project Overview

**Weaver** is a deterministic Architecture-as-Code pipeline. It reads a real Java / Python / Node-TypeScript monorepo and emits schema-valid [FINOS CALM 1.2](https://calm.finos.org) JSON — services, stores, topics, routes, persistence, security controls, and the relationships between them — with file:line evidence on every claim.

It is **not** an LLM architecture generator, not a CALM governance product, and not a detector tuned to any one sample repo. Public repos (Fineract-shaped banking, Waltz-shaped governance, etc.) are evidence samples used to prove or falsify a generic mechanism.

---

## Two peer goals

| Goal | Meaning |
|---|---|
| **Platform** | A modular analyser whose downstream consumers only ever see a versioned `typed-facts.json` contract |
| **CALM construction** | The first module on that contract — proof the boundary is real, not the whole product |

A second module (`threat-signals`) already consumes only that contract. A green-engineering / resilience / lineage lens is sketched as the same shape, not built.

**Hard rule:** no LLM in the core generation path (`OOS-llm-core-path`, revisit trigger: never). An offline `suggest-rules` CLI can propose catalogue rows; a human promotes them. Residual review is also offline.

---

## How a run actually works

```
package roots
    → Scanner (CodeGraph per root + one combined Graphify pass + structured-file providers)
    → Analysis passes (ordered registry, shared context)
    → typed-facts.json   ← versioned contract (currently 11.0.0)
    → Module registry (calm-generator, threat-signals, …)
    → architecture.calm.json + IR + coverage + unmapped + provenance
```

**Scanner is dual-engine on purpose.** CodeGraph is good at per-package native routes and `extractFromSource()` decorator/annotation/call/extends facts. Graphify is the cross-package structural backbone — it must run **once** across all given roots, not once per root, or cross-package edges are impossible by construction. That was a real, load-bearing bug that was found and fixed.

Structured-file providers cover what neither engine can see: Kubernetes manifests (Secret **names** only — never values), OpenAPI/Swagger, Spring `application.yml`/`.properties`, CloudFormation/SAM path joins, CycloneDX SBOMs (corroboration only, never primary detection).

**Analysis is a pass list**, not a hardcoded call chain: compose routes → map signals through the catalogue → detect persistence / messaging / outbound HTTP → reconcile Graphify edges → multi-hop bridges → k8s trust → Spring config → SBOM corroboration → grade relationships. New analysis is a named pass, not an edit to `run-slice.ts`.

**CALM construction is catalogue-driven.** `node-type-mapping.yml`, `relationship-type-mapping.yml`, and `control-requirement-catalogue.yml` decide CALM shape. Isolated builders (`node`, `interface`, `relationship`, `control`, `metadata`, `port-interface`) stay independent. New coverage is supposed to be a catalogue row plus one of four proven mechanisms:

1. Native framework typing
2. Decorator / annotation extraction
3. Import detection
4. Structured-file ingestion

If a new signal needs a fifth mechanism, that is a design conversation, not a silent code path.

---

## What it can actually extract

**HTTP entry:** Spring MVC, JAX-RS composed routes, Flask, NestJS — proven. Java Lambda + explicit CloudFormation API Gateway path join — proven for that shape. SAM shorthand / Node-Python handlers — not.

**Persistence:** JPA `@Entity`, driver/import (SQLAlchemy, Prisma-with-ownership, JDBC, Mongo, Dynamo import), Spring Data `extends JpaRepository`, jOOQ via resolved imports. Ownership is the hard part: an import is not the same as “this class owns the store.” Prisma now requires `extends PrismaClient`. JDBC read-services vs table-owners is still an open, documented limitation.

**Messaging:** Kafka consumers (`@KafkaListener`) and field-type producers (`KafkaTemplate`); SQS/SNS import evidence. No queue-name or `.send()` resolution.

**Controls:** Spring `@PreAuthorize` (proven); a small call-site vocabulary (`validateHas*Permission`, `hasRole`, `isAuthenticated`, Python `jwt.decode`); OpenAPI security schemes. Not unbounded call-graph auth inference.

**Relationships, graded on purpose:**

| Grade | What it is |
|---|---|
| **R0 structural** | Graphify edge only if **both** ends are TypedUnits. Code-level, not “the architecture story.” |
| **R1 architecture** | One-hop service → database/topic. Regression-locked. |
| **R2 multi-hop** | Service → access-layer implementer → store, bounded at **2 hops**. Three branches: implementer-is-store, implementer-imports-one-store, direct-delegate (no interface). Refuses 0 or 2+ candidates rather than guessing. |

Single-root scan of a layered system often misses the full story **by design**. The flagship charge-module case is the teaching example: L2 fails on charge alone (no static one-hop in source); L2 passes on charge+provider together, and the terminal is the access-layer JDBC store, **not** the JPA entity. Those are two different claim triples — conflating them is a named forbidden phrase.

**Honesty metadata is first-class.** Confidence scores, ignored-items taxonomy, unmapped-signal reports, scope-limitations, and completeness flags (S1/S2/S5: “checked and empty” vs “never checked”). A high score on what *was* found never implies the whole architecture is complete.

After generation, a human can correct via Decision Record + Override — applied strictly after the deterministic builders, never mutating what Analysis concluded.

---

## Repository shape

| Path | Role |
|---|---|
| `pipeline/` | The product — TypeScript, Node 20+ |
| `docs/` | One requirements doc + locked solution design + living status |
| `coe-lab/` | Evaluation benchmark: fixtures, **hand-authored** gold, scorer |
| `tools/review-session/` | Offline architect residual-review session pack |
| `spikes/` | Local sample-repo clones (gitignored) — evidence, not the product |

**CoE Lab isolation is load-bearing.** Gold under `coe-lab/gold/` is the answer key. Implementation work must not read it. A measurement taken after reading gold is void, not merely weak.

Validation is layered: **L0** schema (`calm validate`) → **L1** unit/route/control presence → **L2** architecture story → **L3** silence flags → **L4** scope-limitations honesty. L0+L1 green does not imply L2.

Regression: `cd pipeline && npm test` — exact-value fixture assertions. Baseline on this branch: **64 pass / 0 fail / 25 skip** (skips are sample-repo tests that stay quiet when `spikes/` is absent).
