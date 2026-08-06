# Requirements v0.11 — Repo Analyser/Orchestrator Platform + CALM Generator Module

**Status:** Draft. Supersedes v0.10. Directly addresses a methodology concern the user raised: every prior version grounded its claims in whatever repos happened to be locally cloned (2-4 total), risking overfitting the signal catalogue to those specific repos rather than to fintech engineering generally. This version broadens the evidence base with a new real, trusted repo and re-examines existing repos more deeply — see `docs/spikes/Fintech_Domain_Breadth_Evidence_Spike.md` for full detail.

---

## 0. Why this version exists

The concern was fair and specific: the control-detection design in v0.10 was built from exactly two examples (Fineract's `@PreAuthorize`, Bank of Anthos's inline `jwt.decode`) — enough to prove *that* two mechanisms are needed, not enough to claim the catalogue behind them generalizes. Rather than defend the existing evidence, went and got more: sparse-cloned FINOS's own `calm-hub` component (real, 239-file Quarkus/Java service — chosen deliberately since it's a genuine production system, not a demo repo), and looked deeper into Fineract for code-level messaging evidence that was previously only cited at the infra-manifest level.

**Result: the concern was correct.** A third repo immediately surfaced a third, unrelated auth-annotation vocabulary (Quarkus's `@Authenticated`) that neither of the first two examples would have predicted. This is folded in below, not glossed over.

**Also confirmed real, trusted-repo Kafka code** (Fineract, previously only cited via docker-compose) — closing a caveat v0.6 had left open ("infra-manifest evidence, not code-level evidence").

**Several candidate repos were checked and explicitly rejected** (0-13 stars, solo/demo-tier) rather than cited for the sake of having more sources — the evidence-quality bar stays the same as everything else in this project.

---

## 1. Control detection — catalogue must be open/extensible from day one

v0.10 specified two detection mechanisms (decorator-based, call-based) correctly, but implicitly sized the *catalogue* behind them around one example each. New real evidence from CALM Hub:

| Repo | Framework | Auth pattern | Mechanism |
|---|---|---|---|
| Fineract | Spring | `@PreAuthorize(value = "hasAnyAuthority(...)")` | Decorator |
| Bank of Anthos | Flask | Inline `jwt.decode(...)` call | Call-based |
| **CALM Hub (new)** | Quarkus | `@Authenticated` (`ArchitectureResource.java:51`, 9+ locations); `@PermissionsAllowed` referenced in comments as a finer-grained alternative | Decorator |

Also new: CALM Hub's `security/CalmHubScopes.java` defines a real scope-based RBAC model (`READ`/`WRITE`/`ADMIN`, `DOMAIN_READ`/`WRITE`/`ADMIN`, `GLOBAL_ADMIN`) — confirms role/scope authorization is a distinct, real signal category from bare "is this endpoint authenticated," worth its own catalogue treatment, not folded into one generic "has-auth" bucket.

**Design implication:** `rules/control-requirement-catalogue.yml` (specified in v0.10) must be built the same way `rules/signal-catalogue.yml` already is — an open table with per-framework rows added as evidenced, not a fixed short list. This isn't a new principle, it's the existing route-detection principle (Flask/FastAPI/NestJS each needed their own catalogue rows) now confirmed to apply to controls too.

---

## 2. Messaging — upgraded from infra-fact to real code evidence

v0.6 §3 had only docker-compose evidence for Kafka. **Found this session, in Fineract** (a repo already cloned and trusted, just not looked at closely enough before):
- `KafkaRemoteMessageListener.java:45` — `@KafkaListener(topics = "...")`. Decorator-detectable, same mechanism as routes/controls.
- `KafkaExternalEventProducer.java:48,63` — `KafkaTemplate<Long, byte[]>` field + `.send(...)` call. Not a decorator — field-type detection, the same shape of mechanism already built for persistence (`PERSISTENCE_LIBRARIES`-style type matching).

Messaging moves from "backlog, partially de-risked" (v0.6) to **backlog, now with a real, specified two-mechanism detection design** (consumer via decorator, producer via typed-field detection) ready to build whenever messaging support is prioritized.

---

## 3. Persistence-detection genericity — now actually tested, not just asserted

CALM Hub's `store/` + `store/mongo/` packages access MongoDB via the driver API directly, with **no annotations at all** (unlike JPA). The existing import-based persistence-detection mechanism (Graphify's `imports_from` edges, already built for SQLAlchemy) is now confirmed to generalize across **two languages and two database technologies** (Python/SQLAlchemy/Postgres, Java/MongoDB-driver/MongoDB) — a genericity claim this project can now actually back with evidence, not just design intent.

---

## 4. Explicitly named, still-real gaps (not silently absent)

- **gRPC** — common in fintech internal service-to-service communication. Checked all three evidence repos (Fineract, Bank of Anthos, CALM Hub) — all three are REST/JAX-RS-based, zero gRPC evidence anywhere. No detection design exists, none should be assumed to work. Named explicitly as unevidenced, not assumed out of scope by omission.
- **Django, Express** — still backlog per v0.6 §3, still unevidenced this round. Effort this round went to the highest-value, directly-raised gap (control-detection genericity) rather than spreading across every remaining framework at once.
- **Repos explicitly checked and rejected as too weak to cite** (`wastech/online-banking-microservices-api` — 13 stars; `mmilewczyk/fincore-banking` — 0 stars; `daniel-keogh/kafka-banking-system` — 3 stars, stale since 2021): recorded so the search isn't silently repeated, and so nobody mistakes "not cited" for "not looked for."

---

## 5. Everything else

Unchanged from v0.10 (§0-2 controls/standards/patterns scope correction and its detection design, §1 the four resolved open items, the `interacts`/`connects` bug still scoped for the next solution round, the Kubernetes-manifest layer from v0.7 §3, still unbuilt).

---

## Sources

Unchanged from v0.10, plus `docs/spikes/Fintech_Domain_Breadth_Evidence_Spike.md` (full detail for this version); `spikes/calm-hub/repo/calm-hub/src/main/java/org/finos/calm/{resources/ArchitectureResource.java:51, resources/DomainResource.java:32,71,83,88-89,111, security/CalmHubScopes.java}`; `spikes/fineract/repo/fineract-provider/.../kafka/{KafkaRemoteMessageListener.java:29,45, KafkaExternalEventProducer.java:37,48,63}` — all fetched/grepped fresh this session, not recalled.
