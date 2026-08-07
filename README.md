# Architecture-as-Code platform (codescanner / Loom)

Deterministic pipeline that **extracts software architecture signals from source** (Java, Python, Node/TypeScript) and generates **FINOS CALM 1.2** JSON — for review, governance input, and evaluation against hand-authored gold.

**No LLM in the core generation path.** Optional offline tooling may propose catalogue or review hints; they never write `typed-facts.json`.

| | |
|---|---|
| **Primary code** | [`pipeline/`](./pipeline/) |
| **Living status** | [`docs/solution/STATUS.md`](./docs/solution/STATUS.md) |
| **What you may claim is “built”** | [`docs/solution/Claim_Register.md`](./docs/solution/Claim_Register.md) |
| **Eval benchmark (CoE lab)** | [`coe-lab/`](./coe-lab/) |
| **Solution design** | [`docs/solution/Architecture_as_Code_Solution_Design_v2.md`](./docs/solution/Architecture_as_Code_Solution_Design_v2.md) |

Working name used in design docs: **Loom** (weaving signals into one architecture fabric). Repo folder remains `codescanner`.

---

## What this project is (and is not)

### Is

- A **catalogue-driven analyser/orchestrator**: scan → typed facts → modules (CALM generator, threat-signals, …).
- A generator of **schema-valid CALM** (`calm validate`) with provenance and confidence metadata.
- A research-and-build track for **fintech-shaped** polyglot monorepos (Bank of Anthos, Apache Fineract, Ghostfolio, lab fixtures).
- An evaluation harness (**CoE lab**) with **hand-authored** gold — not generator-bootstrapped SOT.

### Is not

- A CALM **governance** product (pattern authoring, org policy engines) — it *produces* artefacts for external `calm validate -p` / governance tools.
- An LLM architecture fantasy generator.
- A complete enterprise architecture model for every layered codebase (see [Known issues](#known-issues--honest-gaps)).

---

## Dual goals

| Goal | Intent | Status (short) |
|---|---|---|
| **A — Platform** | Modular Analyser/Orchestrator; `typed-facts.json` contract; more than one module | **Partial** — registry, contract version, calm-generator + threat-signals; not a full plugin marketplace |
| **B — CALM construction** | Deterministic, catalogue-driven CALM 1.2 | **Strong for units/routes/controls (decorator)**; **partial for architecture stories** (see AREC) |

---

## Architecture (brief)

```text
┌─────────────────────────────────────────────────────────────────┐
│  run-slice (orchestration)                                       │
│    package roots → scan → analysis passes → TypedFacts           │
│    → module registry → calm-generator / threat-signals / …       │
└─────────────────────────────────────────────────────────────────┘
         │                         │
         ▼                         ▼
  Scanner adapters           Rules / catalogues (YAML)
  • CodeGraph (routes,       • signal-catalogue
    decorators)              • node / relationship / control maps
  • Graphify (structural     • persistence / messaging / HTTP client
    backbone, cross-root)      detection catalogues
  • OpenAPI, k8s manifests   • scope-limitations
  • deployable manifests
         │
         ▼
  typed-facts.json  ──►  architecture.calm.json (+ IR, coverage, unmapped)
                              calm validate -u control-url-mapping.json
```

**Fixed contract:** `TypedFacts` (`contractVersion`) is the boundary between Analysis and Modules. Modules do not reach back into scanners.

**Design rule:** new capability = **catalogue row + thin pass/provider**, not a special-case in `build-calm.ts`.

**AREC (Architecture Relation & Evidence Completeness)** is the pillar for relation strategies (R0–R2), control strategies (decorator / call-site / contract), and silence/completeness — see [`Architecture_Relation_Evidence_Completeness.md`](./docs/solution/Architecture_Relation_Evidence_Completeness.md). Wave 3 implementation: [`AGENT_TASKS_AREC_Wave3_Implementation.md`](./docs/solution/AGENT_TASKS_AREC_Wave3_Implementation.md).

---

## Features

### Scanning & analysis

| Feature | Notes |
|---|---|
| Hybrid engines | CodeGraph (per-package typing) + Graphify (combined structural graph) |
| Multi-root runs | One Graphify pass over common ancestor; cross-package edges when units match |
| JAX-RS route composition | Class + method `@Path` assembly (Fineract-proven) |
| NestJS / Flask / Spring MVC routes | Native typing and/or decorator paths |
| JPA `@Entity` → database units | Decorator extraction |
| Import-based persistence | SQLAlchemy, Prisma (`ref_*` Graphify targets), etc. |
| Messaging consumers | e.g. `@KafkaListener` → network/topic-style units |
| OpenAPI ingestion | Routes + securitySchemes when static files present |
| k8s trust | Shared Secret/ConfigMap → `shares-secret`; deployment↔unit correlation |
| Env soft-graph | Opt-in name correlation (no secret **values**) |
| Completeness metrics | Coverage report: S1/S2-style silence signals (Wave 3 Session A) |
| Relationship grading | `structural` \| `architecture` \| `trust` (R0 honesty) |

### CALM generation

| Feature | Notes |
|---|---|
| Catalogue-driven builders | nodes, interfaces, relationships, controls, system node, metadata |
| Schema-valid `connects` | No invalid `interacts` `{source,destination}` shape |
| Controls | Decorator RBAC (`@PreAuthorize`) + local requirement URL mapping for `calm validate` |
| Overrides / Decision Records | node_add/type_change/rename/remove; relationship_add/remove; DR integrity |
| Intelligence IR | Markdown review surface from facts + coverage (not a second source of truth) |
| Threat-signals module | HTTP without security-control category evidence (narrative honesty still evolving) |

### Evaluation (CoE lab)

| Feature | Notes |
|---|---|
| Fixtures monorepo | Python / Nest / JAX-RS / Spring / RBAC / Kafka / Dynamo / k8s / trap lib |
| Semantic gold | `coe-lab/gold/packages/*.gold.json` (P/R style) |
| Full CALM gold | Hand-authored `coe-lab/gold/calm/**` (includes Fineract wild gold) |
| Score / validate scripts | generate-calm, score-calm, validate-calm-pair, scoreboard |
| Isolation | Implementers must not mine gold to invent detectors (`ISOLATION.md`) |

### Tooling

| Feature | Notes |
|---|---|
| Regression suite | `cd pipeline && npm test` (fixtures + optional real clones) |
| Offline rule suggest | `suggest-rules` — LLM optional, never on core path |
| Docker | `pipeline/Dockerfile` (packaging path exists; not the main doc focus) |

---

## What works well today

Use these claims freely (see Claim Register for precision):

1. **HTTP surface discovery** — Flask, NestJS, Spring MVC, JAX-RS composed routes on real and lab code.  
2. **Persistence units** — JPA entities; Graphify import strategies (including Prisma after Graphify `ref_` normalization).  
3. **Schema-valid CALM** — builders + control URL mapping; regression and lab runs routinely 0 errors.  
4. **One-hop architecture links (R1)** — e.g. BoA-style service → DB class when Graphify connects two TypedUnits.  
5. **Decorator controls (C-dec)** — e.g. Fineract `DatatableWriteService` `@PreAuthorize`.  
6. **k8s shared-secret trust** — BoA-class; deployment correlation improved for Java Controller naming (service-kind only).  
7. **Cross-package structural edges** — when multi-root Graphify + dual-unit match.  
8. **Eval discipline** — hand gold, L0–L5 validation language, lab core L1-style gates.  
9. **Platform modularity basics** — TypedFacts contract, second module, namespaced outputs.  
10. **Evidence-driven fixes** — Ghostfolio, full BoA k8s, Fineract charge/core used as disconfirming samples.

---

## Known issues & honest gaps

| Issue | Impact | Tracking |
|---|---|---|
| **Layered multi-hop (R2)** — e.g. Fineract API → platform service → entity | Strong L1 units; **L2 architecture story often empty** on single-module charge | AREC Session C; may need **labeled multi-root** (e.g. +provider) |
| **Call-site auth (C-call)** — `validateHasReadPermission`, `jwt.decode` | HTTP “no security-control” in pipeline categories despite real auth in source | AREC Session D |
| **R0 entity–entity mesh** | Many `connects` edges that are structural, not service architecture | Graded R0; do not overclaim |
| **High confidence ≠ complete** | Easy to misread unit scores as full architecture | Completeness / silence metrics; scope-limitations |
| **Lab L1 green ≠ Fineract L2** | Soft “all pass” on lab does not prove enterprise story | `validation-approach-vnext.md` |
| **Messaging producers** | Consumers partial; producers largely open | Claim U-msg-producer; Session E |
| **Spring Data / jOOQ / Dynamo-SQS depth** | Catalogue partial / stretch | Claim Register; Session E |
| **Control payload richness** | Expression/authority often thin vs gold | C-rich (D or E) |
| **Prisma `*Service` as `database` kind** | Detection works; ontology debatable | Q13 / Session E |
| **IR / LLM advisory UX** | IR partial; full advisory path not productized | Design v2 §7.1 / §13 |
| **scope-limitations drift** | Must stay aligned with Claim Register | Session A T-A4 hygiene |

**Forbidden overclaims (examples):** “Java relationships work end-to-end”; “Graphify recovers full architecture”; “Fineract APIs have CALM controls” (decorator-only is true for some service layers, not call-site HTTP).

---

## Status snapshot (2026-08)

| Area | State |
|---|---|
| Slice 1 (Python/Node happy path) | Built |
| Slice 2a (Java source-only + construction) | Built (routes, entities, decorator controls) |
| Extraction enrichment (X0–X9 class work) | Largely built; see STATUS §B |
| Claim honesty Wave 1 | **Done** |
| AREC design Wave 2 | **Done** |
| AREC implementation Wave 3 | **In progress** — Sessions A–B done (silence, R0 grade, eval labels, R1 lock, R2 design); **Session C (R2 implement)** next |
| CoE lab core eval | L0+L1 strong; stretch packages mixed |
| Fineract wild gold | L0 pass; L1 strong; **L2 story fail** until R2 (+ appropriate multi-root claim) |

Authoritative detail: **[`docs/solution/STATUS.md`](./docs/solution/STATUS.md)** and **[`docs/solution/Claim_Register.md`](./docs/solution/Claim_Register.md)**.

---

## Backlog (high level)

Ordered implementation: **[`AGENT_TASKS_AREC_Wave3_Implementation.md`](./docs/solution/AGENT_TASKS_AREC_Wave3_Implementation.md)** (Sessions A→E).

| Priority | Theme |
|---|---|
| **P0** | Silence metrics, R0 honesty, eval L0/L1/L2 labels, scope hygiene, regression shields *(Session A — largely landed)* |
| **P1** | R1 lock, **R2 multi-hop**, **C-call auth**, Fineract L2 remeasure *(B done; C–D next)* |
| **P2** | C-rich controls, messaging producers, persist ontology, Dynamo/jOOQ, OpenAPI dual-unit |
| **P3** | HITL empty-neighborhood triggers, residual k8s FPs, claim-mode polish |

Other backlog (platform, not only AREC): full CodeQL/scip Phase 2, two-tier mapping-config, plugin discovery, ADR ingestion, deeper OpenAPI productization — see design v2 and STATUS.

---

## Repository layout

```text
codescanner/
  README.md                 ← you are here
  CLAUDE.md                 ← agent/project working memory (long)
  pipeline/                 ← Node/TS product code
    src/scanner/            ← engines & providers
    src/rules/              ← YAML catalogues + schemas
    src/analysis/           ← passes, detectors, IR, coverage
    src/modules/            ← calm-generator, threat-signals, registry
    src/orchestration/      ← run-slice
    test/                   ← regression suite
  coe-lab/                  ← evaluation benchmark (fixtures + gold + scripts)
  docs/
    solution/               ← design, STATUS, Claim Register, AREC, agent tasks
    requirements/           ← CALM generator requirements series
    spikes/                 ← research write-ups
  spikes/                   ← disposable real-repo clones (boa, fineract, ghostfolio, …)
  tmp/                      ← gitignored local outputs
```

---

## Quick start

### Prerequisites

- Node.js 20+ (or current LTS used in CI)
- Python + `graphifyy` on `PATH` for Graphify (`pip install graphifyy` / ensure console script visible)
- Optional real clones under `spikes/` for full regression (BoA, Fineract, Ghostfolio)

### Build, test, run

```bash
cd pipeline
npm install
npm run build
npm test

# Scan one or more package roots → CALM + facts
node dist/orchestration/run-slice.js /path/to/package --out /path/to/out

# Multi-root example
node dist/orchestration/run-slice.js rootA rootB --out /path/to/out

# Optional k8s / env soft-graph (see run-slice --help)
# node dist/orchestration/run-slice.js ... --k8s-manifests /path/to/manifests --enable-env-soft-graph

# Schema-validate generated CALM (control URL mapping for requirement-url)
npm run validate -- /path/to/out/architecture.calm.json -f pretty
```

### CoE lab eval

```bash
cd pipeline && npm run build
cd ../coe-lab
node scripts/generate-calm.mjs --package py-accounts-api
node scripts/validate-calm-pair.mjs --package py-accounts-api
./scripts/run-eval.sh py-accounts-api   # semantic score vs gold/packages
node scripts/scoreboard.mjs
```

See [`coe-lab/README.md`](./coe-lab/README.md).

---

## Validation layers (how to read “pass”)

| Layer | Meaning |
|---|---|
| **L0** | CALM schema valid (`calm validate`) |
| **L1** | Unit/path/control **presence** vs gold |
| **L2** | Architecture **story** (service→store, etc.) |
| **L3** | Silence / completeness invariants |
| **L4** | Scope-limitations match reality |
| **L5** | HITL residual only |

Lab core green is typically **L0+L1**. Fineract wild gold is **L2-fail** until multi-hop (and claim mode) catch up. Details: [`coe-lab/docs/validation-approach-vnext.md`](./coe-lab/docs/validation-approach-vnext.md).

---

## Documentation map

| Doc | Use when |
|---|---|
| [`docs/solution/STATUS.md`](./docs/solution/STATUS.md) | Built vs partial vs backlog |
| [`docs/solution/Claim_Register.md`](./docs/solution/Claim_Register.md) | Allowed product claims |
| [`docs/solution/Architecture_as_Code_Solution_Design_v2.md`](./docs/solution/Architecture_as_Code_Solution_Design_v2.md) | Platform + CALM construction design |
| [`docs/solution/language/java.md`](./docs/solution/language/java.md) | Java / Slice 2 sequencing |
| [`docs/solution/Architecture_Relation_Evidence_Completeness.md`](./docs/solution/Architecture_Relation_Evidence_Completeness.md) | AREC pillar |
| [`docs/solution/AGENT_TASKS_AREC_Wave3_Implementation.md`](./docs/solution/AGENT_TASKS_AREC_Wave3_Implementation.md) | Implementation sessions A–E |
| [`docs/solution/Module_Authoring_Guide.md`](./docs/solution/Module_Authoring_Guide.md) | Adding a module |
| [`docs/solution/Contract_Evolution_Policy.md`](./docs/solution/Contract_Evolution_Policy.md) | TypedFacts versioning |
| [`CLAUDE.md`](./CLAUDE.md) | Deep working memory for agents |
| [`coe-lab/docs/fineract-gold-vs-platform-finding.md`](./coe-lab/docs/fineract-gold-vs-platform-finding.md) | Why Fineract L2 fails today |
| [`docs/spikes/`](./docs/spikes/) | Historical spikes and evidence |

---

## Principles (short)

1. **Evidence before claim** — real repos and greps beat vendor docs.  
2. **Catalogue over special case** — new framework ≈ data row.  
3. **Deterministic core** — same inputs → same CALM; LLM only offline/advisory.  
4. **Honesty metadata** — scope-limitations, confidence ≠ completeness, graded relationships.  
5. **Surgical changes** — fix one mechanism without rewiring the platform.  
6. **Eval isolation** — gold is for scoring, not detector design.

---

## License / provenance

Pipeline depends on open tools including **@colbymchenry/codegraph**, **Graphify**, and **@finos/calm-cli**. Target repos under `spikes/` are third-party clones for research; treat as disposable. Check upstream licenses before redistribution of clones or generated artefacts from proprietary monorepos.
