# Fintech Tier-1 stack expansion research

**Date:** 2026-08-08 (honesty addendum same day)  
**Purpose:** Broaden the Fidelity yardstick with multi-org signals **and** FINOS landscape — and **state plainly whether the result is “solid.”**  
**Candid status:** The P0–P3 “solid list” in §4 is **not solid** in the sense this project uses for solutioning (see §0). It is a **hypothesis backlog** from hiring keywords + industry blogs. Do not treat it as a closed yardstick.

**Follow-on deep research (2026-08-08):** bank dual-estate keywords + Moderne/OpenRewrite Prethink competitor map → [`../spikes/Tier1_Bank_Stacks_and_Semantic_Analysis_Competitors_Research.md`](../spikes/Tier1_Bank_Stacks_and_Semantic_Analysis_Competitors_Research.md).

**Not a claim** that any named firm runs this exact private stack. Evidence grade **H** (hiring) unless noted.

**Authority chain**

| Doc | Role |
|---|---|
| [`Fidelity_Yardstick_Closeout_Matrix.md`](./Fidelity_Yardstick_Closeout_Matrix.md) | Fidelity-only close-out (still primary org yardstick) |
| **This file** | Multi-org expansion + ranked “missing” list for solutioning |
| [`Claim_Register.md`](./Claim_Register.md) | What may be claimed built |
| [`AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md`](./AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md) | Implementation only for already-locked P1 serverless |

---

## 1. Method

1. Collect recurring tech names from **public job postings** and careers pages (Fidelity, Morgan Stanley, Citi, JPMorgan Chase; secondary: general fintech stack guides).  
2. Map each name to an **architect construct** + **signal locus** + **mechanism class** (same schema as Fidelity matrix).  
3. Compare to **existing FY-* rows** and Claim Register.  
4. Rank by: (a) frequency across orgs, (b) architectural impact if missed, (c) fit to Weaver’s four mechanisms, (d) whether we already “feel covered” incorrectly.

**Honest limit:** Hiring lists over-represent popular keywords and under-represent mainframe/COBOL, internal platforms, and vendor products. Use this list for **solutioning candidates**, not for `proven` claims without P/L samples.

---

## 2. Peer-org signal summary (public)

### 2.1 Consensus core (appears across Fidelity + MS + Citi + JPMC-class postings)

| Tech | Orgs (illustrative) | Plane |
|---|---|---|
| **Java / Spring Boot** | All | HTTP + service |
| **REST microservices** | All | HTTP |
| **Kafka** | All (esp. Citi/JPMC event-driven roles) | Messaging |
| **AWS** (often named generically) | All | Cloud multi-plane |
| **Kubernetes / EKS / Docker** | Citi, JPMC, Fidelity | Deploy/trust |
| **Angular and/or React** | MS, Fidelity (Angular); Citi/JPMC (React heavy) | UI |
| **SQL + one cloud/NoSQL** | All | Persist |
| **Python** (services and/or data) | Fidelity, JPMC | Polyglot |
| **OpenAPI / Swagger** | Fidelity, Citi (Swagger named) | Contract |

### 2.2 Strong AWS / cloud-native cluster

| Tech | Signal | Already in FY matrix? |
|---|---|---|
| Lambda | Fidelity AWS lists; fintech serverless guides | **Yes — P1 open** |
| API Gateway | Implied with Lambda SaaS shapes | **Yes — with Lambda** |
| SQS / SNS | Fidelity; general AWS bank postings | **Yes — partial** |
| **Kinesis** | Fidelity AWS lists | **Yes — unevidenced** |
| DynamoDB | Fidelity; Citi postings (Dynamo + Mongo) | **Yes — partial** |
| **S3** | Citi postings explicitly | **No dedicated row** |
| **EKS / k8s** | Fidelity, Citi, JPMC | **Yes — partial** |
| CloudFormation | Fidelity cloud row | **Yes — path join open** |
| Fargate / EC2 | Fidelity | **Yes — unevidenced as entry** |
| **Step Functions / EventBridge** | Common serverless fintech patterns (H weaker than Lambda) | **No** |
| **Azure** (alongside AWS) | Some MS/Citi multi-cloud roles | **No** (AWS-centric today) |
| **GCP** | Less common in these bank postings; appears in fintech guides | **No** |

### 2.3 Messaging beyond Kafka/SQS

| Tech | Signal | In matrix? |
|---|---|---|
| Kafka | Ubiquitous | Partial built |
| SQS/SNS | Cloud-native | Partial built |
| **RabbitMQ** | Citi inventory-management style postings; fintech guides | **No** (JMS/ActiveMQ thin only) |
| Kinesis | Fidelity | Unevidenced |
| JMS/ActiveMQ | Fineract / older bank | Thin |

### 2.4 Persistence / data

| Tech | Signal | In matrix? |
|---|---|---|
| PostgreSQL / relational | All | Partial (driver/JPA) |
| MongoDB | Fidelity, Citi | Thin |
| DynamoDB | Fidelity, Citi | Partial |
| **Redis / ElastiCache** | Fidelity (v0.14), fintech guides, real-time scoring | **Named in v0.14 research, not a FY row** |
| **Cassandra** | Digital-bank / high-scale fintech (e.g. Monzo-class architecture articles); less in Fidelity postings | **No** |
| **Elasticsearch** | Fidelity v0.14 | **No FY row** |
| Snowflake | Fidelity v0.14 data | OOS data-platform-ish |
| Spark / Scala | Fidelity | OOS near-term |

### 2.5 HTTP / service frameworks

| Tech | Signal | In matrix? |
|---|---|---|
| Spring Boot / MVC | Core | Partial/proven path |
| JAX-RS / Quarkus | Enterprise Java | Proven |
| NestJS / Node | Cloud BFF | Proven |
| Flask / FastAPI | Python services | Flask proven; FastAPI thinner |
| **Spring WebFlux / reactive** | Citi “Reactive Frameworks” postings | **No** |
| **Micronaut** | CodeGraph has open request; less bank H | **No** (optional) |
| Lambda handlers | Cloud | **P1 open** |
| **gRPC** | Fintech internal RPC trend; weak in *our* proxies historically | Unevidenced |
| **GraphQL** | BFF/aggregation in modern fintech articles | **No** |

### 2.6 Controls / integration / ops (architect-relevant)

| Tech | Signal | In matrix / platform? |
|---|---|---|
| OAuth2 / OIDC | Fidelity | Partial |
| JWT | BoA-class | Partial |
| **mTLS / service mesh** (Istio/Linkerd) | K8s bank platforms | **No** |
| Resilience4j / circuit breakers | Java design | Specified-unbuilt |
| OpenAPI | Strong | Partial |
| **AsyncAPI** | Event-driven banks (weaker H) | Design backlog historically |
| **Outbound HTTP clients** (Feign, WebClient, RestTemplate, axios) | Universal microservices | **G-L2-13 style gap** — not FY-named but critical for service→service |
| **S3 as integration store** | Citi | **No** |
| Terraform / Helm | Industry | TF unevidenced Weaver; Helm OOS |
| Observability (OpenTelemetry, Prometheus) | JPMC “observability baked in” | Metadata-only backlog historically |

### 2.7 Frontend (for honesty, not near-term build)

| Tech | Signal | Stance |
|---|---|---|
| Angular | Fidelity, MS | OOS deep analysis |
| **React** | Citi, JPMC dominant | OOS — **add to OOS note** (not only Angular) |
| Node BFF | Common | Covered if Nest/Express detected |

---

## 3. What we are **not** missing (avoid false gaps)

Already have a claim/path (even if partial). Do **not** re-discover as “unknown”:

| Area | Status |
|---|---|
| JAX-RS / JPA / Spring Data / jOOQ | Built or partial |
| Flask routes + SQLAlchemy | Proven |
| Nest + OpenAPI dual-unit | Partial |
| Kafka consumer/producer mechanisms | Partial |
| SQS/SNS import | Partial |
| Dynamo import (not ownership) | Partial |
| k8s shared-secret trust | Partial |
| Layered multi-root R2 | Partial/proven with claim triples |
| Lambda HTTP | **Known open P1** — not a research surprise |

---

## 4. Solid candidate list — ranked for solutioning

Priority = **P0** already scheduled · **P1** high multi-org + architect impact · **P2** strong H, fit mechanisms · **P3** real but defer · **OOS** near-term.

### Tier P0 — already on product queue (do not re-litigate)

| ID | Concern | Why solid | Construct | Locus | Mechanism | Action |
|---|---|---|---|---|---|---|
| **X-P0-lambda** | Lambda + API GW HTTP | Fidelity + serverless fintech; hard-test proven miss | service + paths | both | handler + structured-file | **B-lambda-http** Y0–Y5 |
| **X-P0-dynamo-own** | Dynamo client ≠ store | saas-boost FP; Citi/Fidelity Dynamo | database ownership | code | import + priority | **B-dynamo-handler-kind** |

### Tier P1 — high value, multi-org, not yet solidly on matrix as build work

| ID | Concern | Why solid (research) | Architect construct | Locus | Mechanism | Suggested claim / backlog |
|---|---|---|---|---|---|---|
| **X-P1-outbound-http** | Feign / WebClient / RestTemplate / axios / fetch → service→service | Universal in bank microservices; bigger architecture hole than another DB driver | connects service→service | code | import + call (+ optional URL) | **U-http-client** / G-L2-13; **B-http-client** P1 after serverless or parallel |
| **X-P1-redis** | Redis / ElastiCache | Fidelity v0.14; fintech real-time/session/cache; Citi-class caches | database or cache node | code | import | **U-persist-import** row; **B-redis** |
| **X-P1-s3** | S3 buckets as data/integration | Explicit Citi postings; common batch/landing zone | data-asset / storage node | code + infra | import SDK + optional CFN | **U-object-store** or data-asset; **B-s3** |
| **X-P1-spring-mvc-e2e** | Spring Boot `@RestController` as first-class proven | MS/Citi/JPMC default API shape; matrix admits Java Spring thinner than JAX-RS | service + paths | code | native/decorates | Strengthen **U-http** with real Spring wild/lab green — not new mechanism |
| **X-P1-rabbitmq** | RabbitMQ | Named in Citi-style stacks + fintech guides | network | code | import / listener decorates | **U-msg-***; **B-rabbitmq** |

### Tier P2 — clearly fintech-relevant; schedule after P0/P1

| ID | Concern | Why solid | Construct | Locus | Mechanism | Suggested action |
|---|---|---|---|---|---|---|
| **X-P2-kinesis** | Kinesis streams | Fidelity AWS list | network/stream | code/infra | import + event source | **B-kinesis** (already thin backlog) |
| **X-P2-elasticsearch** | Elasticsearch | Fidelity v0.14 | database/search | code | import | Catalogue row when sample |
| **X-P2-cassandra** | Cassandra | High-scale digital bank architectures; some cloud bank roles | database | code | import / driver | Catalogue when P sample |
| **X-P2-webflux** | Spring WebFlux / reactive | Citi “Reactive Frameworks” | service + routes | code | decorates (router functions harder) | Spike; may need new route composition |
| **X-P2-eventbridge-sfn** | EventBridge / Step Functions | Serverless orchestration next to Lambda | network / workflow | infra | structured-file | After B-lambda-http |
| **X-P2-asyncapi** | AsyncAPI | Event-driven contracts peer to OpenAPI | interfaces + channels | docs | structured-file | Design exists historically |
| **X-P2-oauth-depth** | Spring Security OAuth2 resource server | Fidelity OAuth2 H | controls | code | import + config | **B-oauth2-import** |
| **X-P2-resilience4j** | Circuit breaker / retry annotations | Java resiliency standard | controls | code | decorates | Catalogue + units.json |
| **X-P2-azure-functions** | Azure Functions (multi-cloud roles) | Some MS/bank multi-cloud H | service + paths | both | like Lambda | Only if pilot is Azure |

### Tier P3 — real, lower urgency or weaker H for *our* language scope

| ID | Concern | Notes |
|---|---|---|
| **X-P3-graphql** | GraphQL BFF | Popular fintech articles; weaker in Fidelity-core H |
| **X-P3-grpc** | gRPC internal RPC | Still weak in our cloned proxies; re-check before build |
| **X-P3-flink** | Flink streaming | Adjacent to Kafka; data-platform edge |
| **X-P3-terraform-calm** | TF → deploy nodes | CodeGraph indexes TF; Weaver doesn’t consume |
| **X-P3-service-mesh** | Istio mTLS topology | Infra-heavy; trust plane expansion |
| **X-P3-opentelemetry** | OTel instrumentation | Observability metadata, not core CALM story |
| **X-P3-fastapi** | FastAPI Python | Common fintech Python; Flask proven — FastAPI route native if CodeGraph covers |
| **X-P3-kotlin** | Kotlin JVM services | Growing; language expand |

### Tier OOS near-term (account for, don’t build)

| ID | Concern | Why OOS for now |
|---|---|---|
| **X-OOS-react-angular** | Deep UI component graphs | `OOS-full-frontend-analysis` — extend wording to **React + Angular** |
| **X-OOS-spark-scala** | Spark pipelines | `OOS-lang-expansion` / data-platform |
| **X-OOS-mainframe** | COBOL / CICS | Real banks; not Weaver language scope |
| **X-OOS-dotnet** | .NET bank estates | `OOS-lang-expansion` (MS has .NET roles) |
| **X-OOS-vendor-paas** | Salesforce, MuleSoft, Pega | Integration architecture; different product |

---

## 5. Consolidated “solid list” for solution design (recommended intake)

Use this as the **working expansion set** to fold into the yardstick (new rows or backlog), not as committed build-all.

### Must account for in solutioning (claim cell or explicit OOS)

| # | Item | Plane | Prefer |
|---|---|---|---|
| 1 | Lambda + API GW (+ CFN/SAM paths) | HTTP | **Build** (in flight) |
| 2 | Dynamo ownership (handler vs store) | Persist | **Build** (in flight) |
| 3 | **Outbound HTTP clients** (service→service) | HTTP/rel | **Build next architecture priority** |
| 4 | **Redis / cache** | Persist | Catalogue + claim |
| 5 | **S3 object store** | Persist/integration | Catalogue + optional data-asset |
| 6 | Spring Boot REST **parity** with JAX-RS proof | HTTP | Evidence + tests |
| 7 | **RabbitMQ** | Msg | Catalogue |
| 8 | Kinesis | Msg | Sample first |
| 9 | Elasticsearch | Persist | Sample first |
| 10 | OAuth2 / Spring Security depth | Control | After OpenAPI |
| 11 | Resilience4j | Control | Catalogue |
| 12 | EventBridge / Step Functions | Serverless orch | After Lambda |
| 13 | AsyncAPI | Contract | Design when event story matures |
| 14 | WebFlux | HTTP | Spike |
| 15 | Cassandra | Persist | When P sample |
| 16 | gRPC / GraphQL | HTTP | Re-evidence before build |
| 17 | React/Angular deep | UI | **OOS** (name both) |
| 18 | Spark/Scala, .NET, mainframe | Lang | **OOS** |
| 19 | Multi-cloud Azure Functions | HTTP | Pilot-triggered only |

### Suggested solutioning order (after Y0–Y5 serverless program)

```text
1. Finish Fidelity Y0–Y5 (Lambda + Dynamo ownership)     ← stops known cloud lie
2. X-P1-outbound-http                                      ← biggest relationship hole
3. X-P1-redis + X-P1-s3                                    ← cheap import catalogues
4. X-P1-spring-mvc-e2e proof                               ← bank-default HTTP
5. X-P1-rabbitmq + X-P2-kinesis                            ← messaging breadth
6. Controls: OAuth depth + Resilience4j                    ← Fidelity security story
7. Serverless adjacent: EventBridge/SFN                    ← only if Lambda green
8. Everything else stays unevidenced/OOS until sample
```

---

## 6. Mechanism fit (nothing requires a “fifth engine” for P1 list)

| Candidate | Mechanism |
|---|---|
| Outbound Feign/WebClient/axios | import + call (existing C-call / type-ref family) |
| Redis / S3 / Cassandra / ES | import (U-persist-import family) |
| RabbitMQ listeners | decorates + import (messaging catalogue) |
| Kinesis / EventBridge | import + structured-file event source |
| WebFlux routes | decorates / router DSL (may need composer like JAX-RS) |
| AsyncAPI | structured-file (OpenAPI sibling) |

---

## 7. What would still surprise us (honest residual risk)

Even with this list, hard-tests can still find:

- **Vendor-specific** or **internal** frameworks (bank proprietary gateways)  
- **Mainframe adapters** and **file-based** (MQ, NDM) integration  
- **Multi-cloud** Azure/GCP-only shops  
- **GraphQL federation** / BFF-only monorepos  
- **Data mesh** / Spark job graphs as the “architecture”

Those are **generalization** risks, not an excuse to skip locking the solid list above into claim cells.

---

## 8. Recommended doc updates (next pass — not all done this research)

| Action | Target |
|---|---|
| Add FY/X rows for Redis, S3, outbound HTTP, RabbitMQ | Close-out matrix or this file’s intake |
| BACKLOG thin IDs: **B-http-client**, **B-redis**, **B-s3**, **B-rabbitmq** | BACKLOG.md |
| OOS wording: frontend = Angular **and React** | OOS_Registry |
| Do **not** expand Y2–Y5 scope mid-flight | Serverless agent tasks stay focused |

---

## 9. Sources (public, non-exhaustive)

- Project: v0.14 Fidelity matrix; Fidelity yardstick close-out; coe-lab fidelity research; saas-boost hard-test  
- Hiring signals (examples): Fidelity Principal Full Stack (REST, AWS Lambda/EKS/SQS/SNS/Kinesis, Kafka, Python); Morgan Stanley Java/AWS/Spring/Kafka/Angular; Citi Java/React/Spring/Kafka/Kubernetes/S3/Dynamo/Mongo/RabbitMQ-class stacks; JPMorgan Java/Python/React/AWS/K8s/observability  
- Industry: fintech stack guides 2025 (Redis, Kafka/Rabbit, multi-cloud serverless); digital-bank architecture write-ups (Cassandra + k8s + Kafka)

---

## 0. Verdict: is this a solid list? **No.**

### 0.1 What “solid” would mean here (project bar)

A list is solid for **Weaver solutioning** only if each row has:

1. A **defined sampling frame** (not “we googled jobs”)  
2. An **architect construct** + claim cell  
3. A **signal locus** (code / infra / both)  
4. A **mechanism** that fits the platform  
5. A **sample that can fail** the claim (P or L), or explicit unevidenced/OOS  
6. A **stopping rule** (when the list is complete enough to stop expanding)

Hiring aggregation fails (1), (5) for most rows, and (6) entirely. That is the same failure mode `Evidence_Sampling_Methodology_Spike.md` already named for convenience-sampled repos.

### 0.2 What we actually have today

| Artefact | What it is | Solid? |
|---|---|---|
| Fidelity close-out matrix | Structured planes for **one** org’s *named* tech | **Structurally better**, still **H-heavy** for cloud/serverless; not multi-org solid |
| This file’s §4 ranked list | Multi-org **keyword** expansion | **Not solid** — useful as **candidates to falsify**, not as coverage truth |
| Hard-test saas-boost | One real serverless miss | **Solid for that one shape** |
| Claim Register proven cells | What pipeline actually does | **Solid for claims**, narrow vs industry |

**You should not be convinced the §4 list is solid.** The right use is: *things that might deserve a claim cell after proper sampling* — same status as “unmapped catalogue proposals,” not as solution design authority.

### 0.3 What FINOS landscape is (and is not)

Fetched and parsed live: `https://github.com/finos/finos-landscape/main/landscape.yml` (**50 items**, 2026-08-08). Categories:

| Category | Count (approx) | What it is for Weaver |
|---|---|---|
| Enablement | 12 | SIGs, AI governance, OSS readiness — **not** service stacks |
| Data & Business Logic | 12 | **CDM, Legend, Morphir, Rune, TRAC, TraderX, TimeBase, kdb+, OpenMAMA** |
| Applications | 10 | **UI (VUU, regular-table), Symphony BDK** ecosystem |
| Platforms & Runtimes | 10 | **FDC3**, Spring Bot, **Fluxnova BPM**, **HTC grid / HPC** schedulers |
| Infrastructure | 3 | **Common Cloud Controls**, **Waltz**, **CALM (architecture-as-code)** |
| Legend / FINOS | 3 | Modelling initiatives |

**Critical honesty:** FINOS landscape is **not** a catalogue of “Spring, Lambda, Redis, Kafka.” It is a catalogue of **capital-markets open-source projects and standards**. Using it as a **tech-stack shopping list** is a category error. Using it as a **sampling frame for runnable / greppable systems** (Waltz, TraderX, TimeBase, Symphony BDK, FDC3 apps, Fluxnova) is exactly what this project already decided in the evidence-sampling spike — and is the right FINOS use for Weaver.

**What landscape *does* surface that hiring lists under-weight:**

| FINOS signal | Architect plane | On our Fidelity/tier-1 list? |
|---|---|---|
| **FDC3** desktop interop | Interop / desktop platform | **No** (we barely mention) |
| **Symphony** chat BDK (Java/Python) | Collaboration integration | **No** |
| **Common Domain Model / Legend / Morphir / Rune** | Domain model / DSL | **No** as detection targets |
| **kdb+ / TimeBase / OpenMAMA** | Market data / time-series | **No** (huge capital-markets hole) |
| **Fluxnova** (BPM) | Workflow orchestration | **No** (we have vague Step Functions only) |
| **HTC grid / HPC schedulers** | Batch/compute grid | **No** (we have Spring Batch/Spark only) |
| **Common Cloud Controls** | Cloud control baseline (not app routes) | **No** as input evidence |
| **TraderX** | Trading reference app | Named historically; source still hard |
| **Waltz / CALM** | Already in our world | Yes |

So: if the question is “what are we missing for **Fidelity-like AWS microservices**?” → FINOS landscape is a **weak** primary frame.  
If the question is “what are we missing for **capital-markets / FINOS-adjacent architecture**?” → landscape says we are missing **entire planes** (desktop interop, market-data stacks, BPM, HPC), not just Redis and RabbitMQ.

### 0.4 Two different “lists” we keep conflating

| List type | Question | Good sources | Our status |
|---|---|---|---|
| **A. Implementation stack** (how services are built) | Spring? Lambda? Dynamo? | Job posts, cloud reference apps, greppable monorepos | Partial; hiring-inflated |
| **B. Domain / platform surface** (what financial systems *are*) | Trading? Market data? Desktop interop? BPM? | FINOS landscape, CDM, FDC3 | **Badly under-specified** in solutioning |

A “solid” programme needs **both**, with explicit product scope: Weaver today is mostly **A** (service CALM from code+infra). Claiming Fidelity/MS/Citi readiness from **A-only** still misses what FINOS treats as first-class financial tech.

---

## 10. Changelog

| Date | Note |
|---|---|
| 2026-08-08 | **Honesty addendum §0:** §4 list is **not solid**; FINOS landscape.yml parsed (50 items) — use as sampling frame / domain planes, not Spring/Lambda shopping list; dual list types A vs B |
| 2026-08-08 | Initial multi-org expansion research + ranked candidate list; complements Fidelity close-out without replacing it |
