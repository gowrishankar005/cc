# Requirements v0.14 — Repo Analyser/Orchestrator Platform + CALM Generator Module

**Status:** Draft. Supersedes v0.13. Incorporates real, multi-source evidence from Fidelity Investments — job postings (hiring signals for current technology stack) + their own public OSS GitHub org. This is exactly the kind of authoritative fintech-institution evidence the sampling methodology was designed to capture.

---

## 0. New Evidence Source: Fidelity Investments

Fidelity's own job postings (multiple concurrent postings, indicating real, active hiring) + their public OSS projects (`github.com/fidelity-contributions/`) provide converging evidence across an entire institution's technology stack. This is unusually valuable because it's not inferred from a single repo — it's organizational hiring signal + real code the institution has open-sourced.

---

## 1. Coverage Matrix — Updated with Fidelity Evidence

| Concern | Java | Python | Node | Scala |
|---|---|---|---|---|
| **Routes/entry-points** | ✅ Spring MVC (Fineract), JAX-RS (Fineract, CALM Hub/Quarkus) | ✅ Flask (BoA), FastAPI (OpenBB) | ✅ NestJS (Ghostfolio) | — |
| **Persistence — annotation-based** | ✅ JPA `@Entity` (Fineract) | — | ❌ | — |
| **Persistence — repository-interface** | ✅ Spring Data (Bank of Anthos) | n/a | n/a | — |
| **Persistence — import/driver-based** | ✅ MongoDB (CALM Hub), jOOQ (Waltz) | ✅ SQLAlchemy (BoA) | ❌ | — |
| **Persistence — cloud-specific** | ❌ | ❌ | ✅ **DynamoDB** (Fidelity job postings) | ❌ |
| **Persistence — multi-DB pattern** | ✅ **MongoDB, PostgreSQL, DynamoDB** (Fidelity — explicitly named across teams, not single repo) | — | — | — |
| **Messaging — traditional** | ✅ Kafka (Fineract), JMS/ActiveMQ (Fineract) | ❌ | ❌ | — |
| **Messaging — cloud-native** | ❌ | ❌ | ✅ **AWS SQS/SNS** (Fidelity job postings) | ❌ |
| **Batch jobs** | ✅ Spring Batch (Fineract) | ❌ | ❌ | ✅ **Apache Spark** (Fidelity) |
| **Auth/control — decorator-based** | ✅ Spring `@PreAuthorize` (Fineract), Quarkus `@Authenticated` (CALM Hub) | ❌ | ❌ | — |
| **Auth/control — call-based** | ❌ | ✅ inline `jwt.decode()` (BoA) | ❌ | — |
| **Auth/control — OAuth2** | ✅ **named in Fidelity postings** | — | — | — |
| **Trust relationships (k8s Secret)** | ✅ k8s Secret sharing (BoA) | (same) | (same) | n/a |
| **Frontend frameworks** | n/a | n/a | ✅ **Angular, TypeScript, RxJS** (Fidelity postings) | n/a |
| **API design/ingestion** | — | — | ✅ **Swagger/OpenAPI** (Fidelity: "Strong experience with API design and best practices using Swagger and OpenAPI") | — |
| **Data/ML workloads** | — | ✅ **spock, MABWiser** (Fidelity OSS, Python for ML/quant) | — | ✅ **Apache Spark + Scala** (Fidelity postings, data/batch) |
| **Kubernetes tooling** | — | — | — | — (Fidelity OSS: kraan, kconnect in Go; not a language for services) |
| **Cloud/deployment** | — | — | — | — (Fidelity: AWS EC2, Lambda, Fargate, CloudFormation; Kubernetes orchestration) |
| **Domain: trading** | ❌ (TraderX blocked) | ❌ | ❌ | — |
| **Domain: payments** | ❌ | ❌ | ❌ | — |
| **gRPC** | ❌ | ❌ | ❌ | — |

---

## 2. New Scope Additions (Fidelity-Evidenced)

### 2.1 Persistence — DynamoDB (Node)
Node job postings at Fidelity explicitly name DynamoDB. This is a cloud-native, NoSQL database with SDK-based access (similar to MongoDB driver pattern already detected). **Add to Node persistence-detection catalogue**: `amazon-dynamodb`, `@aws-sdk/client-dynamodb` import patterns.

### 2.2 Messaging — AWS SQS/SNS (cloud-native, distinct from traditional)
Fidelity postings explicitly name SQS/SNS messaging. This is a genuinely different architectural pattern from Kafka/JMS (cloud-service-based, not application-deployed). Requires a new messaging sub-category and detection: SDK imports (`@aws-sdk/client-sqs`, `@aws-sdk/client-sns`) + configuration patterns. **Backlog, now evidenced** — same tier as Kafka/JMS reached in v0.11.

### 2.3 Batch/data workloads — Apache Spark + Scala (new language)
Fidelity postings cite "data/batch workloads" with Spark + Scala. This is not a web-service architecture (no HTTP routes), but a distinct architectural category. Scala is a new language out of scope for Slice 1/2 but now explicitly evidenced as fintech-real. **Flagged for future language-expansion scope** — not Slice 1/2, but a named, evidenced gap beyond Java/Python/Node.

### 2.4 Frontend frameworks (new architectural concern)
Fidelity postings name Angular, TypeScript, Node, RxJS — a consistent pattern. Frontend architecture (UI components, state management, API contracts) is currently entirely out of scope. **This is a new concern dimension, not just a framework addition.** Scopes to a future "Slice 3: Frontend" if pursued. CALM nodes for frontend components (UI screens, form entities) would be genuinely new node-types, not variants of existing ones.

### 2.5 API design/ingestion — Swagger/OpenAPI (validates backlog)
Fidelity's own job requirement: "Strong experience with API design and best practices using Swagger and OpenAPI." This is the first direct institutional evidence for OpenAPI-ingestion backlog item (v0.6 §3, reaffirmed in v0.13 backlog). **Promotes from "theoretical backlog" to "validated customer need."** Still not built, but no longer speculative.

### 2.6 Persistence patterns — PostgreSQL, multi-database variety
Fidelity postings name MongoDB, PostgreSQL, DynamoDB *explicitly across different teams* — not a single repo pattern. This proves the persistence-detection mechanism needs to handle real database diversity, not just "pick one ORM pattern." PostgreSQL (relational) + MongoDB (document) + DynamoDB (key-value) have different detection shapes and should all be in the catalogue.

### 2.7 OAuth2 (security/auth)
Fidelity postings cite "OAuth2/security" as a standard practice. Already partially evidenced (JWT in BoA, @PreAuthorize/@Authenticated elsewhere), but OAuth2 specifically signals a third auth mechanism (OAuth2 server integration, distinct from app-level @PreAuthorize decorators and manual JWT validation). **Adds to auth-detection catalogue** — `oauth2`, `spring-security-oauth2` library imports.

---

## 3. What Doesn't Change

Unchanged from v0.13:
- Methodology correction (FINOS landscape as sampling frame, coverage matrix as standing artifact)
- Slice 1/2 scope (Python/Node for Slice 1; Java scope widening in Slice 2 remains)
- Controls/standards/patterns detection (decorator + call-based)
- Four enterprise-readiness items (already resolved in v0.10)
- `interacts`/`connects` CALM schema bug (scoped for solution)
- Kubernetes-manifest layer (still unbuilt)

---

## 4. Explicitly Flagged Gaps (still unevidenced despite broader evidence base)

- **gRPC** — checked in 4+ repos (Fineract, BoA, CALM Hub, Waltz), zero evidence. Explicitly checked and confirmed absent, not assumed.
- **Trading domain** — TraderX flagged but blocked on generation tooling; no actual trading-service code analyzed this round.
- **Payments domain** — Fidelity postings don't explicitly name payments services in the evidenced section above; remains unevidenced.
- **Django, Express** — Fidelity postings don't name these; still backlog from v0.6 §3.
- **Scala services** (outside data/batch) — Spark + Scala is batch/data-science workload, not a web-service framework scoped for Slice 1/2.

---

## 5. Methodology Note

This round demonstrates the coverage-matrix methodology working as designed: a new, real source (Fidelity) surfaces evidence across multiple architectural concerns (persistence variety, cloud-native messaging, OAuth2, frontend, Spark/Scala, OpenAPI) without requiring a new code repo clone or grepping. Job postings + OSS projects are a valid evidence source when they converge on organizational patterns. This is exactly what the FINOS landscape frame was meant to unlock — searching broadly across fintech institutions' public signals, not just whatever repo happened to be cloned.

---

## Sources

v0.13 sources, plus: Fidelity Investments job postings (multiple concurrent postings, backend, data, frontend roles); Fidelity OSS GitHub org (`github.com/fidelity-contributions/`) — kraan, kconnect (Kubernetes tooling, Go); spock, MABWiser (ML/quant Python); technology stack citations from role descriptions and organizational hiring patterns.
