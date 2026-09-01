# Fintech & target-customer-aligned stack research (lab design input)

**Date:** 2026-08-07 (addendum 2026-08-08)  
**Use:** Choose lab packages and gold expectations. Not a claim that the target customer runs this exact topology.

**Superseding solutioning authority (2026-08-08):** this note originally pointed
to a `Fidelity_Yardstick_Closeout_Matrix.md` / `AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md`
pair that no longer exists in the current doc structure (dead citation, found
2026-09-01) — their content is superseded by `docs/solution/Architect_Residual_Review_Session.md`
and the current `AGENT_TASKS_Ext_*.md` lane files for any topic still open.
Prefer those, current, docs over this one when they disagree.

## 1. Target-customer-aligned signals (public hiring + project requirements)

From public target-customer engineering job signals (e.g. Principal Full Stack Java roles) and this repo’s `CALM_Generator_Requirements_v0_14.md`:

| Domain | Technologies named | Lab treatment |
|---|---|---|
| Languages | **Java**, **Python**, TypeScript/Node | Packages in all three |
| API | REST, **Spring Boot**, **Swagger/OpenAPI** | Java Spring-style + OpenAPI file package |
| Data | **PostgreSQL**, **DynamoDB**, Elasticsearch, ElastiCache, Snowflake | SQLAlchemy/JPA-style + Dynamo SDK import package |
| Messaging | **Kafka**, Artemis, Flink; cloud **SQS/SNS** | Kafka annotation-style package + SQS SDK import package |
| Cloud | AWS Lambda, EKS, S3, Kinesis | **Historical miss (2026-08-08):** this row collapsed Lambda into **k8s-style deploy** only — EKS stood in for “cloud,” so Lambda **HTTP entry never got a lab package or claim cell**. Correct product treatment: **B-lambda-http** / Claim **U-http-serverless** (handler + API GW/CFN paths), not deploy-only. K8s trust remains separate. |
| Frontend | Angular, Node/TS | **Out of generator Slice 1/2** — listed in gold `outOfScope` only |
| Security | OAuth2 / security practices (target-customer-shaped postings); JWT patterns (a reference Java microservices banking sample) | Decorator control + optional shared secret k8s |

## 2. Broader fintech popularity (lab coverage menu)

| Stack | Why it shows up in fintech | In lab? |
|---|---|---|
| Java Spring Boot / Spring MVC | Industry default for core banking/brokerage services | Yes — `java-spring-payments` |
| Java JAX-RS (Jersey/Quarkus-style) | Enterprise REST (a reference Java/JAX-RS banking platform, CALM Hub class of systems) | Yes — `java-jaxrs-charges` |
| Kafka consumers/producers | Event-driven payments, settlement, audit | Yes — `java-kafka-settlement` |
| Python Flask / FastAPI | Services, risk, tooling, data-adjacent APIs | Yes — Flask packages (FastAPI shape deferred to v0.2) |
| NestJS / Node | API gateways, BFF, cloud-native Node services | Yes — `ts-nestjs-users` |
| DynamoDB / SQS via AWS SDK | Cloud-native target-customer-style | Yes — `ts-orders-dynamo` |
| Kubernetes | Shared secrets, deploys | Yes — `deploy/k8s` + multi-package trust scenario |
| gRPC | Growing; **weak public evidence** in this project’s sampling | Gold `outOfScope` / future package |
| .NET | Large banks | Out of pipeline language scope |
| Scala/Spark | Target-customer data/batch | Future language expansion |

## 3. Package portfolio (v0.1)

| Package ID | Language | Framework signals | Business façade | Primary platform tests |
|---|---|---|---|---|
| `py-accounts-api` | Python | Flask routes, SQLAlchemy | Customer accounts API | Slice 1 routes + persistence |
| `py-ledger-worker` | Python | Flask minimal + SQLAlchemy | Ledger side service | Second root; cross-package optional |
| `ts-nestjs-users` | TypeScript | NestJS `@Controller`/`@Get` | User directory API | Native route typing + bootstrap category |
| `ts-orders-dynamo` | TypeScript | DynamoDB + SQS SDK imports | Order store + queue | Cloud import detection (target customer) |
| `java-spring-payments` | Java | `@RestController`/`@GetMapping` | Payment instruction API | Spring native routes |
| `java-jaxrs-charges` | Java | `@Path`/`@GET`/`@Entity` | Charges product API | JAX-RS composition + JPA entity |
| `java-kafka-settlement` | Java | `@KafkaListener`, `KafkaTemplate` | Settlement events | Messaging detection (may score low until X7) |
| `lib-fintech-common` | Java | Pure utils, **no** HTTP | Shared jar trap | **Must-not-detect** as service |
| `deploy-k8s-trust` | YAML | Shared Secret mounts | Trust between accounts & ledger | k8s shares-secret (may score low until X5) |

## 4. Wild-type companions (not in this folder)

| Repo | Role |
|---|---|
| a reference Java microservices banking sample (spikes) | Real multi-service Python |
| a reference Java/JAX-RS banking platform (spikes) | Real Java JAX-RS/JPA scale |
| Ghostfolio / Nest samples | Real NestJS |

Lab scores **controlled**; wild-type scores **generalization**.

## 5. Sources

- Project: `docs/requirements/CALM_Generator_Requirements_v0_14.md`, fintech breadth spikes  
- Public target-customer job descriptions (Java/Python, Spring Boot, OpenAPI, AWS, Kafka, DynamoDB, PostgreSQL, Angular) — hiring signal only  
