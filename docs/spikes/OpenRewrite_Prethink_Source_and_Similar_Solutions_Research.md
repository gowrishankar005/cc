# Research: `openrewrite/rewrite-prethink` source + similar discovery solutions

**Date:** 2026-08-08  
**Method:** Shallow clone of `https://github.com/openrewrite/rewrite-prethink` (main), full read of `src/main/java/org/openrewrite/prethink/**`, README, `build.gradle.kts`; cross-check Moderne docs for the commercial discovery module; survey adjacent tools.  
**Status:** Source-grounded for OSS Prethink; discovery recipe bodies are **not in this public repo**.

**Companion:** [`Tier1_Bank_Stacks_and_Semantic_Analysis_Competitors_Research.md`](./Tier1_Bank_Stacks_and_Semantic_Analysis_Competitors_Research.md)

---

## 0. Executive finding (most important)

| Question | Answer from **source** |
|---|---|
| Does `openrewrite/rewrite-prethink` implement Spring/JAX-RS/Kafka **discovery**? | **No.** |
| What is in the public repo? | **Schemas (data tables) + CALM assembly + CSV export + agent config / gitignore recipes** |
| Where is actual discovery? | **Moderne commercial** module `io.moderne.recipe:rewrite-prethink` (`FindServiceEndpoints`, etc.) — not in this GitHub tree |
| README honesty | Explicit: *“This library provides the core Prethink infrastructure. For a complete solution with architectural discovery recipes, see Moderne Prethink.”* |

So: public Prethink is a **CALM + agent-context assembly kit**. Framework finding is a **closed/commercial (or separate) recipe pack** that **fills the tables** this kit consumes.

That split matters for Weaver: we compete with (1) the **table→CALM construction logic** (open) and (2) the **Find\*** catalogue (documented, not fully open-sourced here).

---

## 1. Public repo inventory

### 1.1 Layout (`src/main/java/org/openrewrite/prethink`)

```text
org.openrewrite.prethink/
├── Prethink.java                 # CONTEXT_DIR = .moderne/context, cycle helper
├── UpdatePrethinkContext.java    # Composite: GenerateCalm + ExportContext + UpdateAgentConfig + UpdateGitignore
├── ExportContext.java            # DataTable → CSV + markdown schema docs
├── UpdateAgentConfig.java        # Patch CLAUDE.md / AGENTS.md / .cursorrules / copilot-instructions
├── UpdateGitignore.java
├── calm/
│   ├── GenerateCalmArchitecture.java   # ★ core CALM builder (~820 lines)
│   ├── CalmDocument / CalmNode / CalmInterface / CalmRelationship / CalmRelationshipType
│   └── package-info
└── table/                        # DataTable schemas only (no Find* visitors)
    ├── ServiceEndpoints
    ├── DatabaseConnections
    ├── ExternalServiceCalls
    ├── MessagingConnections
    ├── SecurityConfiguration
    ├── ServerConfiguration
    ├── DataAssets
    ├── DeploymentArtifacts
    ├── ProjectMetadata
    ├── ServiceComponents
    ├── CalmRelationships          # method-call graph rows
    ├── CodingConventions, DependencyUsage, ErrorHandlingPatterns
    ├── ClassDescriptions, MethodDescriptions  # often AI-filled upstream
    ├── TestMapping, ContextRegistry, SourceSetLanguageSummary
    └── …
```

**Java source count:** ~38 files (main+test). **Zero** files named `Find*` in this repo.

### 1.2 Dependencies (`build.gradle.kts`)

- `rewrite-java`, `rewrite-properties`, `rewrite-yaml`, `rewrite-maven`
- CSV via univocity-parsers  
- **Not** rewrite-spring / rewrite-java-dependencies as compile deps of this module (discovery that needs those lives elsewhere)

### 1.3 License note

Source headers use **Moderne Source Available License** (not pure Apache) on the files inspected — relevant if considering reuse of CALM assembly code.

---

## 2. What the public module **does** discover / produce

### 2.1 Pipeline (from `UpdatePrethinkContext`)

```text
[Upstream discovery recipes — NOT in this repo]
        │ populate DataTables in ExecutionContext
        ▼
GenerateCalmArchitecture
        │ reads tables → writes .moderne/context/calm-architecture.json
        ▼
ExportContext (Architecture)
        │ re-exports linked tables as CSV/MD under .moderne/context/
        ▼
UpdateAgentConfig + UpdateGitignore
```

`UpdatePrethinkContext` javadoc states it **expects tables already populated** and points to `io.moderne.prethink.UpdatePrethinkContextStarter` / `…NoAiStarter` for the full stack.

### 2.2 Data tables = the discovery contract

These row shapes are the **interface** between discovery and CALM. Anything that fills them can drive CALM export.

| Data table | Columns (source) | Intended discovery content |
|---|---|---|
| **ServiceEndpoints** | entityId, sourcePath, serviceClass, methodName, httpMethod, path, produces, consumes, **framework**, methodSignature | REST controllers / resources |
| **DatabaseConnections** | entityId, sourcePath, entityName, entityClass, repositoryClass, **connectionType** (JPA/JDBC/Spring Data/MyBatis), databaseType | Persist layer |
| **ExternalServiceCalls** | entityId, sourcePath, clientClass, targetService, **clientType** (RestTemplate/WebClient/Feign…), protocol, baseUrl | Outbound HTTP |
| **MessagingConnections** | entityId, sourcePath, className, methodName, destination, **role** (producer/consumer), messagingType, methodSignature | Kafka/Rabbit/JMS… |
| **SecurityConfiguration** | sourcePath, configurationType, authMethod, allowedOrigins, description | CORS / OAuth2 / Spring Security |
| **ServerConfiguration** | sourcePath, port, SSL, contextPath, protocol | Server bind |
| **DataAssets** | (DTOs/entities/records — used as data nodes) | Domain types |
| **DeploymentArtifacts** | sourcePath, artifact type, image, port, description | Docker/K8s/compose |
| **ServiceComponents** | entityId, className, component type, framework | @Service/@Component (for call-graph identity, not always CALM service nodes) |
| **CalmRelationships** | fromClass, fromMethod, toClass, toMethod, callerEntityId, calledEntityId, sourcePath | **Method-call graph** between entity classes |
| **ProjectMetadata** | artifact/group/name/version/modules | System node |
| **ClassDescriptions / MethodDescriptions** | AI or estimated text | Optional prose on nodes |
| CodingConventions, DependencyUsage, ErrorHandling, TestMapping, … | Agent quality context | Not always CALM nodes |

README also lists (as product intent) frameworks that **should** fill those tables — that list is **aspirational for discovery**, not implemented in this tree.

### 2.3 How CALM is built (`GenerateCalmArchitecture`)

Source-backed behaviour:

| Step | Behaviour |
|---|---|
| Schema URL | `https://calm.finos.org/draft/2025-03/meta/calm.json` |
| Empty guard | No endpoints + no DBs + no external + no messaging + no methodCalls → **no file** |
| **system** node | From `ProjectMetadata` (artifactId kebab-case) |
| **service** nodes | Group `ServiceEndpoints` by `serviceClass`; one node per controller class; description = AI class description **or** “REST API with endpoints: METHOD path, …” (cap 5) |
| Interfaces | Single interface per service: `{nodeId}-api` + **serverPort** from `ServerConfiguration` (default HTTP/8080) — **not** path-level interfaces in the snippet inspected |
| **database** nodes | From `DatabaseConnections`; id `kebab(entityName)-db`; connects from service via package/class heuristics |
| **External service** nodes | From `ExternalServiceCalls`; node-type **service**; `connects` from caller |
| **network** nodes | Messaging destinations; producer/consumer direction on `connects`; protocol Kafka→TCP else AMQP |
| **webclient** node | If CORS in SecurityConfiguration + any service; `interacts` actor=webclient → primary service |
| Method-call edges | `CalmRelationships` → resolve entity IDs → `interacts` between nodes |
| Composition | `composed-of` system → services (and related) |
| Relationship types used | **`connects`** `{source,destination}`, **`interacts`** `{actor,nodes[]}`, **`composed-of`** `{container,nodes[]}` — schema-aware (matches real CALM shapes) |
| Package heuristics | Leaf package segments: controller, rest, api, service, repository, dao, client, feign, messaging, listener, … used for “same package service” resolution |

**Two-cycle recipe:** Cycle 1 populates tables / placeholder; cycle 2 writes real JSON (OpenRewrite data-table lifecycle).

### 2.4 What public Prethink does **not** do (in this repo)

- Walk Spring `@GetMapping` / JAX-RS `@Path`  
- Detect Kafka listeners  
- Parse CloudFormation / API Gateway  
- Build CodeGraph-style multi-root monorepo graphs  
- Grade relationships structural vs architecture  
- Emit completeness / silence metrics  

Those require **upstream Find\*** recipes + possibly Moderne platform LST store.

---

## 3. Commercial / documented discovery layer (not in this clone)

From Moderne Prethink docs (previously fetched; not re-verified in this clone):

**Composite starters** run dozens of `Find*` recipes, e.g.:

- Endpoints: Spring MVC, JAX-RS, Micronaut, Quarkus, GraphQL, gRPC, WebSocket, Nest, Express, Django, FastAPI, Flask  
- DB: JPA, Spring Data, JDBC, MyBatis, TypeORM, Mongoose, Prisma, SQLAlchemy  
- External: RestTemplate, WebClient, Feign, HttpClient, OkHttp, axios, fetch…  
- Messaging: Kafka, RabbitMQ, JMS, Spring Cloud Stream, SQS, KafkaJS, amqplib, Bull  
- Security, scheduled tasks, deployment artifacts, quality metrics, tests  

**Implication for research honesty:** “What Prethink discovers” is **two products**:

1. **OSS kit** — tables + CALM assembly (this repo)  
2. **Moderne discovery pack** — LST visitors that fill tables  

Comparing Weaver only to (1) understates their architecture product; comparing only to docs of (2) overstates open reproducibility.

---

## 4. Similar solutions — what they discover

Grouped by **what is extracted**, not marketing names.

### 4.1 Same problem class as Weaver (architecture / structure from code)

| Solution | Model | Discovers (typical) | CALM? | Notes |
|---|---|---|---|---|
| **Weaver** | CodeGraph + Graphify + catalogues | Routes, entities, messaging (partial), controls, k8s trust, multi-root R* | **Yes (primary)** | Zero/low-build path; honesty layers |
| **Moderne Prethink (full)** | LST + recipes | Broad framework catalogue (docs); quality; tests; deps | **Yes** | Build-coupled LST; agent packaging |
| **OpenRewrite rewrite-prethink (OSS)** | Data tables + CALM builder | Only what upstream fills | Yes (assembly) | No Find* in repo |
| **FINOS AaC “architecture discovery” skill** | LLM + CALM | Initial model from code (issue/tutorials) | Yes (authored) | **Not deterministic core** |
| **ArchUnit** | Bytecode tests | Layer rules, package deps | No | Enforce, don’t invent CALM |
| **jQAssistant** | Neo4j concepts | Java structure, custom concepts | No native CALM | Prior Weaver backlog candidate |
| **Structure101 / CodeScene** | Structure/quality | Modules, hotspots, coupling | No | Governance UX |
| **Sonar architecture** | Rules | Cycles, layering | No | Quality |

### 4.2 Semantic code models (adjacent, different goal)

| Solution | Model | Discovers | Architecture export |
|---|---|---|---|
| **CodeQL** | Compiled DB + QL | Vulns, dataflow, some framework models | No CALM product |
| **Joern** | CPG | Taint, call graphs | No CALM |
| **Semgrep** | Tree-sitter patterns | Rule hits | No CALM |
| **Sourcegraph** | Search index | Symbols, refs, batch change | No CALM |
| **SCIP / LSIF** | Index | Precise refs | Feed others |
| **CodeGraph** (our dep) | Index + extractFromSource | Symbols, edges, some routes | Via Weaver |
| **Graphify** | Structural graph | Imports/contains/calls | Via Weaver |

### 4.3 Framework “inventory” tools (narrower)

| Solution | Discovers |
|---|---|
| springdoc / OpenAPI generators | HTTP surface from Spring annotations |
| Spring Boot Actuator mappings | Runtime endpoints (not static AaC) |
| Kubernetes ingress/service discoverers | Deploy topology only |
| AWS Application Discovery / X-Ray | Runtime, not repo static |

These fill **one plane** each; they are not multi-plane architecture products.

### 4.4 Discovery coverage comparison (honest)

| Discovery target | Weaver | Prethink OSS kit | Prethink full (docs) | CodeQL/Joern | Semgrep |
|---|---|---|---|---|---|
| Spring/JAX-RS HTTP | partial/proven | schema only | yes | possible QL | rules |
| Outbound Feign/WebClient | **gap** | schema ready | yes | hard | rules |
| JPA / Spring Data | yes/partial | schema | yes | — | — |
| Kafka / Rabbit / SQS | partial | schema | yes | — | — |
| Lambda + API GW + CFN | **open P1** | no schema for CFN paths | not documented | — | — |
| Multi-hop layered honesty | R2/AREC | package + method-call interacts | method-call graph | taint | — |
| CALM emit | yes | **yes (builder)** | yes | no | no |
| Completeness silence | yes | no | no | no | no |
| Agent context pack | residual/IR | **yes** | yes | no | no |

---

## 5. Technical comparison Weaver ↔ Prethink CALM builder

| Topic | Prethink `GenerateCalmArchitecture` | Weaver |
|---|---|---|
| Service identity | Controller class with endpoints | TypedUnit kind service (multi-signal) |
| Path interfaces | Summary in description; interface is port-level | Path interfaces from routes |
| DB edges | Package/same-service heuristics + repository class map | R0 dual-unit + R1/R2 graded |
| External calls | First-class table → service nodes | Weak / gap |
| Messaging | Destination → network node + direction | topic/network partial |
| Method calls | `interacts` between entity classes | Graphify calls + multi-hop strategies |
| `interacts` shape | actor + nodes[] | Fixed historically; schema-aware |
| System node | Project metadata | Metadata / optional |
| Provenance | Data tables / sourcePath columns | x-aac-provenance / evidence |
| Multi-root monorepo | LST/module based (Moderne multi-repo) | Explicit multi-root Graphify pass |

**Reusable idea (not code copy):** their **data-table intermediate schema** (ServiceEndpoints, ExternalServiceCalls, MessagingConnections, CalmRelationships) is a clean **IR between discovery and CALM** — Weaver’s `typed-facts.json` is the analogue; Prethink’s tables are more **architecture-typed** (endpoint/messaging rows) while TypedFacts are more **unit/evidence** oriented.

---

## 6. Implications for Weaver

1. **Do not treat the public GitHub tree as “full Prethink product.”** It is the **CALM export + agent packaging** half.  
2. **Use table schemas as a coverage checklist** for what a mature architecture discoverer stores — especially **ExternalServiceCalls** (our gap).  
3. **CALM competition is real and open-source-adjacent** — their builder is inspectable; discovery recipes are the moat/product.  
4. **Differentiation stays:** multi-root monorepo, relationship grade, silence/completeness, zero-build hybrid, claim exams — not “only tool that emits CALM.”  
5. **Possible future interop (research only):** a Weaver module that **ingests Prethink CSVs** if a team already runs Moderne — Goal A multi-provider.  
6. **Bake-off next step:** only valuable if we can run **full** discovery (Moderne trial or OSS recipes if any open elsewhere) on Fineract + saas-boost; OSS kit alone will produce **empty CALM** without Find* recipes.

---

## 7. Open questions

| Q | How to close |
|---|---|
| Are any `io.moderne.prethink.Find*` recipes published under another OSS artifact? | Maven Central / recipe catalog search |
| Exact CALM node-type mapping for data assets vs database | Read rest of `GenerateCalmArchitecture` + sample output |
| Does method-call `interacts` over-connect vs our R2 non-fabrication? | Diff on same Fineract module |
| License allows forking CALM builder? | Legal review of Moderne Source Available License |

---

## 8. Sources

- Local clone: `openrewrite/rewrite-prethink@main` (2026-08-08)  
  - Especially: `UpdatePrethinkContext.java`, `calm/GenerateCalmArchitecture.java`, `table/*.java`, README  
- https://docs.moderne.io/user-documentation/agent-tools/prethink/ (commercial discovery list)  
- Prior spike: `Tier1_Bank_Stacks_and_Semantic_Analysis_Competitors_Research.md`

---

## 9. Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Source-level inventory of OSS rewrite-prethink; clarified discovery vs assembly split; similar-solutions matrix; Weaver implications |
