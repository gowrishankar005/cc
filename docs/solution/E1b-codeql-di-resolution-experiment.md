# CodeQL DI-resolution experiment — the truth, found (2026-08-13)

**Task:** the experiment recommended in `Engine_Capability_Research_Java_SpringBoot_JAXRS.md`
§6.1, run before building T-LR-3 (plain-interface bridge detection) or
T-LR-4 (bean-factory/stereotype-free wiring detection), to answer: can
CodeQL's Spring model actually resolve the two real, evidenced DI-resolution
gaps this pipeline has never been able to see, or is that a plausible-sounding
hypothesis that doesn't survive contact with real code?

**Result: it resolves both, at real scale, generically, with correct
ambiguity refusal.** This is a strong positive result, not a hedge — a real,
substantial capability this pipeline does not have today.

## The two real gaps this was testing against

Both already evidenced, by name, in `Architect_Pilot_Feedback_Notes.md`
Entries 11-13 — not new ground truth authored for this experiment:

1. **Plain-interface field injection** (Entry 11): `ChargesApiResource`
   field-injects `ChargeReadPlatformService` and
   `PortfolioCommandSourceWritePlatformService` — both plain interfaces,
   zero framework-marker annotations, invisible to `signal-catalogue.yml`.
2. **`@Bean`-factory wiring** (Entry 12): the real implementations
   (`ChargeReadPlatformServiceImpl`, `ChargeWritePlatformServiceJpaRepositoryImpl`)
   carry **no stereotype annotation at all** — wired via a dedicated
   `@Configuration`/`@Bean`-factory "starter" class
   (`ChargeConfiguration`), a real, repo-wide Fineract convention.

## CodeQL's own built-in Spring model doesn't cover either shape — checked, not assumed

`codeql/java-all`'s `SpringAutowire.qll` provides real, working DI-resolution
(`SpringBeanAutowiredField.getInjectedComponent()`), but only for fields/
constructors carrying an explicit `@Autowired`/`@Inject`/`@Resource`
annotation, or a no-arg constructor. It has no model for `@Bean`-factory
wiring at all. Checked against real Fineract source before writing any
query: `ChargesApiResource` and
`PortfolioCommandSourceWritePlatformServiceImpl` both use Lombok's
`@RequiredArgsConstructor` (generates the constructor for every `final`
field, Spring's own implicit-single-constructor-injection rule applies, **no
`@Autowired` anywhere**) — outside the built-in model's coverage entirely.
Both real gaps needed a hand-rolled query.

## The query — two real mechanisms, generic (no hardcoded class names)

`soln/codeql-di-resolution-evaluation/di_resolution.ql`. For every `final`
field typed as an interface (the real shape `@RequiredArgsConstructor`
produces), resolves the interface to its real Spring-registered
implementation via:

1. **`stereotype`** — a class implementing the interface carries
   `@Service`/`@Component`/`@Repository`/`@Controller`.
2. **`bean-factory`** — a `@Bean`-annotated method inside a `@Configuration`
   class declares the interface as its return type and its body directly
   `return`s a `new` instance of a concrete implementation.

Neither branch names a single sample-repo class — both are structural
matches on real annotation/AST shape, same discipline as T-LR-1/T-LR-2's
catalogue-driven and mechanism-class fixes.

## Real result, whole-codebase scale

Ran against a CodeQL Java database covering `fineract-charge` +
`fineract-provider` (604 source files, the same real build already verified
working for T-P0-3/CON-10):

| Metric | Value |
|---|---|
| Total resolved DI bindings | **2106** |
| Via `stereotype` | 1331 |
| Via `bean-factory` | 774 |
| Distinct interfaces resolved | 401 |
| Distinct injecting classes | 1098 |

**Both flagship real cases resolve correctly:**
```
ChargesApiResource.readPlatformService -> ChargeReadPlatformService -> ChargeReadPlatformServiceImpl   (bean-factory)
ChargesApiResource.commandsSourceWritePlatformService -> PortfolioCommandSourceWritePlatformService -> PortfolioCommandSourceWritePlatformServiceImpl   (stereotype)
```
The exact chain `Architect_Pilot_Feedback_Notes.md` traced by hand and
declared invisible to this pipeline — `ChargesApiResource → ... →
ChargeRepository → Charge` — is now resolvable in its first two hops (the
third, JDBC-vs-JPA-ownership hop, is the separate, still-open
read-service-vs-owner ambiguity in `BACKLOG.md`).

## Real ambiguity found — refused, not guessed (found by testing, not assumed safe)

Two rounds of real ambiguity, found empirically, both fixed by adding an
explicit refusal (same "never guess" discipline as R2/R2b/R2c):

1. **`bean-factory`**: `LockingService` has two real `@Bean` factory methods
   in different `@Configuration` classes
   (`retrieveLoanLockingService()` → `LoanLockingServiceImpl`,
   `workingCapitalLoanLockingService()` → `WorkingCapitalLoanLockingServiceImpl`),
   each guarded by `@ConditionalOnMissingBean(name = "...")` — genuinely
   runtime-conditional bean registration no static query can safely resolve.
2. **`stereotype`**: 5 real interfaces with 2+ stereotype-annotated
   implementers — `Tasklet` (Spring Batch's generic marker interface, ~10
   unrelated real implementers, never actually structurally
   distinguishable by type alone), `ContentStoreService`/
   `ExternalEventProducer`/`NotificationEventPublisher` (real
   `@Profile`-style runtime alternates, same shape as `LockingService`),
   `LoanRescheduleRequestDataValidator` (2 real stereotype-annotated
   implementers).

The query now refuses (`ambiguousBeanFactory`/`ambiguousStereotype`
predicates) any interface with 2+ distinct resolved implementations, rather
than non-deterministically picking one. Verified: the flagship cases are
unaffected (neither is ambiguous), the count drops from 2153 → 2106 rows
after both refusals land.

## What this does and doesn't establish

**Establishes:** the capability is real, generalizes across the whole
codebase (not tuned to one class), and a real ambiguity-refusal discipline
survives contact with real, messy, `@ConditionalOnMissingBean`-guarded
Spring wiring — the same bar T-LR-1/T-LR-2 were held to.

**Does not establish:**
- **Not yet wired into the pipeline.** This is a hand-run experiment
  against a manually-built CodeQL database, not a live `StructuralEngine`.
  T-LR-5's own expanded acceptance bar (`AGENT_TASKS_Ext_Layered_Recovery.md`)
  — generic detector, explicit build-lifecycle degradation, CI/Docker impact
  resolved, trust tier not blind trust — is unaddressed here.
- **Only Fineract tested.** One real, large, idiomatic Spring/JAX-RS
  codebase, not a second independent repo. `Catalogue_Intake.md`'s own
  bug-fix-generalization rule would ask for a second instance before this
  ships as a production mechanism — noted as the natural next check, not
  done here.
- **Two mechanisms only.** XML-bean-defined wiring, `@Qualifier`-disambiguated
  multi-implementer cases, and `@Primary`-annotated tie-breaks are all real
  Spring conventions this query doesn't attempt — scoped to the two shapes
  the real evidence named, not a claim of full DI coverage.
- **Cost/integration shape still unresolved.** Building `fineract-provider`
  (86 tasks, ~65s clean) plus the CodeQL database (604 files, ~50s) is real,
  non-trivial cost per run, same operational-impact question the P0 lane
  file already flagged and never closed out.

## Recommendation

This is strong enough evidence to justify scoping T-LR-3/T-LR-4 for real —
stronger than the command-bus dispatch result that justified the original E1
evaluation (2106 real edges across a whole codebase vs. 7). But the same
sequencing discipline still applies: this experiment cleared the "does the
capability exist" gate; T-LR-5's already-written expanded acceptance bar
(generic detector, build-lifecycle handling, CI/Docker resolved, trust-tier
placement, second real-repo instance) is what would need to happen before
this becomes a live `StructuralEngine`, not before T-LR-3/T-LR-4 use this
finding to decide their own design.
