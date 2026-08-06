# Requirements v0.12 — Repo Analyser/Orchestrator Platform + CALM Generator Module

**Status:** Draft. Supersedes v0.11. Directly addresses: is Slice 2's Java scope (`Spring MVC + JAX-RS + JPA only`, set in v0.6 §1.5) actually adequate given Java is fintech's dominant language? Answer, found by re-mining the three Java repos already cloned rather than fetching new ones: **no** — real, common enterprise-Java patterns were sitting in already-cloned evidence, unexamined.

---

## 0. Why this version exists, and a methodology note worth stating plainly

Slice 2's Java scope was set in v0.6, before CALM Hub was cloned and before Fineract was re-examined beyond its JAX-RS/JPA surface. The question this round: does that scope actually reflect what real fintech Java looks like? Answered by systematically grepping the **three Java codebases already cloned this session** (Fineract, Bank of Anthos, CALM Hub) for patterns not yet in any requirements version — no new cloning needed. Worth stating the lesson plainly: last round's "broaden the evidence base" concern was correctly answered by getting a third repo (CALM Hub), but *this* round's answer came entirely from reading the repos already on disk more carefully. Broadening isn't always about cloning more — sometimes it's about not stopping at the first signal found in a repo you already have.

**One real self-correction along the way, not smoothed over:** a file named `CommandMapper.java` with an `@Mapper` annotation initially looked like MyBatis evidence. Checked the actual imports before writing anything down — it's `org.mapstruct.*`, not MyBatis. MapStruct is a compile-time DTO/entity object-mapping generator, an entirely different tool that happens to share the `@Mapper` annotation name. MyBatis itself remains genuinely unevidenced. Recorded as a near-miss caught by the project's own "verify the import, not just the name" discipline, not quietly dropped.

---

## 1. Slice 2 Java scope — widened with real evidence, not just Spring+JAX-RS+JPA

| Pattern | Evidence | Mechanism | Status change |
|---|---|---|---|
| **Quarkus** (framework bootstrap + routing) | CALM Hub — `@Path`/`@GET`/`@Authenticated` throughout `resources/`, 90+ files using `@ApplicationScoped`/`@ConfigMapping` CDI markers | JAX-RS route detection already covers Quarkus's `@Path`/`@GET` (same annotations, confirmed identical to Fineract's). CDI bootstrap markers (`@ApplicationScoped`) are Quarkus-specific and need their own catalogue rows, distinct from Spring's `@Component`/`@Service`. | **New, explicitly in Slice 2 scope** — previously JAX-RS was evidenced only via Fineract; now confirmed to transfer to a second, different Java framework unchanged. |
| **Spring Data JPA repository pattern** | Bank of Anthos — `@Repository interface TransactionRepository extends CrudRepository<Transaction, Long>` (`ledgerwriter/TransactionRepository.java:20-22`, same shape in `balancereader`/`transactionhistory`) | A **distinct persistence signal** from bare `@Entity` — an interface with no method bodies, `@Repository` + `extends CrudRepository`/`JpaRepository`. Needs its own catalogue row; detecting only `@Entity` misses the DAO-layer half of the persistence picture. | **New, in Slice 2 scope.** |
| **Spring Batch** | Fineract — `fineract-provider/.../infrastructure/springbatch/` (28 files), `@EnableBatchIntegration`, real `org.springframework.batch.*` imports | Genuinely common in banking for EOD processing, reconciliation, settlement — a real architectural category (batch job) this project has never modeled. Needs a new `TypedUnit.kind` (`'batch-job'` or similar) and catalogue category, not just a route/persistence variant. | **New backlog item, real evidence attached** — not built this round, but no longer a hypothetical "banking probably uses batch jobs" guess. |
| **JMS/ActiveMQ** | Fineract — `notification/eventandlistener/ActiveMQNotificationEventPublisher.java`: real `jakarta.jms.Queue`, `org.springframework.jms.core.JmsTemplate`, `org.apache.activemq.command.ActiveMQQueue` imports | Same field-type-detection mechanism already specified for Kafka (`KafkaTemplate` → `JmsTemplate`). | **Promoted from "backlog, unevidenced" (v0.6) to "backlog, evidenced, ready to build"** — same tier Kafka reached in v0.11. |
| MapStruct (`@Mapper(componentModel = SPRING, ...)`) | Fineract — `command/jdbc/store/mapping/CommandMapper.java:30-31`, confirmed via `org.mapstruct.*` imports | Real, but architecturally low-significance — a compile-time object-mapping generator, not a service/database/relationship in its own right. | **Noted, not a new signal category.** Recorded so it isn't later mistaken for MyBatis or for a persistence signal. |
| MyBatis | Checked, not found in any of the three repos (the `@Mapper` false lead above was MapStruct) | — | **Still genuinely unevidenced** — was never actually found, corrected from an initial misread rather than newly discovered absent. |
| gRPC | Checked across all three repos (Fineract, Bank of Anthos, CALM Hub) | — | **Still genuinely unevidenced**, reconfirmed (carried forward from v0.11, not re-litigated). |

---

## 2. What this means for the Slice 2 plan

v0.6 §1.5 scoped Slice 2 as "Java — Spring MVC + JAX-RS + JPA only." That undersells what's now actually evidenced and available:

- **Route detection**: Spring MVC (native CodeGraph typing) + JAX-RS (built interpretation layer, works identically for both Fineract's Jersey-style JAX-RS and CALM Hub's Quarkus JAX-RS — confirmed, not assumed, since the annotation names and shapes are identical).
- **Persistence detection**: needs **two** sub-patterns, not one — bare `@Entity`/`@Table`/`@Column` (Fineract's `Charge.java`, already evidenced) **and** the Spring Data repository-interface pattern (`@Repository extends CrudRepository`, Bank of Anthos, newly evidenced). Both are real, both are common, neither alone is sufficient.
- **Framework-bootstrap detection**: needs Spring's `@SpringBootApplication`/`@Component` **and** Quarkus's CDI (`@ApplicationScoped`) as separate catalogue rows — same principle as Flask vs. FastAPI vs. NestJS bootstrap markers in Slice 1, now confirmed to apply within Java too, not just across languages.
- **Messaging**: Kafka (v0.11) and now JMS/ActiveMQ both have real code-level evidence and an identical detection mechanism (typed-field + import detection) — worth building together rather than one now, one later, since the mechanism is shared.
- **Batch jobs**: a genuinely new architectural category this project has never modeled, with real evidence it matters in banking specifically. Not scoped for Slice 2's first build, but no longer invisible — a named, evidenced backlog item with a suggested `TypedUnit.kind` extension.

---

## 3. Everything else

Unchanged from v0.11 (§0-2 controls/standards/patterns scope and detection design, §1 the four resolved open items, `interacts`/`connects` bug still scoped for next solution round, Kubernetes-manifest layer from v0.7 §3 still unbuilt, control-detection catalogue genericity finding).

---

## Sources

Unchanged from v0.11, plus (all grepped fresh this session from already-cloned repos, no new cloning): `spikes/fineract/repo/fineract-provider/src/main/java/org/apache/fineract/infrastructure/springbatch/{ManagerConfig,InputChannelInterceptor,OutputChannelInterceptor,ContextualMessage}.java`; `spikes/fineract/repo/fineract-provider/.../notification/eventandlistener/ActiveMQNotificationEventPublisher.java:21-30`; `spikes/fineract/repo/fineract-command-jdbc/.../CommandMapper.java:21-31`; `spikes/boa/repo/src/ledger/{ledgerwriter,balancereader,transactionhistory}/.../TransactionRepository.java`; `spikes/calm-hub/repo/calm-hub/src/main/java/org/finos/calm/` (CDI marker sweep).
