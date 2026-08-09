# Weaver — Requirements & Scope

This document states what Weaver is required to do: which languages and frameworks it analyzes, which architectural facts it extracts, and what is explicitly out of scope today. It reflects the current, cumulative scope — not a change log. For what is actually *built* versus *specified but not yet built*, see [`Capabilities.md`](solution/Capabilities.md).

## 1. Product scope

Weaver analyzes a polyglot (Java, Python, Node/TypeScript) monorepo and deterministically generates a [FINOS CALM 1.2](https://calm.finos.org) `architecture.calm.json` describing the real, evidenced architecture — services, databases, message brokers, routes, persistence, security controls, and the relationships between them. There is no LLM in the core generation path; every fact in the output must be traceable to a specific line of source code or configuration.

## 2. In-scope construct coverage

| Concern | Java | Python | Node/TypeScript |
|---|---|---|---|
| HTTP routes / entry points | Spring MVC, JAX-RS | Flask, FastAPI | NestJS |
| Persistence — annotation-based | JPA `@Entity` | — | — |
| Persistence — repository-interface | Spring Data | n/a | n/a |
| Persistence — driver/import-based | JDBC drivers, jOOQ, MongoDB clients | SQLAlchemy | TypeORM, Prisma, Mongoose |
| Persistence — cloud-specific (DynamoDB) | — | — | AWS SDK v2/v3 clients |
| Messaging — traditional | Kafka, JMS/ActiveMQ | — | — |
| Messaging — cloud-native | — | — | AWS SQS/SNS |
| Batch jobs | Spring Batch | — | — |
| Auth/controls — decorator-based | Spring `@PreAuthorize`, Quarkus `@Authenticated` | — | — |
| Auth/controls — call-based | — | inline JWT decode/verify calls | — |
| Auth/controls — OAuth2 | Detected via library import and OpenAPI security schemes | (same) | (same) |
| Trust relationships | Shared Kubernetes Secret mounts across services | (same) | (same) |
| API contracts | OpenAPI/Swagger ingestion | (same) | (same) |
| Cross-module architecture | Multi-hop bridge detection (API → access-layer implementer → store) | — | — |

## 3. Explicitly out of scope (named, not silently dropped)

- **Frontend frameworks** (Angular, React, etc.) — a genuinely new architectural concern (UI components, state, API contracts), not a variant of an existing construct. Not scoped for the current slices.
- **Scala/Spark and other batch-only languages** — evidenced as real in fintech environments, but outside the current Java/Python/Node language scope.
- **gRPC** — checked across multiple real repos, no evidence found; not built.
- **Trading and payments domain modeling** — no domain-specific construct detection exists; Weaver produces generic architecture facts, not domain semantics.
- **Django, Express** — not yet evidenced against real repos, backlog.
- **Kubernetes-manifest-derived `deployed-in` relationships** — designed, not yet built (see `Capabilities.md`).
- **Runtime verification** (e.g. reading a running application's own introspection endpoints) — Weaver is a static-analysis pipeline; all facts come from source and configuration, never from a booted instance.

## 4. Design principles that shape scope decisions

- **Evidence over inference.** A construct is only detected when a concrete signal exists (an annotation, an import, a config key, a call site) — never guessed from naming conventions or documentation.
- **Corroboration, not fabrication.** When evidence is ambiguous (e.g. more than one candidate unit for a signal to attach to), Weaver records the ambiguity as a reviewable item rather than picking one arbitrarily.
- **Catalogue-driven extensibility.** New detection coverage should be a data row in a catalogue file, not new code, wherever the existing detection mechanisms (native framework typing, annotation/decorator extraction, import detection, structured-file ingestion) already cover the shape.
- **Built vs. specified is tracked explicitly.** A high confidence score on what *was* found never implies completeness of the whole architecture — known gaps are surfaced in the tool's own output metadata, not hidden.
