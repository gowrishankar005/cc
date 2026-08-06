# Fintech & Fidelity-aligned stack research (lab design input)

**Date:** 2026-08-07  
**Use:** Choose lab packages and gold expectations. Not a claim that Fidelity runs this exact topology.

## 1. Fidelity-aligned signals (public hiring + project requirements)

From public Fidelity engineering job signals (e.g. Principal Full Stack Java roles) and this repo’s `CALM_Generator_Requirements_v0_14.md`:

| Domain | Technologies named | Lab treatment |
|---|---|---|
| Languages | **Java**, **Python**, TypeScript/Node | Packages in all three |
| API | REST, **Spring Boot**, **Swagger/OpenAPI** | Java Spring-style + OpenAPI file package |
| Data | **PostgreSQL**, **DynamoDB**, Elasticsearch, ElastiCache, Snowflake | SQLAlchemy/JPA-style + Dynamo SDK import package |
| Messaging | **Kafka**, Artemis, Flink; cloud **SQS/SNS** | Kafka annotation-style package + SQS SDK import package |
| Cloud | AWS Lambda, EKS, S3, Kinesis | k8s-style deploy manifests (EKS-like); no full AWS account |
| Frontend | Angular, Node/TS | **Out of generator Slice 1/2** — listed in gold `outOfScope` only |
| Security | OAuth2 / security practices (Fidelity postings); JWT patterns (BoA) | Decorator control + optional shared secret k8s |

## 2. Broader fintech popularity (lab coverage menu)

| Stack | Why it shows up in fintech | In lab? |
|---|---|---|
| Java Spring Boot / Spring MVC | Industry default for core banking/brokerage services | Yes — `java-spring-payments` |
| Java JAX-RS (Jersey/Quarkus-style) | Enterprise REST (Fineract, CALM Hub class of systems) | Yes — `java-jaxrs-charges` |
| Kafka consumers/producers | Event-driven payments, settlement, audit | Yes — `java-kafka-settlement` |
| Python Flask / FastAPI | Services, risk, tooling, data-adjacent APIs | Yes — Flask packages (FastAPI shape deferred to v0.2) |
| NestJS / Node | API gateways, BFF, cloud-native Node services | Yes — `ts-nestjs-users` |
| DynamoDB / SQS via AWS SDK | Cloud-native Fidelity-style | Yes — `ts-orders-dynamo` |
| Kubernetes | Shared secrets, deploys | Yes — `deploy/k8s` + multi-package trust scenario |
| gRPC | Growing; **weak public evidence** in this project’s sampling | Gold `outOfScope` / future package |
| .NET | Large banks | Out of pipeline language scope |
| Scala/Spark | Fidelity data/batch | Future language expansion |

## 3. Package portfolio (v0.1)

| Package ID | Language | Framework signals | Business façade | Primary platform tests |
|---|---|---|---|---|
| `py-accounts-api` | Python | Flask routes, SQLAlchemy | Customer accounts API | Slice 1 routes + persistence |
| `py-ledger-worker` | Python | Flask minimal + SQLAlchemy | Ledger side service | Second root; cross-package optional |
| `ts-nestjs-users` | TypeScript | NestJS `@Controller`/`@Get` | User directory API | Native route typing + bootstrap category |
| `ts-orders-dynamo` | TypeScript | DynamoDB + SQS SDK imports | Order store + queue | Cloud import detection (Fidelity) |
| `java-spring-payments` | Java | `@RestController`/`@GetMapping` | Payment instruction API | Spring native routes |
| `java-jaxrs-charges` | Java | `@Path`/`@GET`/`@Entity` | Charges product API | JAX-RS composition + JPA entity |
| `java-kafka-settlement` | Java | `@KafkaListener`, `KafkaTemplate` | Settlement events | Messaging detection (may score low until X7) |
| `lib-fintech-common` | Java | Pure utils, **no** HTTP | Shared jar trap | **Must-not-detect** as service |
| `deploy-k8s-trust` | YAML | Shared Secret mounts | Trust between accounts & ledger | k8s shares-secret (may score low until X5) |

## 4. Wild-type companions (not in this folder)

| Repo | Role |
|---|---|
| Bank of Anthos (spikes) | Real multi-service Python |
| Fineract (spikes) | Real Java JAX-RS/JPA scale |
| Ghostfolio / Nest samples | Real NestJS |

Lab scores **controlled**; wild-type scores **generalization**.

## 5. Sources

- Project: `docs/requirements/CALM_Generator_Requirements_v0_14.md`, fintech breadth spikes  
- Public Fidelity job descriptions (Java/Python, Spring Boot, OpenAPI, AWS, Kafka, DynamoDB, PostgreSQL, Angular) — hiring signal only  
