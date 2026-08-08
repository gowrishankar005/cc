# Fidelity yardstick — close-out matrix (solutioning authority)

**Status:** active discovery artefact (2026-08-08)  
**Product:** Weaver  
**Org yardstick:** **Fidelity Investments** (one real fintech institution — public signals only; not an assertion that Fidelity runs exactly this topology)  
**Purpose:** Every yardstick-named technology is forced into **architect construct → signal locus → mechanism → claim → sample → status**. Blank cells are process defects. This is the gate that would have forced Lambda HTTP into solutioning without waiting for hard-test #2.

| This file is | This file is not |
|---|---|
| Solutioning authority for Fidelity-aligned product surface | A claim that Weaver “supports Fidelity’s private monorepo” |
| Input to Claim Register + BACKLOG + agent tasks | Marketing coverage |
| Living: update when evidence or implementation changes | A substitute for standing exams |

**Related:** [`Claim_Register.md`](./Claim_Register.md) · [`BACKLOG.md`](./BACKLOG.md) · [`AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md`](./AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md) · [`Catalogue_Intake.md`](./Catalogue_Intake.md) · v0.14 · [`coe-lab/docs/fidelity-and-fintech-stack-research.md`](../../coe-lab/docs/fidelity-and-fintech-stack-research.md) · **multi-org expansion:** [`Fintech_Tier1_Stack_Expansion_Research.md`](./Fintech_Tier1_Stack_Expansion_Research.md) · **competitor + dual-estate research:** [`../spikes/Tier1_Bank_Stacks_and_Semantic_Analysis_Competitors_Research.md`](../spikes/Tier1_Bank_Stacks_and_Semantic_Analysis_Competitors_Research.md)

---

## 0. Evidence grades (honesty)

| Grade | Meaning | May green a claim? |
|---|---|---|
| **H** | Hiring / job-posting signal (Fidelity careers / public postings) | Only to **scope** a claim cell; never alone for `proven` |
| **O** | Fidelity public OSS (`fidelity-contributions/*`) | Supports language/tooling shape; rarely service HTTP |
| **P** | Public **proxy** monorepo (Fineract, BoA, Waltz, aws-saas-boost, Ghostfolio, …) | Yes for mechanism `partial`/`proven` when cited |
| **L** | Lab / synthetic package designed to the yardstick shape | Yes for mechanism regression; label as lab |
| **—** | Named historically but no grade yet | Cell stays unevidenced / specified-unbuilt |

**Rule:** H without P/L → claim may be `specified-unbuilt` or `unevidenced`, never `proven`.

---

## 1. Research summary (reassessment)

### 1.1 Sources used this pass

| Source | What it contributes |
|---|---|
| `CALM_Generator_Requirements_v0_14.md` | Original Fidelity matrix + §2 productized only Dynamo, SQS/SNS, Spark/Scala, frontend, OpenAPI, multi-DB, OAuth2 — **not** Lambda as HTTP |
| `coe-lab/docs/fidelity-and-fintech-stack-research.md` | Lab mapping; **historical miss:** Lambda collapsed into k8s deploy |
| `docs/solution/language/java.md` §2 | Mechanism map; Lambda absent as HTTP entry row |
| Public Fidelity-aligned postings (e.g. Principal Full Stack Java: REST, AWS, Kafka, Python; AWS lists often include **Lambda, EKS, SQS, SNS, Kinesis**; Spring Boot + Angular + OpenAPI common) | Confirms multi-plane AWS + Java core |
| Fidelity OSS | k8s tooling (Go), ML/quant Python — not service CALM primary |
| CoE hard-test `aws-saas-boost-tier-service` | **P** for Lambda `RequestHandler` + API GW paths in CFN + Java Dynamo — disconfirming for current platform |

### 1.2 What the earlier programme productized vs named

| Named in Fidelity materials | Productized in §2 / T-E3 / backlog? | Bin used | Outcome |
|---|---|---|---|
| DynamoDB | Yes — import persistence | Data | Partial/proven (Node lab; Java coarse) |
| SQS/SNS | Yes — messaging import | Messaging | Partial (merge fix) |
| OpenAPI | Yes — later dual-unit + C-contract | API contract | Partial |
| OAuth2 | Catalogue intent | Control | Partial / thin |
| Kafka | Via Fineract path | Messaging | Partial |
| EKS / k8s | k8s trust path | Deploy | Partial |
| **Lambda** | **No as HTTP** | **Deploy/cloud lump** | **Miss → HT-ASB-001** |
| CloudFormation | Named only | Deploy lump | **Unbuilt** (paths for Lambda live here) |
| Kinesis | Named in postings | Messaging/stream | **Unevidenced product cell** |
| Fargate / EC2 | Named | Deploy | OOS or metadata-only near-term |
| Angular / RxJS | Named | Frontend | OOS near-term (`OOS-full-frontend-analysis`) |
| Spark / Scala | Named | Batch/lang expand | OOS near-term (`OOS-lang-expansion`) |

### 1.3 Process rule locked by this document

> For each yardstick name: **Claim ID + backlog/OOS ID + sample that can fail the claim**, or the solution design is incomplete.  
> Neighbour-mapping (“Lambda → k8s”) is invalid unless the proxy’s **authority line** explicitly allows greening that claim.

---

## 2. Plane model (architect view)

| Plane ID | Architect question | Typical CALM |
|---|---|---|
| **P-http** | How does an external request enter a service? | `service` + path/url interfaces |
| **P-persist** | Where is durable state owned? | `database` / `data-asset` + connects |
| **P-msg** | How do async events enter/leave? | `network`/topic + connects |
| **P-batch** | What runs as scheduled/batch work? | `service` (batch) or future kind |
| **P-ctrl** | What security/resiliency controls are evidenced? | `controls` + evidence |
| **P-trust** | How are services placed / secrets shared? | relationships + deploy metadata |
| **P-contract** | What API contracts are declared? | interfaces + control schemes |
| **P-ui** | What client apps exist? | `webclient` (future) |
| **P-data-platform** | What offline/ML pipelines exist? | future / OOS near-term |

---

## 3. Close-out matrix (authoritative)

**Columns**

| Column | Meaning |
|---|---|
| **ID** | Stable yardstick row id |
| **Yardstick name** | Tech as named in Fidelity signals / v0.14 |
| **Plane** | From §2 |
| **Architect construct** | What the architect needs to see |
| **Signal locus** | `code` / `infra` / `both` / `docs` |
| **Mechanism class** | native · decorates · import · structured-file · call · field-type · extends · (none/OOS) |
| **Claim cell** | Claim Register id (or new) |
| **Evidence** | H/O/P/L + pointer |
| **Sample that can fail** | Lab or wild package |
| **Weaver status** | `built` · `partial` · `specified-unbuilt` · `unevidenced` · `OOS` |
| **Product action** | Backlog / OOS / none |

### 3.1 HTTP entry (P-http)

| ID | Yardstick name | Architect construct | Signal locus | Mechanism | Claim | Evidence | Fail sample | Status | Product action |
|---|---|---|---|---|---|---|---|---|---|
| **FY-http-spring** | Spring MVC / Boot REST | service + path interfaces | code | native + decorates | **U-http** | H + P (BoA Java services; lab spring) | lab `java-spring-payments`; BoA Java | **partial** (Java Spring native still thin vs JAX-RS proven) | catalogue/regression as needed; not blocking serverless |
| **FY-http-jaxrs** | JAX-RS / Quarkus-style REST | service + composed paths | code | decorates + compose | **U-http** | P Fineract | fineract-charge | **built/proven** | maintain |
| **FY-http-flask-nest** | Flask / NestJS APIs | service + paths | code | native | **U-http** | P/L BoA, Nest | BoA, lab nestjs | **proven** | maintain |
| **FY-http-lambda** | **AWS Lambda + API Gateway** | service + **HTTP path/method interfaces** | **both** (handler code + API GW/CFN/SAM) | **decorates/extends/implements (handler) + structured-file (paths)** | **U-http-serverless** | H (Lambda in AWS lists) + **P** saas-boost | **aws-saas-boost-tier-service**; lab lambda (Y1) | **specified-unbuilt** | **B-lambda-http** (P1) |
| **FY-http-fargate-ec2** | Fargate / EC2 process HTTP | service (container/process) | infra+code | structured-file deploy + code routes | — | H | none | **unevidenced** as distinct entry | defer; routes still via FY-http-*; deploy metadata later |
| **FY-http-grpc** | gRPC | service + rpc interfaces | code | unevidenced | — | checked absent in proxies | — | **unevidenced** | no backlog until P evidence |

### 3.2 Persistence (P-persist)

| ID | Yardstick name | Architect construct | Signal locus | Mechanism | Claim | Evidence | Fail sample | Status | Product action |
|---|---|---|---|---|---|---|---|---|---|
| **FY-db-jpa** | JPA / entities | database | code | decorates | **U-entity** | P Fineract | fineract-core | **proven** | maintain |
| **FY-db-spring-data** | Spring Data repos | database (repo) | code | extends | **U-spring-data** | P Fineract ChargeRepository | same | **partial** | maintain |
| **FY-db-jooq** | jOOQ | database | code | import | **U-jooq** | P Waltz | waltz-data | **partial/proven Waltz** | maintain |
| **FY-db-sqlalchemy** | SQLAlchemy | database | code | import | **U-persist-import** | P BoA | userservice | **proven** | maintain |
| **FY-db-postgres-driver** | PostgreSQL driver | database | code | import | **U-persist-import** | P Fineract security | fineract-security | **partial** | maintain |
| **FY-db-mongo** | MongoDB | database | code | import | **U-persist-import** | P CALM Hub named | — | **partial/thin** | catalogue verify if pilot needs |
| **FY-db-dynamo** | **DynamoDB** | database store unit | code | import (+ ownership) | **U-persist-import** | H + L Node + **P** Java saas-boost | lab ts-orders-dynamo; **TierService FP** | **partial** — import yes; **handler mis-kind** | **B-dynamo-handler-kind** (P1); Java SDK ownership |
| **FY-db-multi** | Multi-DB teams | many database nodes | code | same as above | (cells above) | H multi-DB named | — | **process** | no single detector; coverage of rows above |

### 3.3 Messaging (P-msg)

| ID | Yardstick name | Architect construct | Signal locus | Mechanism | Claim | Evidence | Fail sample | Status | Product action |
|---|---|---|---|---|---|---|---|---|---|
| **FY-msg-kafka** | Kafka | network/topic + connects | code | decorates + field-type | **U-msg-consumer** / **U-msg-producer** | P Fineract | kafka producer/listener | **partial** | maintain |
| **FY-msg-sqs-sns** | **SQS / SNS** | network + evidence | code | import (+ optional send call later) | **U-msg-producer** | H + L ts-orders-dynamo | lab dual Dynamo+SQS | **partial** | maintain; SNS still thinner |
| **FY-msg-kinesis** | **Kinesis** | network/stream | code / infra | import SDK / CFN event source | **U-msg-*** (new subcell if built) | H in AWS lists | none | **unevidenced** | **B-kinesis** P3 or unevidenced until sample |
| **FY-msg-jms** | JMS/ActiveMQ | network | code | import/field | (messaging) | P Fineract named | — | **partial/thin** | backlog if pilot |

### 3.4 Controls (P-ctrl)

| ID | Yardstick name | Architect construct | Signal locus | Mechanism | Claim | Evidence | Fail sample | Status | Product action |
|---|---|---|---|---|---|---|---|---|---|
| **FY-ctrl-preauth** | Spring `@PreAuthorize` | controls on service | code | decorates | **C-dec** | P Fineract | DatatableWriteService | **proven** | maintain |
| **FY-ctrl-call** | Call-site auth | controls | code | call | **C-call** | P Fineract/Waltz/BoA | charges API | **partial** | maintain |
| **FY-ctrl-oauth2** | **OAuth2** | controls / scheme | code + contract | import + OpenAPI securitySchemes | **C-contract** / new C-oauth | H + C-contract partial | lab openapi bearer | **partial** | **B-oauth2-import** P2 if pilot; don’t overclaim |
| **FY-ctrl-jwt** | JWT validate | controls | code | call | **C-call** | P BoA | py-jwt-gateway | **partial** | maintain |
| **FY-ctrl-resilience** | Resilience4j | controls resiliency | code | decorates | (C-*) | design only | — | **specified-unbuilt** | backlog P3 |

### 3.5 Contract / deploy / trust (P-contract, P-trust)

| ID | Yardstick name | Architect construct | Signal locus | Mechanism | Claim | Evidence | Fail sample | Status | Product action |
|---|---|---|---|---|---|---|---|---|---|
| **FY-contract-openapi** | **Swagger/OpenAPI** | interfaces + securitySchemes | docs/file | structured-file | **C-contract** + U-http merge | H + L | ts-nestjs-users | **partial** | maintain; merge precedence fixed |
| **FY-trust-k8s** | **EKS / k8s** secrets & deploy | trust edges, deploy meta | infra | structured-file | **R-k8s** | H + P BoA | BoA multi-svc k8s | **partial** | maintain |
| **FY-infra-cfn** | **CloudFormation** (incl. API GW methods) | deploy graph + **HTTP path join for Lambda** | infra | structured-file | **U-http-serverless** (paths) + future deploy | H + P saas-boost templates | saas-boost | **specified-unbuilt** for path join | **part of B-lambda-http** (not separate “full CFN topology” in v1) |
| **FY-infra-sam-serverless** | SAM / Serverless Framework | same as CFN paths | infra | structured-file | **U-http-serverless** | industry pattern; Fidelity may use CFN | lab template | **specified-unbuilt** | same as B-lambda-http |
| **FY-infra-terraform** | Terraform | deploy symbols | infra | structured-file | — | CodeGraph TF index exists; Weaver not consuming | — | **unevidenced** Weaver | later; OOS near-term for CALM deploy nodes |

### 3.6 Batch / UI / data platform (P-batch, P-ui, P-data-platform)

| ID | Yardstick name | Architect construct | Signal locus | Mechanism | Claim | Evidence | Fail sample | Status | Product action |
|---|---|---|---|---|---|---|---|---|---|
| **FY-batch-spring** | Spring Batch | batch service | code | decorates | — | P Fineract named | — | **specified-unbuilt** | P3 backlog if pilot |
| **FY-batch-spark** | **Spark + Scala** | data pipeline | code | — | — | H | — | **OOS** near-term | **OOS-lang-expansion** / data-platform |
| **FY-ui-angular** | **Angular / RxJS** | webclient | code | — | — | H | — | **OOS** near-term | **OOS-full-frontend-analysis** |
| **FY-ml-python** | Fidelity Python ML OSS | analytical modules | code | — | — | O | — | **OOS** for service CALM | not service architecture |

---

## 4. Solution-design review (what belongs in Weaver near-term)

### 4.1 Must be first-class for “Fidelity-shaped” cloud pilot

| Priority | Rows | Why |
|---|---|---|
| **P0/P1** | **FY-http-lambda**, **FY-db-dynamo** (ownership), **FY-infra-cfn** path subset | Without these, Dynamo “works” and HTTP lies; HT-ASB proved it |
| **P1 already partial** | FY-msg-sqs-sns, FY-msg-kafka, FY-contract-openapi, FY-trust-k8s, FY-http-*, FY-db-jpa/… | Maintain; do not re-open as “Fidelity unknown” |
| **P2** | FY-ctrl-oauth2 depth, FY-msg-kinesis, FY-db-mongo verify | Named; not blocking serverless story |
| **P3 / OOS** | Spark/Scala, Angular deep, full CFN topology, Terraform→CALM, gRPC, Fargate-as-entry | Honest OOS or unevidenced |

### 4.2 Mechanism fit (no fifth mechanism required for P1 serverless)

| Concern | Mechanism(s) | Notes |
|---|---|---|
| Lambda handler as service | **extends/implements** + optional import of Lambda event types | Same family as Spring Data `extends` / control decorates |
| API Gateway paths | **structured-file** (CFN/SAM/OpenAPI) | Same family as k8s + OpenAPI providers |
| Dynamo store vs handler | **import** + **ownership/priority** (B-ontology generalization) | Not a new engine |
| SQS/SNS | **import** (done) | — |

**CodeGraph will not deliver CFN path→handler join.** Platform owns structured-file + catalogue.

### 4.3 Forbidden claims (Fidelity brand)

| Forbidden | Allowed |
|---|---|
| “Fidelity stack fully supported” | “Fidelity yardstick planes tracked in close-out matrix; P-http serverless still specified-unbuilt until B-lambda-http green” |
| “AWS coverage done” (because Dynamo/SQS green) | Name planes: data/msg partial; **HTTP serverless open** |
| “k8s sample proves Lambda” | k8s proves **R-k8s** only |

### 4.4 Proxy authority (correcting the historical miss)

| Sample | May green | Must not green |
|---|---|---|
| BoA + k8s | U-http Flask, U-persist-import SQLAlchemy, R-k8s | U-http-serverless, Dynamo, Lambda |
| `ts-orders-dynamo` | Dynamo + SQS **import** | Lambda HTTP, API GW paths |
| Fineract * | JAX-RS, JPA, Kafka, layered R2 (claim triple) | Lambda, Dynamo |
| **aws-saas-boost-tier-service** | **U-http-serverless** (when built), Dynamo Java shapes | Spring MVC completeness |
| Future lab `java-lambda-apigw` | U-http-serverless lab bar | Wild generalization alone |

---

## 5. Gap register (actionable only)

| Gap ID | Yardstick rows | Backlog | Claim target | Severity |
|---|---|---|---|---|
| **G-FY-01** | FY-http-lambda, FY-infra-cfn (path join) | **B-lambda-http** | U-http-serverless → partial | **High** — Fidelity cloud HTTP |
| **G-FY-02** | FY-db-dynamo handler ownership | **B-dynamo-handler-kind** | U-persist-import Java Dynamo | **High** — false database units |
| **G-FY-03** | Completeness when 0 services + DBs | part of B-lambda-http / S-silence | S-silence | Medium |
| **G-FY-04** | FY-msg-kinesis | **B-kinesis** (new, P3) | new or U-msg-* | Low until sample |
| **G-FY-05** | FY-ctrl-oauth2 import depth | **B-oauth2-import** (new, P2) | C-* | Medium |
| **G-FY-06** | FY-batch-spring | backlog P3 | — | Low |
| **G-FY-07** | Spark/Angular/full TF | OOS | — | OOS |

---

## 6. Standing exams (solutioning-time, not only hard-tests)

| Exam ID | Claim triple sketch | Expected until G-FY-01/02 ship |
|---|---|---|
| **E-fidelity-lambda-lab** | lab java-lambda-apigw · service+paths · L1 | fail or skip until built |
| **E-saas-boost-tier** | wild tier-service · HT-ASB gold | L1 service+paths fail today (documented) |
| Existing Fineract/BoA exams | unchanged | must stay green |

Hard-tests **generalize** rows already in this matrix; they must not invent new planes without a new matrix row first.

---

## 7. Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial close-out matrix from v0.14 + lab research + public hiring signals + saas-boost hard-test; locks Lambda as P-http not deploy-only; agent tasks in `AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md` |
