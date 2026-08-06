# Fintech Domain Breadth Evidence Spike

**Why this exists:** every prior requirements round grounded its claims in whatever repos happened to be locally cloned (Bank of Anthos, Fineract) — real evidence, but a narrow sample. The user raised a fair concern: this risks overfitting the signal catalogue and control-detection design to what *those specific repos* do, not to what's actually common across fintech engineering. This spike deliberately broadens the evidence base, within the project's existing language scope (Java/Python/Node — not expanding language scope, just depth within it), and applies the same discipline as every prior spike: real repos, real code, real line citations, not vendor claims or general impressions.

**Selection criteria, stated so the choice isn't arbitrary:** prioritized repos with genuine production/organizational weight over solo demo projects. Checked star counts and provenance before committing time to any candidate — several Kafka-banking search results were rejected (0-13 stars, single-author, years-stale) in favor of finding real evidence inside a repo already trusted (Fineract, Apache Software Foundation).

---

## 1. New evidence source: CALM Hub itself (`finos/architecture-as-code/calm-hub`)

Real, substantial (239 Java files), production Quarkus service — FINOS's own reference implementation, genuinely fitting given this whole project generates CALM output. Sparse-cloned this session (`spikes/calm-hub/repo/calm-hub`).

### 1.1 A third, distinct auth-annotation vocabulary
Confirms the exact risk the user raised. Three real repos, three different auth patterns, none of which a narrow catalogue built from just the first would have caught:

| Repo | Framework | Real auth pattern |
|---|---|---|
| Fineract | Spring | `@PreAuthorize(value = "hasAnyAuthority('ALL_FUNCTIONS', 'REGISTER_DATATABLE')")` — decorator, expression-based |
| Bank of Anthos | Flask (vanilla) | Inline `jwt.decode(auth_payload, ...)` call — **not a decorator at all** |
| **CALM Hub (new)** | Quarkus | `@Authenticated` (`resources/ArchitectureResource.java:51` and 9+ other locations) — a *third* distinct decorator name, from Quarkus Security, unrelated to Spring's or Flask's patterns |

Also real: `security/CalmHubScopes.java` defines a genuine scope-based RBAC model (`READ`/`WRITE`/`ADMIN`, `DOMAIN_READ`/`DOMAIN_WRITE`/`DOMAIN_ADMIN`, `GLOBAL_ADMIN`) — confirms role/scope-based authorization, not just "is authenticated," is a real, evidenced pattern worth its own signal category, distinct from bare authentication checks. Source comments in `DomainResource.java:83` and `NamespaceResource.java:89,111` explicitly note where `@Authenticated` was used *instead of* a finer-grained `@PermissionsAllowed` annotation because the latter "cannot target" certain cases — meaning **`@PermissionsAllowed` is a fourth real annotation name** in the same codebase, just not the one ultimately used at those call sites. Both belong in a control-detection catalogue.

**Conclusion for the requirements doc:** the v0.10 control-detection design (decorator-based + call-based) was correctly shaped, but its *catalogue* (which specific decorator/call names to look for) was building toward a list of one example per mechanism. It needs to be a genuinely open, per-framework-extensible list from day one — exactly the same lesson already learned and applied to route detection (Flask/FastAPI/NestJS each needed their own catalogue rows), now confirmed to apply equally to control detection.

### 1.2 Persistence without annotations at all
`store/` package (10+ files: `PatternStore.java`, `ControlStore.java`, `DomainStore.java`, etc.) plus `store/mongo/` implementations — MongoDB access via the driver API (`MongoClient`, `MongoCollection`) directly, **no annotations whatsoever** (unlike JPA's `@Entity`). Confirms the persistence-detection mechanism already built (import-based, not annotation-based — Graphify's `imports_from` edges) generalizes correctly beyond Python/SQLAlchemy to a second language and a second database technology. This is a genuine confirmation, not just a repeat of the same finding.

### 1.3 Real JAX-RS route evidence, Quarkus flavor
`resources/DomainResource.java:32` — `@Path("/api/calm/domains")` at class level, `@GET`/`@POST` + method-level `@Path("{domain}/controls")` at method level — structurally identical to the JAX-RS pattern already evidenced in Fineract, confirming JAX-RS route detection (already scoped for Slice 2) transfers across at least two real codebases without change.

---

## 2. Messaging — upgraded from infra-only to real code evidence

v0.6 §3 had only docker-compose evidence for Kafka (the *fact* that Fineract uses Kafka, not the *code-level signal* a scanner would need). Checked this session — **Fineract has real Kafka producer/consumer code**, previously uncited:

- `fineract-provider/.../kafka/KafkaRemoteMessageListener.java:29,45` — `import org.springframework.kafka.annotation.KafkaListener;` + `@KafkaListener(topics = "${fineract.remote-job-message-handler.kafka.topic.name}")`. Decorator-detectable, same mechanism as routes.
- `fineract-provider/.../kafka/KafkaExternalEventProducer.java:37,48,63` — `KafkaTemplate<Long, byte[]>` field + `externalEventsKafkaTemplate.send(topicName, ...)`. **Not a decorator** — a typed field injection plus a method call, structurally similar to the persistence-detection pattern (detect a known-messaging-library type, e.g. `KafkaTemplate`, the same way `PERSISTENCE_LIBRARIES` detects `sqlalchemy`/`MongoClient`).

**Conclusion:** messaging detection needs the same two-mechanism treatment as controls (decorator for consumers, field/call-based for producers) — and now has real evidence for both, from a trusted source, closing v0.6's "infra-manifest evidence only" caveat.

---

## 3. Explicitly checked and rejected as evidence sources (stated so the gap isn't silently unaddressed)

Several Kafka-banking repos surfaced by search were checked via `gh api` (stars/size/activity) and rejected as too weak to cite:

| Repo | Stars | Verdict |
|---|---|---|
| `wastech/online-banking-microservices-api` | 13 | Solo/demo-tier, not cited |
| `mmilewczyk/fincore-banking` | 0 | Solo/demo-tier, not cited |
| `daniel-keogh/kafka-banking-system` | 3 | Stale (2021), solo/demo-tier, not cited |

This project's evidence discipline treats star count/provenance as a real filter, not just code presence — matching how Ghostfolio's docker-compose citation was flagged "cited, not independently re-verified" in v0.6 rather than silently trusted.

**Not found this session, still a real gap:** gRPC (common in fintech internal service-to-service communication) has no evidence in either Fineract, Bank of Anthos, or CALM Hub — all three are REST/JAX-RS-based. No gRPC route-detection design exists, and none should be assumed to work until real evidence is gathered. **Django and Express** (both already backlog per v0.6 §3) remain unevidenced this round too — time was spent on the highest-value gap (auth/control detection genericity, directly raised this turn) rather than spread thin across every remaining backlog framework.

---

## 4. What this changes in the requirements

1. Control-detection catalogue must be designed as open/extensible from the start (per-framework rows), not built around one decorator + one call-pattern example — now evidenced with a third real vocabulary (Quarkus `@Authenticated`/`@PermissionsAllowed`) proving the earlier two-example base was too narrow.
2. Messaging (Kafka) gets a real code-level detection design, upgraded from "infra fact only" — decorator-based for consumers, field-type-based for producers, both now evidenced.
3. Persistence-detection's import-based mechanism is now confirmed across two languages and two database technologies (SQLAlchemy/Postgres, MongoDB driver/MongoDB) — a genericity claim that's now actually tested, not just asserted.
4. gRPC remains a real, named, unevidenced gap — explicitly flagged rather than silently assumed out of scope or assumed working.
