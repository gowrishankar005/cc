# Requirements v0.13 — Repo Analyser/Orchestrator Platform + CALM Generator Module

**Status:** Draft. Supersedes v0.12. Not a content patch like every prior round — a methodology correction. The user was right that the requirements-collection *approach* itself was the problem: reactive, convenience-sampled from 3 repos found ad hoc, no defined coverage target. This version adopts a real sampling frame (`docs/spikes/Evidence_Sampling_Methodology_Spike.md`) and introduces a coverage matrix as a standing artifact, replacing "grep whatever's cloned when a gap gets pointed out."

---

## 0. The methodology correction

**What was wrong:** every round from v0.7 onward followed the same shape — a gap gets flagged, the response is to grep the 2-3 repos already sitting on disk (Fineract, Bank of Anthos, and later CALM Hub), find one more example, patch. That produced real, honest findings each time, but the *pattern* never converges — there's no defined "enough," and the next reactive gap is exactly as narrowly evidenced as the last.

**The fix:** `finos/finos-landscape`'s `landscape.yml` — a real, curated, star-filtered (300+ stars, category-fit required) inventory of financial-services open source projects, maintained by FINOS itself. Using FINOS's own ecosystem as the sampling frame is unusually well-justified here specifically: CALM, the standard this project generates output for, is itself a FINOS project. There is no more authoritative available source for "what does real fintech open source engineering look like."

**Applied once this session, honestly, including a rejected candidate:**
- `finos/traderX` (106 stars, active) — the best domain-diversity find (a genuine trading-system reference app: `people-service`/`account-service`/`position-service`/`trade-feed`/`trade-processor`/`trade-service`, Java+Node+Python) — but its current `main` branch has been restructured into a spec-generation framework with no static source checked in. **Flagged as a high-value future candidate, not pursued further this round** — running its unfamiliar generation pipeline would be a disproportionate effort spike, same judgment already applied to rejecting low-star demo repos in v0.11.
- `finos/waltz` (236 stars, active) — real evidence found: `org.jooq.Record1`/`org.jooq.Select` imports (`waltz-data/.../GenericSelector.java:23-24`). **Closes a backlog item named since v0.6 §3 ("MyBatis, jOOQ") but never evidenced until now.**

---

## 1. The Coverage Matrix — new standing artifact

Replaces reactive gap-discovery with a visible, maintained inventory: fintech sub-domain × language × architectural concern, each cell either cited or explicitly marked unevidenced.

| | **Java** | **Python** | **Node** |
|---|---|---|---|
| **Routes/entry-points** | ✅ Spring MVC (Fineract), JAX-RS (Fineract, CALM Hub/Quarkus) | ✅ Flask (BoA), FastAPI (OpenBB, cited not re-verified) | ✅ NestJS (Ghostfolio, cited not re-verified) |
| **Persistence — annotation-based** | ✅ JPA `@Entity` (Fineract) | — (Python has no annotation-based ORM in scope; SQLAlchemy is import-based) | ❌ unevidenced (TypeORM/Prisma decorators) |
| **Persistence — repository-interface** | ✅ Spring Data `@Repository extends CrudRepository` (Bank of Anthos) | n/a | n/a |
| **Persistence — import/driver-based** | ✅ MongoDB driver (CALM Hub), jOOQ (Waltz) | ✅ SQLAlchemy (Bank of Anthos) | ❌ unevidenced |
| **Messaging** | ✅ Kafka (`@KafkaListener`/`KafkaTemplate`, Fineract), JMS/ActiveMQ (`JmsTemplate`, Fineract) | ❌ unevidenced | ❌ unevidenced |
| **Batch jobs** | ✅ Spring Batch (`@EnableBatchIntegration`, Fineract) | ❌ unevidenced | ❌ unevidenced |
| **Auth/control — decorator-based** | ✅ Spring `@PreAuthorize` (Fineract), Quarkus `@Authenticated` (CALM Hub) | ❌ unevidenced (Django/FastAPI decorators) | ❌ unevidenced (`@UseGuards`/`@Roles`) |
| **Auth/control — call-based** | ❌ unevidenced | ✅ inline `jwt.decode()` (Bank of Anthos) | ❌ unevidenced |
| **Trust relationships (shared Secret/ConfigMap)** | ✅ k8s Secret sharing (Bank of Anthos, 6 services) | (same evidence, cross-language) | (same evidence, cross-language) |
| **Domain: trading** | ❌ unevidenced (TraderX flagged, blocked on generation tooling) | ❌ unevidenced | ❌ unevidenced |
| **Domain: payments** | ❌ unevidenced | ❌ unevidenced | ❌ unevidenced |
| **gRPC (any language)** | ❌ checked, confirmed absent in all 4 evidence repos | ❌ | ❌ |

**Every ❌ is a named, visible gap now — not something that surfaces only when someone happens to ask.** This table is the artifact to update going forward, not a one-time snapshot.

---

## 2. Everything else

Unchanged from v0.12 (Slice 2 Java scope widening, controls/standards/patterns detection design, the four resolved open items, `interacts`/`connects` bug still scoped for the next solution round, Kubernetes-manifest layer from v0.7 §3 still unbuilt).

---

## Sources

Unchanged from v0.12, plus: `docs/spikes/Evidence_Sampling_Methodology_Spike.md`; `github.com/finos/finos-landscape` (`landscape.yml`, fetched via `gh api` this session); `spikes/waltz/repo/waltz-data/src/main/java/org/finos/waltz/data/GenericSelector.java:23-24`; `finos/traderX` README and `scripts/test-*-overlay.sh` (checked, not cited as usable evidence this round).
