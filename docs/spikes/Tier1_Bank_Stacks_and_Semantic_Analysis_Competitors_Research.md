# Research: Tier-1 bank stacks (legacy + modern) + semantic analysis competitors

**Date:** 2026-08-08  
**Status:** Systematic research spike — **hypothesis and competitive intelligence**, not a solid yardstick close-out  
**Why it exists:** (1) Broaden List **A** (implementation stack) beyond Fidelity-only hiring with **legacy + modern** peers. (2) Deep-dive **deterministic semantic / framework / code-graph** tools that solve adjacent problems (esp. Moderne Prethink / OpenRewrite → **FINOS CALM**). (3) Feed dual-frame solutioning without pretending the list is complete.

| This doc is | This doc is not |
|---|---|
| Multi-source **H**-grade stack map + competitor feature map | Proof any bank runs exactly this |
| Competitive positioning for Weaver | A Claim Register update (do that separately) |
| Input to dual A/B matrix skeleton (§6) | Implementation plan |

**Related:** [`Fidelity_Yardstick_Closeout_Matrix.md`](../solution/Fidelity_Yardstick_Closeout_Matrix.md) · [`Fintech_Tier1_Stack_Expansion_Research.md`](../solution/Fintech_Tier1_Stack_Expansion_Research.md) · FINOS landscape · v0.14 · Solution Design v2 §6 engines

---

## 0. Method and honesty bar

### 0.1 Two research tracks

| Track | Question | Sources this pass |
|---|---|---|
| **Track 1 — Org stacks** | What do Fidelity **peers** hire for (legacy + modern)? | Public postings: Fidelity, Citi, Morgan Stanley, JPMorgan Chase, Goldman-class; secondary industry notes |
| **Track 2 — Similar solutions** | Who else does deterministic semantic analysis / framework discovery / code graphs / architecture export? | Moderne docs, OpenRewrite/rewrite-prethink, CodeQL, Joern, Semgrep, Sourcegraph; prior project engine research |

### 0.2 Evidence grades (same discipline as yardstick)

| Grade | Meaning |
|---|---|
| **H** | Hiring / careers copy |
| **P** | Public proxy code or published tool docs |
| **L** | Lab / our pipeline |
| **—** | Named in industry blogs only |

**Stopping rule for this spike:** document findings + dual skeleton; do **not** promote H-only rows to Claim Register `proven`.

### 0.3 Known bias

- Job posts **over-weight** greenfield cloud (Java/React/Kafka/K8s) and **under-weight** silent mainframe estates unless you search COBOL/CICS deliberately.  
- Tool vendor docs **over-claim** coverage; we record **documented** discovery lists, not measured recall.  
- We did **not** run Moderne/OpenRewrite against Fineract/saas-boost this pass — comparison is **feature/architecture**, not bake-off metrics.

---

# Part I — Track 1: Tier-1 bank / capital-markets stacks

## 1. Org coverage this pass

| Org | Role of evidence | Notes |
|---|---|---|
| **Fidelity** | Primary prior yardstick + **mainframe postings** (CICS, COBOL, DB2, MQ) | Dual estate: AWS cloud *and* z/OS |
| **Citi** | Strong modern full-stack H | Java/Spring Boot, React, Kafka, K8s, Oracle, GraphQL named, RabbitMQ-class, S3/Dynamo/Mongo in some roles |
| **Morgan Stanley** | Modern H | Java, Spring/Spring Boot, Kafka, AWS, Angular, microservices (Parametric and similar) |
| **JPMorgan Chase** | Modern H | Java/Spring Boot, Kafka, React, Python, K8s/Docker, Cassandra/Mongo/Elasticsearch-class NoSQL, event-driven payments |
| **Goldman Sachs** | Engineering careers (less stack laundry-list) | Distributed systems, DBs, multi-language; quant adjacent |
| **FINOS landscape** | Domain/platform (List B) | Separate from job keywords — see prior expansion doc §0.3 |

## 2. Dual-estate model (critical for “old fintech”)

Large incumbents are **not** “all Spring on EKS.” Public Fidelity postings alone show a **parallel mainframe track**:

| Estate | Tech (H, Fidelity-class) | Architect construct for Weaver? |
|---|---|---|
| **Legacy core** | COBOL, JCL, **CICS**, **DB2**, VSAM, **MQ-Series**, z/OS, CICS systems programming | Transactions, queues, datastores — **OOS language** today (`OOS-lang-expansion`) but must appear as **accounted-for** plane |
| **Bridge / modernization** | Java + COBOL, MQ, Azure/AWS *and* mainframe, hybrid roles | Integration edges mainframe↔distributed — unevidenced for Weaver |
| **Modern distributed** | Java/Spring, Node, Python, K8s, Kafka, cloud DBs | Primary Weaver target |
| **Desktop / markets** (FINOS) | FDC3, Symphony, kdb, TimeBase | List B — mostly OOS or future |

**Solutioning implication:** A “solid” bank yardstick has rows for **legacy estate (OOS with reason)** and **bridge patterns (unevidenced)**, not only microservices.

## 3. Keyword map — modern estate (H-aggregated, multi-org)

### 3.1 Languages & app frameworks

| Keyword | Orgs (illustrative) | Plane | On Fidelity matrix? |
|---|---|---|---|
| Java | All | core | Yes |
| Spring Boot / Spring | Citi, JPMC, MS, Fidelity | HTTP | Partial |
| React | Citi, JPMC | UI | OOS deep (Angular only named before) |
| Angular | MS, Fidelity | UI | OOS |
| Python | Fidelity, JPMC | polyglot | Partial (Flask) |
| Node / TypeScript | JPMC, fintech | HTTP | Nest partial |
| GraphQL | Citi (API) | HTTP | Unevidenced |
| .NET | Some MS/bank multi-stack | — | OOS lang |

### 3.2 Messaging & integration

| Keyword | Orgs | On matrix? |
|---|---|---|
| Kafka | Ubiquitous modern | Partial built |
| RabbitMQ / AMQP | Citi-class | Candidate (not solid) |
| JMS / MQ / MQ-Series | Fidelity mainframe + enterprise | Thin / mainframe MQ different |
| Spring Cloud Stream | Moderne discovers; less explicit H | Unevidenced us |

### 3.3 Data

| Keyword | Orgs | On matrix? |
|---|---|---|
| Oracle | Citi | Relational driver thin |
| PostgreSQL / SQL | Broad | Partial |
| MongoDB | Citi, Fidelity | Thin |
| Cassandra | JPMC postings | Candidate |
| Elasticsearch / “Elastiq” | JPMC | Candidate |
| DynamoDB | Fidelity, Citi | Partial |
| Redis / cache | Fidelity v0.14, industry | Candidate |
| DB2 / VSAM | Fidelity mainframe | OOS |
| S3 | Citi | Candidate |

### 3.4 Cloud & runtime

| Keyword | Orgs | On matrix? |
|---|---|---|
| AWS (generic) | Most | Split planes |
| Lambda / serverless | Fidelity AWS lists | **P1 open** |
| EKS / Kubernetes / Docker | Citi, JPMC, Fidelity | Partial k8s |
| Azure (+ mainframe hybrid) | Fidelity mainframe jobs | Unevidenced multi-cloud |
| CloudFormation | Fidelity | Path join open |
| Terraform | Industry | Unevidenced Weaver |

### 3.5 Security & quality (modern H)

| Keyword | Notes |
|---|---|
| OAuth2 / JWT / Spring Security | Fidelity + general |
| TDD / automated tests | Nearly universal modern postings |
| Observability | JPMC program language |

### 3.6 Legacy estate keywords (must not omit)

| Keyword | Estate | Weaver stance |
|---|---|---|
| COBOL, JCL, CICS, z/OS | Core banking transactions | **OOS** language; document as plane |
| DB2, VSAM | Mainframe data | OOS |
| MQ-Series / IBM MQ | Integration spine | Future bridge; not CodeGraph Java |
| CICS systems programmer | Infra not app CALM | OOS |

## 4. Track 1 conclusions (candid)

1. **Modern peer stacks converge** on Java/Spring + React/Angular + Kafka + K8s + cloud data variety — consistent with prior expansion.  
2. **Legacy is real and public** (especially Fidelity mainframe hiring) — our Fidelity close-out under-weighted it.  
3. This still does **not** make a solid List A; it improves the **nomination set** and forces **legacy OOS honesty**.  
4. **List B** (FINOS) remains orthogonal: FDC3, market data, CDM, BPM — not replaced by job keywords.

---

# Part II — Track 2: Similar solutions deep dive

## 5. Competitive landscape map

### 5.1 Problem classes (do not conflate)

| Problem class | Typical output | Example tools |
|---|---|---|
| **C1 Refactor / migrate at scale** | Code edits | OpenRewrite, Moderne platform |
| **C2 Security SAST / taint** | Vulns, dataflow | CodeQL, Semgrep, Joern (often) |
| **C3 Code search / nav** | Symbols, refs | Sourcegraph, SCIP/LSIF, IDE LSP |
| **C4 Architecture structure** | Layers, deps, smells | ArchUnit, Structure101, CodeScene, Sonar arch |
| **C5 Framework-aware discovery → architecture model** | Endpoints, DBs, messaging, **CALM** | **Moderne Prethink**, (partially) Weaver |
| **C6 Agent context packaging** | Files for LLMs | Prethink, various MCP/skills |

**Weaver sits primarily in C5** (deterministic architecture extraction → CALM), with honesty/completeness (AREC) as differentiator. Prethink now also occupies **C5 + C6** and optionally LLM comprehension.

### 5.2 Moderne + OpenRewrite + rewrite-prethink (primary deep dive)

#### Product split

| Piece | Role | License / access |
|---|---|---|
| **OpenRewrite** | OSS semantic refactor engine on **Lossless Semantic Tree (LST)** | Apache-style OSS |
| **org.openrewrite.recipe:rewrite-prethink** | OSS **building blocks**: export context CSV/MD, agent config update, **CALM generation hook** | OSS on GitHub `openrewrite/rewrite-prethink` |
| **io.moderne.recipe:rewrite-prethink** (Moderne) | **Pre-configured discovery** (Spring MVC, JAX-RS, JPA, Kafka, …) + quality + optional LLM | Moderne commercial module |
| **Moderne Platform / CLI / MCP** | Multi-repo LST warehouse, recipe runs at scale, agent `run_recipe` | Commercial |

#### Core model: LST (not CodeGraph, not CPG)

| Property | LST (OpenRewrite) | Implication |
|---|---|---|
| Type-attributed | Yes | Framework recipes resolve types, not text |
| Format-preserving | Yes | Refactors keep style |
| Build-coupled | Typically **build produces LST** (Maven/Gradle) | Precision ↑; onboarding friction ↑ (same tension as our Phase-2 CodeQL decision) |
| Scale | Local = in-memory; Moderne = stored LSTs multi-repo | Enterprise control plane |

#### What Prethink **documents** as discovery coverage (P — vendor docs, 2026)

**Java/JVM endpoints:** Spring MVC, JAX-RS, Micronaut, Quarkus, GraphQL (Spring GraphQL, Netflix DGS), gRPC, WebSocket  

**Java data:** JPA, Spring Data, JDBC, MyBatis  

**Java outbound HTTP:** RestTemplate, WebClient, Feign, Apache HttpClient, OkHttp, JAX-RS clients  

**Java messaging:** Kafka, RabbitMQ, JMS, Spring Cloud Stream, **AWS SQS**  

**Java security:** Spring Security, CORS, OAuth2  

**Java other:** `@Service`/`@Component`, entities/DTOs, `@Scheduled`/Quartz/EJB Timer  

**Node:** Express, Fastify, NestJS; Mongoose, Prisma, TypeORM; axios/fetch/got; KafkaJS, amqplib, Bull; cors/helmet/passport  

**Python:** Django, FastAPI, Flask; SQLAlchemy, Django ORM  

**Cross-cutting Prethink:** dependency trees (incl. transitive), coding conventions, error patterns, method/class/package **quality metrics**, code smells (God Class, Feature Envy, Data Class), test mapping/gaps/quality, optional LLM descriptions, **deployment artifacts** (Dockerfile, K8s, compose), **FINOS CALM JSON + Mermaid**

#### How Prethink works (pipeline)

```text
Build/open LST
  → composite recipe phases:
      Phase 1: architectural Find* recipes → data tables
      Phase 1.5: FindCalmRelationships (call graph between entities)
      Phase 2: quality metrics + smells
      Phase 3: tests + dependencies
      Phase 4: UpdatePrethinkContext → calm-architecture.json, CSVs, agent config
  → .moderne/context/ committed or refreshed
  → agents read facts; optional MCP re-run after edits
```

**Determinism:** Discovery and CALM export are positioned as **deterministic LST analysis**. Optional **LLM code comprehension** is a separate phase (token estimates even in no-AI starter). Aligns philosophically with Weaver’s “no LLM on core path” if using no-AI starter; Moderne also offers AI-assisted variants.

#### Direct overlap with Weaver (critical)

| Capability | Moderne Prethink | Weaver (today) |
|---|---|---|
| **Output CALM** | **Yes** (`calm-architecture.json`) | **Yes** (primary product) |
| Framework HTTP (Spring, JAX-RS, Nest, Flask…) | Broad documented recipe set | Proven subset; Spring thinner than JAX-RS |
| JPA / Spring Data / JDBC | Documented | Built/partial |
| Kafka / Rabbit / JMS / SQS | Documented | Kafka+SQS partial; Rabbit thin |
| **Outbound HTTP clients** | First-class discovery | **Known gap (G-L2-13)** |
| GraphQL / gRPC / WebSocket | Documented | Unevidenced / open |
| MyBatis | Documented | Historically unevidenced |
| Security (Spring Security, OAuth2) | Documented | Partial (PreAuthorize, OpenAPI schemes) |
| K8s / Docker as deploy artifacts | Documented FindDeploymentArtifacts | Partial k8s trust |
| Lambda / API GW / CFN path join | **Not in documented list** | Our hard-test gap / P1 |
| Mainframe COBOL/CICS | No | OOS |
| Multi-hop layered architecture honesty | Not their claim | **AREC / R2 / standing exams** |
| Completeness silence (S1…) | Not their claim | Differentiator |
| Claim Register / eval L0–L5 | No | Differentiator |
| Zero-build source-only Java | Our Phase-1 posture | Their LST is build-oriented |
| Agent context packaging | Core Prethink purpose | Residual session / IR (partial) |
| Mass refactor recipes | OpenRewrite core | Out of scope |

**Strategic reading (not marketing):**

1. **CALM is no longer Weaver-only territory** — Moderne Prethink explicitly emits FINOS CALM architecture.  
2. Prethink’s discovery catalogue is a **de facto coverage checklist** for List A — denser than our hiring-derived list on **outbound clients, GraphQL, gRPC, MyBatis, quality metrics**.  
3. Weaver’s differentiation is **not** “we invent CALM export”; it is **polyglot monorepo orchestration, dual-engine zero/low-build path, relationship grade honesty (R0/R1/R2), completeness silence, overrides/HITL, claim discipline**.  
4. **Do not copy Prethink’s claim list into “we must build all”** without samples — but **do** use it as a **competitor-informed nomination frame** stronger than job keywords alone.  
5. Possible future **interop**: consume Prethink CSVs/CALM as an evidence provider module (Goal A platform) — research only, not decided.

### 5.3 CodeQL

| Dimension | Detail |
|---|---|
| Model | Compile → relational DB (AST, CFG, dataflow) |
| Strength | Deep semantic queries, taint, variant analysis |
| Framework awareness | Via QL libraries (Java Spring etc.) — security-first |
| Architecture CALM | Not product focus |
| vs Weaver | Overlaps Phase-2 precision path; heavy build; C2 not C5 |

### 5.4 Joern (CPG)

| Dimension | Detail |
|---|---|
| Model | Code Property Graph (AST+CFG+DDG), fuzzy parse options |
| Strength | Interprocedural security graphs, less full-build than CodeQL sometimes |
| Architecture CALM | Not product focus |
| vs Weaver | C2/C3; not framework-catalogue CALM |

### 5.5 Semgrep

| Dimension | Detail |
|---|---|
| Model | Tree-sitter AST patterns; fast; limited deep interproc |
| Strength | Rules-as-code, CI speed |
| vs Weaver | Pattern catalogue spirit similar; shallower architecture story |

### 5.6 Sourcegraph

| Dimension | Detail |
|---|---|
| Model | Search index, navigation, batch changes |
| Strength | Enterprise multi-repo find |
| vs Weaver | C3; not CALM construction |

### 5.7 Structure / quality (brief)

| Tool | Notes vs Weaver |
|---|---|
| ArchUnit | Test-time architecture rules (Java) — enforce, don’t extract CALM |
| Sonar / CodeScene | Quality & hotspots — Prethink quality closer to this than Weaver |
| jQAssistant | Neo4j + concepts — prior design backlog for Java |

### 5.8 CodeGraph / Graphify (our engines)

Already selected for Weaver structural backbone; CodeGraph framework resolvers ≈ thin cousin of OpenRewrite framework visitors, **without** LST type attribution or CALM export.

---

## 6. Dual-frame skeleton (A implementation / B domain) — mostly empty = honest

### 6.1 List A — implementation mechanisms (fill from jobs + Prethink + our claims)

Status codes: `built` · `partial` · `open` · `OOS` · `nominate` (not solid)

| ID | Concern | Nominated by | Weaver | Prethink docs | Next for solidity |
|---|---|---|---|---|---|
| A-http-spring | Spring MVC routes | Jobs + Prethink | partial | yes | Wild Spring exam |
| A-http-jaxrs | JAX-RS | Us + Prethink | proven | yes | maintain |
| A-http-nest-flask | Nest/Flask | Us + Prethink | proven | yes | maintain |
| A-http-graphql | GraphQL | Citi H + Prethink | nominate | yes | sample |
| A-http-grpc | gRPC | Prethink + industry | unevidenced | yes | sample |
| A-http-lambda | Lambda+APIGW | Fidelity H + hard-test | **open P1** | not listed | Y0–Y5 program |
| A-http-outbound | Feign/WebClient/axios | Prethink + gap G-L2-13 | **open** | yes | high value |
| A-db-jpa-sd-jdbc | JPA/Spring Data/JDBC | Both | partial/proven | yes | maintain |
| A-db-mybatis | MyBatis | Prethink | nominate | yes | sample |
| A-db-dynamo | Dynamo | Jobs + us | partial | SQS yes; Dynamo? | ownership P1 |
| A-db-mongo-cass-es-redis | NoSQL/cache variety | Jobs | nominate/thin | Node ORMs more | samples |
| A-msg-kafka | Kafka | All | partial | yes | maintain |
| A-msg-rabbit-jms-sqs | Rabbit/JMS/SQS | Jobs + Prethink | partial SQS | yes | Rabbit sample |
| A-sec-spring-oauth | Spring Security/OAuth2 | Both | partial | yes | depth |
| A-deploy-k8s-docker | K8s/Docker | Both | partial trust | yes artifacts | — |
| A-batch-scheduled | @Scheduled/Quartz | Prethink | nominate | yes | — |
| A-quality-metrics | Complexity/smells | Prethink | OOS product? | core Prethink | optional module |
| A-legacy-cobol-cics | Mainframe | Fidelity H | **OOS** | no | document only |
| A-mq-series | IBM MQ | Fidelity H | OOS/bridge | no | — |

### 6.2 List B — domain / platform (FINOS-weighted)

| ID | Concern | Source | Weaver stance |
|---|---|---|---|
| B-fdc3 | Desktop interop | FINOS landscape | OOS / future |
| B-symphony | Collab BDK | FINOS | OOS / future |
| B-cdm-legend | Domain models/DSL | FINOS | OOS / future |
| B-market-data | kdb, TimeBase, OpenMAMA | FINOS | OOS / future |
| B-bpm | Fluxnova | FINOS | OOS / future |
| B-hpc-grid | HTC / OpenGRIS | FINOS | OOS / future |
| B-ccc | Common Cloud Controls | FINOS | Policy input not scan |
| B-traderx | Trading ref app | FINOS | Sample candidate when source usable |
| B-waltz-calm | Already adjacent | FINOS | In use |

---

## 7. Implications for Weaver solutioning

### 7.1 Do now (process)

1. Treat **Moderne Prethink discovery list** as a **primary nomination source for List A**, stronger than job keywords alone.  
2. Keep **job keywords** for **legacy dual-estate** and org-specific clouds (Azure hybrid, Oracle).  
3. Keep **FINOS landscape** for List B only.  
4. **Never** mark A-rows solid without fail sample.  
5. Update messaging: Weaver is **not** “the only CALM generator”; differentiate on **honesty, multi-root, zero-build hybrid, residual/HITL, polyglot monorepo**.

### 7.2 Do not do now

- Panic-build every Prethink recipe.  
- Claim parity with Moderne.  
- Expand serverless Y-program scope mid-flight to absorb all of Prethink.

### 7.3 High-value gaps Prethink makes painful (if we ignore them)

| Gap | Why painful |
|---|---|
| Outbound HTTP | They ship it; architects need service→service |
| GraphQL/gRPC | Documented there; we unevidenced |
| MyBatis | Common enterprise; we missed historically |
| CALM as competitive surface | They emit it; quality of our CALM vs theirs is the product fight |
| Build-LST vs source-only | Different tradeoff — keep Phase-1 honesty |

### 7.4 Open research questions (next spikes)

| Q | Why |
|---|---|
| Can we run OSS rewrite-prethink (or Moderne CLI trial) on Fineract / saas-boost and **diff CALM** vs Weaver? | Only way to move beyond doc comparison |
| Does Prethink handle **API GW + Lambda** or multi-module R2-style stories? | Our differentiator candidates |
| LST build cost vs our Graphify+CodeGraph path on same monorepo | Efficiency / onboarding |
| Legal/product: dual-write CALM from both tools | Interop |

---

## 8. Sources

### Track 1 (illustrative H)

- Fidelity: cloud full-stack AWS lists (prior v0.14); **Principal CICS / Mainframe COBOL-CICS-DB2-MQ** careers  
- Citi: Java/Spring Boot/React/Kafka/K8s/Oracle/GraphQL-class full-stack VP/lead postings  
- Morgan Stanley: Java/AWS/Spring/Kafka/Angular-class roles  
- JPMorgan: Java/Spring Boot/Kafka/React/Python/K8s; Cassandra/Mongo/Elasticsearch-class data  

### Track 2

- https://docs.moderne.io/user-documentation/agent-tools/prethink/  
- https://moderne.ai/ (LST, recipes, Prethink positioning)  
- https://github.com/openrewrite/rewrite-prethink  
- https://docs.openrewrite.org/concepts-and-explanations/lossless-semantic-trees  
- CodeQL / Semgrep / Joern / Sourcegraph public docs and comparisons  
- Project: Solution Design v2 §6, Java solution design engines, Claim Register  

---

## 9. Changelog

| Date | Note |
|---|---|
| 2026-08-08 | **Source deep-dive:** [`OpenRewrite_Prethink_Source_and_Similar_Solutions_Research.md`](./OpenRewrite_Prethink_Source_and_Similar_Solutions_Research.md) — OSS rewrite-prethink is tables+CALM assembly only; Find* discovery not in public repo |
| 2026-08-08 | Initial systematic dual research: bank dual-estate keywords + Moderne/OpenRewrite Prethink deep dive + dual A/B skeleton |
