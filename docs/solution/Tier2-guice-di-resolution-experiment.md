# Guice explicit-module DI-resolution experiment — legend-sdlc (2026-08-22)

**Task:** FINOS landscape research (background agent, 2026-08-21) found
`finos/legend-sdlc` — a real, active, Goldman Sachs-originated SDLC server
for FINOS's Legend data-governance platform — grep-verified with 261 real
`@Inject` sites wired via **Guice** (`com.google.inject`), zero Spring
anywhere. This is a third, structurally distinct DI-resolution mechanism
class from both Spring's `@Bean`-factory/stereotype (`E1b`/`E2`) and
NestJS's string-token `useFactory` (`E2a`) — Guice's explicit
`binder.bind(Interface.class).to(Impl.class)` module-configuration idiom.
Same question as every prior E-series experiment: is this a real, measured
gap, and can a first exploratory query resolve it?

**Result: yes, a real gap — but the first exploratory query also surfaced a
real, more severe scoping problem than any prior experiment: naively
joining across a whole CodeQL database conflates production and
test-only Guice modules.** 208 of 218 raw results are noise from this;
10 are genuine, verified production bindings. Disclosed here in full, not
smoothed over — this is itself the most useful finding of the experiment.

## The real gap, verified before writing any query

`TestModelBuilder` (a real production class,
`legend-sdlc-server/src/main/java/.../domain/api/test/TestModelBuilder.java`
— "test" here names a domain concept, model-testing, not a JUnit test)
has an `@Inject`-annotated constructor taking `MetadataApi metadataApi` — a
plain interface. Resolved via `BaseModule.configureMetadataApi(Binder)`:
```java
protected void configureMetadataApi(Binder binder) {
  binder.bind(MetadataApi.class).to(DepotMetadataApi.class);
}
```
Confirmed against the pipeline's own baseline (`out/legend-sdlc-baseline`,
CodeGraph + Graphify, 195 units / 305 relationships from a real scan): **zero
relationships touch `TestModelBuilder` or `DependenciesApiImpl`** — this
wiring is completely invisible to import-tracing, the same shape of gap
every prior E-series experiment found for its own language/framework.

## The query — generic, no hardcoded interface/impl names

`guice_di.ql` (`queries-java-guice/`, not yet relocated into the pipeline's
own `rules/codeql-queries/`). Two structural classes joined on interface
type identity (a real type-level join, not string matching):

1. `GuiceExplicitBind` — any `<expr>.bind(X.class).to(Y.class)` call chain,
   anywhere in any method (Guice's own `configure()` convention delegates
   across many differently-named methods — `bindUserContext`,
   `configureMetadataApi`, etc. — so the query does not assume a method
   name).
2. `InjectedInterfaceParam` — any `@Inject`-annotated constructor parameter
   whose declared type is an `Interface`.

## Real result, whole-database scale — and the real problem it surfaced

| Metric | Value |
|---|---|
| Raw (injectingClass, interface, impl) bindings | 218 |
| Bindings resolving to a real **production** implementation | **10** |
| Bindings resolving to `InMemory*Api` (test-only fixtures) | **208** |

**The database indexed both `src/main/java` and `src/test/java`** — normal
and correct for a real Maven build (`mvn install` compiles test sources
too). `legend-sdlc-server` has exactly two real `Module` implementations:
`BaseModule` (production, GitLab-backed) and `InMemoryModule`
(`src/test/java/.../guice/InMemoryModule.java`, binds every API interface
to an `InMemory*Api` test double). The query's join has no concept of
"which Module is actually installed for a given deployment" — it matches
purely on interface type identity across the whole database, so a real
production class (`ProjectsResource`, `src/main/java`) gets joined against
`InMemoryModule`'s test-only binding for `ProjectApi`, producing a row that
looks real but describes test wiring, not the running system's own
architecture. Confirmed directly: `grep -v "InMemory"` on the raw output
leaves exactly 10 rows, all independently verifiable against `BaseModule`'s
own real `bind()`/`@Provides` calls (`MetadataApi → DepotMetadataApi`,
`DependenciesApi → DependenciesApiImpl` via its own concrete-class
constructor binding).

**This is a materially different, and more severe, class of gap than either
prior ambiguity finding** (E1b's `@ConditionalOnMissingBean`-guarded
duplicate `@Bean`s, E2a's two near-identical NestJS token registrations) —
those were real ambiguity WITHIN one deployment's actual wiring; this is
cross-contamination BETWEEN two entirely different, mutually-exclusive
deployment configurations (production vs. test). A correct version would
need to scope the join by source root (`src/main` only, or a
caller-specified "active module" class) before joining, not merely refuse
on multiple matches — a different fix shape than T-LR-5's ambiguity
predicates, not just a smaller version of the same one.

## What this does and doesn't establish

**Establishes:**
- A third, real, structurally distinct DI-resolution mechanism class exists
  and is measurably invisible to this pipeline today — Guice's explicit
  `bind().to()` module configuration, joining on real Java interface type
  identity rather than a string token or an annotation-based stereotype.
- The 10 verified production bindings are real, non-trivial, and match
  hand-inspection of `BaseModule`'s own source exactly.
- A real, previously-unseen failure mode for this whole line of
  experimentation: **naive whole-database joins conflate distinct Guice
  Module implementations**, a risk that also plausibly applies to Spring
  (multiple `@Configuration` classes for different profiles/environments)
  and NestJS (multiple modules for different deployment targets) — worth
  re-examining `E1b`/`E2`/`E2a`'s own results for the same contamination
  risk, not assumed absent there just because it wasn't the finding at the
  time.

**Does not establish:**
- **Not production-ready** — same standing caveat as every prior
  exploratory query in this series; no live pipeline pass exists.
- **Main/test (or "which Module is active") scoping is unbuilt.** The
  208-row contamination is not filtered by this query at all — a real fix
  needs either a source-root filter or an explicit "active Module" input,
  not just a smaller ambiguity-refusal predicate.
- **One repo only.** No second Guice-based repo checked.

## Recommendation

Real enough to keep on the roadmap as a third DI-mechanism-class candidate
(alongside Spring and NestJS string-token DI), but **the main/test
contamination problem should be understood as a prerequisite fix, not a
polish item** — an unscoped version of this query would misrepresent test
fixtures as real architecture in generated CALM output, which is a
correctness failure this pipeline's own principles treat as more serious
than a coverage gap. Before this becomes a real production task: (1) add
source-root or active-Module scoping, (2) re-run and confirm the 10 clean
production bindings survive unchanged. (3) **`E2a` re-checked, 2026-08-22:
no contamination** — `ghostfolio` has no test-scoped alternate module
registering `DataProviderInterfaces`/`DataEnhancers`; both real
registrations found are in `apps/api/src` production code, matching the
ambiguity already disclosed in `E2a-typescript-nestjs-codeql-evaluation.md`
exactly, nothing additional. `E1b`/`E2` (Spring, multi-`@Configuration`
profiles) not yet re-checked for the same risk.
