# CoE Lab Charter

## Mission

Provide a **versioned, reproducible benchmark** for the Architecture-as-Code platform:

1. **Author** a known target architecture (gold).
2. **Implement** minimal code that honestly embodies that architecture (fixtures).
3. **Run** the platform / CALM generator.
4. **Score** precision/recall and process metrics.
5. **Drive** catalogue and detector improvements from **systematic misses** — without training on gold during implementation.

## Design stance (from product recommendation)

- **Benchmark lab**, not “rebuild Fidelity as many products.”
- **Fidelity stack = strong menu of signals**, not a claim to clone Fidelity.
- **Public proxies** (a reference Java microservices banking sample, Fineract) remain **wild-type** checks; lab is **controlled trial**.
- Prefer **one monorepo, many packages** (matches pipeline multi-root reality).

## In scope

| Item | Description |
|---|---|
| Multi-language packages | Java, Python, TypeScript/Node within platform Slice 1/2 languages |
| Fintech-popular frameworks | Spring-style, JAX-RS-style, Flask, NestJS, cloud SDK patterns |
| Fidelity-aligned signals | REST/Spring Boot, OpenAPI/Swagger, Kafka/SQS/SNS, DynamoDB, PostgreSQL-class persistence, OAuth2/JWT-style controls, k8s shared secrets |
| Gold architecture | Nodes, interfaces, relationships, must-not-detect, out-of-scope |
| Scoring harness | Deterministic P/R vs gold |
| Isolation | Gold hidden from implementation agents |

## Out of scope

| Item | Why |
|---|---|
| Full business products / UIs | Cost and identity crisis; Angular frontend deferred (language scope) |
| Scala/Spark data platform | Evidenced at Fidelity but out of Slice 1/2 generator language scope for now |
| .NET / mainframe | Common in fintech; not in current pipeline languages |
| LLM-as-ground-truth | Non-reproducible; not used as oracle |
| Training detectors by reading gold | Breaks evaluation integrity |
| Perfect completeness of every class | Matches platform non-goal (no every-class nodes) |

## Success criteria for the lab itself

1. A new contributor can run score on at least **3 packages** in &lt; 30 minutes.
2. Gold and fixtures share the **same commit** (no drift).
3. At least one package per **primary language** (Java, Python, TS).
4. At least one **multi-package** scenario (cross-root edges).
5. At least one **must-not-detect** trap (shared library).
6. Scores are **CI-able** (`node scripts/score-calm.mjs`).

## Ownership

| Role | Responsibility |
|---|---|
| Lab maintainer | Gold + fixtures consistency |
| Platform team | Detectors/catalogues; must not open gold when implementing |
| Eval runs | Use fixtures + gold only in eval tasks |
