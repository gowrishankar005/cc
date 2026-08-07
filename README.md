# Weaver

**Weaver** is a deterministic Architecture-as-Code platform: it **extracts software architecture signals from source** (Java, Python, Node/TypeScript) and **weaves** them into **FINOS CALM 1.2** JSON — for review, governance input, and evaluation against hand-authored gold.

**Product target:** polyglot **enterprise / fintech-shaped monorepos** — not any single open-source app. Public repos and lab fixtures are **evidence samples** used to prove or disprove mechanism claims.

**No LLM in the core generation path.** Optional offline tooling may propose catalogue or review hints; they never write `typed-facts.json`.

| | |
|---|---|
| **Product name** | **Weaver** |
| **Primary code** | [`pipeline/`](./pipeline/) |
| **Living status** | [`docs/solution/STATUS.md`](./docs/solution/STATUS.md) |
| **Product backlog (thin index)** | [`docs/solution/BACKLOG.md`](./docs/solution/BACKLOG.md) |
| **Next iteration plan** | [`docs/solution/NEXT_ITERATION.md`](./docs/solution/NEXT_ITERATION.md) |
| **Robustness program (phased)** | [`docs/solution/AGENT_TASKS_Weaver_Robustness.md`](./docs/solution/AGENT_TASKS_Weaver_Robustness.md) |
| **What you may claim is “built”** | [`docs/solution/Claim_Register.md`](./docs/solution/Claim_Register.md) |
| **Pilot-ready scorecard** | [`docs/solution/Pilot_Ready_Scorecard.md`](./docs/solution/Pilot_Ready_Scorecard.md) |
| **Eval benchmark (CoE lab)** | [`coe-lab/`](./coe-lab/) |
| **Solution design** | [`docs/solution/Architecture_as_Code_Solution_Design_v2.md`](./docs/solution/Architecture_as_Code_Solution_Design_v2.md) |

Repo directory may still be named `codescanner` on disk; the platform name is **Weaver** (weaving disparate signals into one architecture fabric via catalogues).
---

## What this project is (and is not)

### Is

- A **catalogue-driven analyser/orchestrator**: scan → typed facts → modules (CALM generator, threat-signals, …).
- A generator of **schema-valid CALM** (`calm validate`) with provenance and confidence metadata.
- A platform for **repeating architecture extraction** across languages/frameworks common in enterprise stacks (Spring/JAX-RS, Flask/Nest, JPA/SQLAlchemy/Prisma, k8s, messaging, …).
- An evaluation harness (**CoE lab**) with **hand-authored** gold — not generator-bootstrapped SOT.
- **Evidence-driven:** real public monorepos and controlled fixtures *test* the platform; they are not the product roadmap.

### Is not

- A product “for Apache Fineract,” Bank of Anthos, Ghostfolio, or any one codebase — those are **proxies** for fintech engineering patterns.
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

## Languages & frameworks

Scope is intentionally **Java + Python + TypeScript/Node** for fintech-shaped services. Support is **catalogue- and evidence-based** — not “every framework in the language.”

Legend: **Supported** = proven on real or lab evidence and safe to claim · **Partial** = works for some signals/shapes only · **Not supported** = no reliable path today · **Todo** = specified or backlog, not done

### By language

| Language | Status | What works well | Limits |
|---|---|---|---|
| **Python** | **Supported** | Flask routes (BoA), SQLAlchemy-style persistence via Graphify imports, multi-package runs | Call-site JWT auth not attached as controls; Django/SQLAlchemy-as-primary unproven as first-class stacks |
| **TypeScript / Node** | **Supported** | NestJS routes (native + decorator), Prisma/import persistence after Graphify `ref_*` fix (Ghostfolio), OpenAPI file ingestion | Cloud Dynamo/SQS architecture units weak; bare `http` servers not a focus; Angular/frontend out of scope |
| **Java** | **Supported (units)** · **Partial (stories)** | JAX-RS composed routes, JPA `@Entity`, Spring `@PreAuthorize`, `@KafkaListener` consumers, Spring MVC-style lab routes | Layered service→DB (R2) incomplete; call-site security incomplete; Spring Data / jOOQ / Batch not dispatched |
| **Other** (Go, .NET, Scala, Kotlin-first, Ruby, …) | **Not supported** | — | No scanner catalogue path; not in current dual-engine scope |

### Frameworks & concerns (detail)

#### HTTP / application frameworks

| Stack | Status | Evidence / notes |
|---|---|---|
| **Flask** | **Supported** | Bank of Anthos; lab py-accounts / ledger |
| **FastAPI** | **Partial / catalogue-ready** | Signal rows exist; less regression weight than Flask in this repo |
| **NestJS** | **Supported** | Lab fixture + Ghostfolio-class Nest; `@Controller` = bootstrap not interface |
| **JAX-RS** (`@Path` / `@GET`…) | **Supported** | Route composition; evidenced on multi-module Java services |
| **Spring MVC** (`@RestController`, `@GetMapping`…) | **Partial** | Lab spring-payments; matrix notes real Spring MVC monorepo less exercised than JAX-RS |
| **Quarkus** | **Partial** | Same JAX-RS extraction path; CDI-specific bootstrap not a full product claim |
| **Play Framework** | **Not a product focus** | CodeGraph has Play leanings historically; not a claimed CoE target |
| **Express / Fastify / Koa** | **Not supported** | No dedicated catalogue/route composer |
| **Django / FastAPI-as-only-stack** | **Not supported** as primary proven path | Django not evidenced; FastAPI rows exist but Flask is the Python yardstick |
| **Angular / React / browser apps** | **Out of scope** | Explicit lab/out-of-scope for Slice 1/2 frontend |

#### Persistence

| Stack | Status | Notes |
|---|---|---|
| **JPA** (`@Entity` / `@Table`) | **Supported** | Lab Java + multi-module Java services |
| **SQLAlchemy** (import / wrapper class) | **Supported** | BoA; lab Python |
| **Prisma** (`@prisma/client`, Graphify `ref_prisma_client`) | **Supported** (detection) | Ghostfolio; ontology “Service = database unit” still debatable |
| **TypeORM / Mongoose / Sequelize / pg / …** | **Partial** | Catalogue entries; not all verified on large real apps |
| **Spring Data repositories** | **Todo** | Designed in persistence catalogue; not fully dispatched |
| **jOOQ** | **Todo** | Same |
| **MyBatis** | **Not supported** | Unevidenced (earlier false lead was MapStruct) |
| **DynamoDB (AWS SDK)** | **Todo / stretch** | Lab fixture; architecture units still weak |
| **Raw JDBC-only / custom DAOs** | **Not supported** as a generic pattern | May appear only if other signals fire |

#### Security / controls

| Stack | Status | Notes |
|---|---|---|
| **Spring `@PreAuthorize`** | **Supported** | Decorator → CALM controls |
| **Call-site auth** (`validateHasReadPermission`, `jwt.decode`, …) | **Todo** (AREC C-call) | Common enterprise pattern (method-call security, not only annotations); not controls today |
| **OpenAPI `securitySchemes`** | **Partial** | When static OpenAPI present |
| **Quarkus `@Authenticated` / other vocabularies** | **Todo / catalogue expansion** | Breadth spike showed third vocabularies |
| **OAuth2 full flow modeling** | **Not supported** as end-to-end product | Partial signals only |

#### Messaging

| Stack | Status | Notes |
|---|---|---|
| **Spring `@KafkaListener`** | **Partial** | Consumer → network/topic-style unit |
| **JMS `@JmsListener`** | **Partial** | Catalogue row; less evidence weight |
| **Kafka producers** (`KafkaTemplate.send`) | **Todo** | Not decorator-shaped |
| **AWS SQS/SNS** | **Todo** | Import strategy catalogued; units weak |
| **RabbitMQ / Pulsar / gRPC streaming** | **Not supported** | gRPC checked unevidenced in early sampling |

#### Platform / ops signals

| Stack | Status | Notes |
|---|---|---|
| **Kubernetes** Deployments + shared Secret/ConfigMap | **Partial** | Trust edges; flat/pre-rendered YAML; opt-in `--k8s-manifests` |
| **Env / ConfigMap name correlation** | **Partial** | Opt-in soft-graph; no secret **values** |
| **OpenAPI 3 / Swagger 2 files** | **Partial** | Static files; not springdoc build-time-only |
| **Docker Compose as architecture source** | **Not primary** | Cited historically; not a first-class provider |
| **Terraform / Helm deep resolution** | **Not supported** | Kustomize/Helm resolution backlog |

#### Explicitly not supported (near term)

- Languages outside **Java / Python / TS-Node**
- Full **frontend** architecture (SPA, mobile)
- **Build-dependent** engines as Phase 1 default (CodeQL, scip-java, jQAssistant) — researched / Phase 2 only
- **LLM** as a required step for generation
- **CALM pattern governance** product (authoring org patterns, live policy packs)
- Guaranteeing **complete** architecture graphs for **multi-module layered** systems until R2 + multi-root claims mature

Authoritative claim cells: [`docs/solution/Claim_Register.md`](./docs/solution/Claim_Register.md) · engine rows: [`pipeline/src/scanner/engine-capability-matrix.yml`](./pipeline/src/scanner/engine-capability-matrix.yml).

---

## Features

### Scanning & analysis

| Feature | Notes |
|---|---|
| Hybrid engines | CodeGraph (per-package typing) + Graphify (combined structural graph) |
| Multi-root runs | One Graphify pass over common ancestor; cross-package edges when units match |
| JAX-RS route composition | Class + method `@Path` assembly (proven on real multi-module Java) |
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
| Full CALM gold | Hand-authored `coe-lab/gold/calm/**` (lab packages + optional wild-type samples) |
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

1. **HTTP surface discovery** — Flask, NestJS, Spring MVC, JAX-RS composed routes.  
2. **Persistence units** — JPA entities; Graphify import strategies (including Prisma after Graphify `ref_` normalization).  
3. **Schema-valid CALM** — builders + control URL mapping; regression and lab runs routinely 0 errors.  
4. **One-hop architecture links (R1)** — service → DB when code/Graphify connects two TypedUnits in one hop.  
5. **Decorator controls (C-dec)** — e.g. Spring `@PreAuthorize` on service layers without HTTP.  
6. **k8s shared-secret trust** — deployment correlation for role-named Deployments ↔ Controller-style units (service-kind only).  
7. **Cross-package structural edges** — when multi-root Graphify + dual-unit match.  
8. **Eval discipline** — hand gold, L0–L5 validation language, lab core L1-style gates.  
9. **Platform modularity basics** — TypedFacts contract, second module, namespaced outputs.  
10. **Evidence-driven engineering** — public monorepos + lab fixtures used as **disconfirming samples**, not as the product.

### Evidence samples (not the product)

| Sample | Why it exists in this repo |
|---|---|
| CoE lab fixtures | Controlled, isolated regression shapes |
| Bank of Anthos–class trees | Python/Flask + k8s trust patterns |
| Multi-module Java (e.g. JAX-RS + JPA services) | Layered enterprise Java / dual-unit stress |
| NestJS + Prisma wealth apps | Real Node import-graph / `ref_*` behaviour |

Clones under `spikes/` are **scratch evidence**, not deliverables.

---

## Known issues & honest gaps

| Issue (pattern class) | Impact | Tracking |
|---|---|---|
| **Layered multi-hop (R2)** — API → application service → store across packages | Strong L1 units; **L2 architecture story often incomplete** when implementers live outside a single root or lack catalogue persistence signals | AREC R2 (mechanism partial; enterprise residual remains) |
| **Call-site auth (C-call)** — permission/JWT checks as method calls, not annotations | HTTP units lack security-control evidence despite real auth in source | AREC Session D |
| **R0 entity–entity mesh** | Many `connects` edges that are structural, not service architecture | Graded R0; do not overclaim |
| **High confidence ≠ complete** | Easy to misread unit scores as full architecture | Completeness / silence metrics; scope-limitations |
| **Lab L1 green ≠ wild-type L2** | Soft “all pass” on fixtures does not prove multi-module enterprise stories | `validation-approach-vnext.md` |
| **Messaging producers** | Consumers partial; producers largely open | Claim U-msg-producer; Session E |
| **Spring Data / jOOQ / Dynamo-SQS depth** | Catalogue partial / stretch | Claim Register; Session E |
| **Control payload richness** | Expression/authority often thin vs gold | C-rich (D or E) |
| **ORM import ontology** (e.g. app service importing client types typed as `database`) | Detection works; architecture kind debatable | Session E |
| **IR / LLM advisory UX** | IR partial; full advisory path not productized | Design v2 §7.1 / §13 |
| **scope-limitations drift** | Must stay aligned with Claim Register | Hygiene with capability changes |

**Forbidden overclaims (examples):** “Java relationships work end-to-end”; “Graphify recovers full architecture”; “all HTTP APIs have CALM security controls” (decorator path only today).

---

## Status snapshot (2026-08)

| Area | State |
|---|---|
| Slice 1 (Python/Node happy path) | Built |
| Slice 2a (Java source-only + construction) | Built (routes, entities, decorator controls) |
| Extraction enrichment (X0–X9 class work) | Largely built; see STATUS §B |
| Claim honesty Wave 1 | **Done** |
| AREC design Wave 2 | **Done** |
| AREC implementation Wave 3 | **In progress** — Sessions A–C landed (silence, R0 grade, R1 lock, R2 **mechanism**); **Session D (C-call)** next. R2 does **not** yet close all layered multi-module stories |
| CoE lab core eval | L0+L1 strong; stretch packages mixed |
| Wild-type / multi-module L2 stories | Still the hard bar — incomplete by design honesty, not “one repo left to finish” |

Authoritative detail: **[`docs/solution/STATUS.md`](./docs/solution/STATUS.md)** and **[`docs/solution/Claim_Register.md`](./docs/solution/Claim_Register.md)**.

---

## Backlog (high level)

**Canonical thin index:** [`docs/solution/BACKLOG.md`](./docs/solution/BACKLOG.md)  
**Next iteration (critical todos):** [`docs/solution/NEXT_ITERATION.md`](./docs/solution/NEXT_ITERATION.md)  
**Active agent tasks (Session E next):** [`docs/solution/AGENT_TASKS_AREC_Wave3_Implementation.md`](./docs/solution/AGENT_TASKS_AREC_Wave3_Implementation.md)

| Priority | Theme | Examples |
|---|---|---|
| **Now** | Session E + R2 residual (R2b) | Producers, ontology, cloud; multi-hop when impl ≠ entity |
| **P1** | Architecture stories + security depth | Labeled multi-root L2; C-call vocabulary expand |
| **P2** | Breadth | Spring Data/jOOQ; Dynamo/SQS; OpenAPI dual-unit |
| **P3** | Discovery + polish | Stratified sampling; trap automation; HITL S1 trigger |

**Other platform backlog:** CodeQL/scip Phase 2, plugin discovery, two-tier mapping-config, ADR ingestion — see STATUS and BACKLOG “Later”.

---

## Repository layout

```text
<repo>/                     # e.g. codescanner/ — product name: Weaver
  README.md                 ← you are here
  CLAUDE.md                 ← agent/project working memory (long)
  pipeline/                 ← Node/TS product code (Weaver runtime)
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
  spikes/                   ← disposable evidence clones (not product targets)
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

Lab core green is typically **L0+L1**. **Wild-type multi-module L2** (layered service→store across packages) is a harder bar and still incomplete. Details: [`coe-lab/docs/validation-approach-vnext.md`](./coe-lab/docs/validation-approach-vnext.md).

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
| [`coe-lab/docs/fineract-gold-vs-platform-finding.md`](./coe-lab/docs/fineract-gold-vs-platform-finding.md) | Example wild-type L2 finding (one multi-module Java sample — not the product target) |
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
