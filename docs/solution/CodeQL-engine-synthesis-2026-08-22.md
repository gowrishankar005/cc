# CodeQL as a third engine — synthesis across five real experiments (2026-08-22)

**Question this answers:** does CodeQL deliver "the best results" of the
three engines, and should it become more central — up to and including
default-on? Raised directly (2026-08-18 onward) after this pipeline's own
`fact-trust-matrix.ts` was found to rank CodeQL's confidence tier below two
of Graphify's own mechanisms. Five real experiments later — spanning three
languages, three structurally distinct DI-resolution mechanism classes,
and a real license/reliability audit — this is the rollup, not a sixth
isolated data point.

## What was actually measured, in one table

| Experiment | Language / mechanism | Real repo | Result |
|---|---|---|---|
| `E1` | Java, command-bus dispatch | a reference Java/JAX-RS banking platform | 7 real edges — evaluated, never shipped (T-LR-5 shipped DI resolution instead, a scope decision, not a negative result) |
| `E1b` | Java, Spring `@Bean`-factory/stereotype | a reference Java/JAX-RS banking platform | **2,105 real bindings**, 731 new relationships, 56 new units, `calm validate` clean — shipped as `T-LR-5` |
| `E2` | Java, Spring — generalization check | `spring-petclinic`, `finos/spring-bot` | **0 usable relationships on either** — mechanism ran mechanically clean (no false positives, correct refusal), yield near-zero |
| `E2a` | TypeScript, NestJS string-token `useFactory` | `ghostfolio/ghostfolio` | **15 real bindings**, 0 baseline overlap — one real ambiguity found, not yet refused |
| Tier 2 | Java, Guice `bind().to()` | `finos/legend-sdlc` | 218 raw bindings, **only 10 genuine** — 208 were main/test contamination from an `mvn install` build command, root-caused and fixed-in-understanding (not yet fixed in the query) |

## The synthesized answer: yield is gated by architecture shape and DI idiom, not by language or framework identity

The single biggest, most repeated finding across all five experiments.
The reference Java/JAX-RS banking platform's 2,105 bindings and
`spring-bot`/`spring-petclinic`'s combined zero are **not** a Java-vs-Java
inconsistency — the reference platform is saturated with
the specific "ambiguous interface, resolved via `@Bean`-factory or
stereotype" shape (30,778 decorator facts → 6,741 units); the other two
repos simply don't have much of that shape, regardless of also being real,
substantial Spring applications (`E2`'s own conclusion, verified by tracing
the one real `spring-bot` binding to a concrete refusal, not inferred).
`ghostfolio`'s real, non-trivial 15-binding result on a *completely
different language and DI idiom* — string-token `useFactory`, structurally
the closest NestJS gets to Spring's `@Bean`-factory pattern — corroborates
this: the predictor is "does this codebase have DI-shaped interface
resolution the two buildless engines structurally cannot see," not
"is this Java" or "is this Spring."

**Practical implication:** CodeQL's value is real but not evenly
distributed. A repo audit that grep-verifies real DI-idiom volume *before*
running CodeQL (the discipline every experiment in this series followed) is
a better filter than "is this Java" — this is now demonstrated three times
independently (the reference banking platform vs. the two thin Spring repos; `ghostfolio`'s real
signal vs. `samchon/payments`' confirmed zero; `legend-sdlc`'s real signal
found specifically by grep-verifying 261 `@Inject` sites before ever
building a database).

## The three real, structural objections to "default," revisited with evidence

1. **License** — resolved by the user's own business context (a perpetual
   license) but not for the shared codebase: `WEAVER_CODEQL_LICENSE_CONFIRMED`
   (shipped 2026-08-21) gives a real, per-environment opt-in that doesn't
   change the shared repo's own safe-by-default posture. Closed, not
   reopened by anything found since.

2. **Reliability** — no longer theoretical. This session's five real,
   independently-diagnosed build/extraction failure modes (cached-build
   empty extraction, Gradle daemon reuse, a Maven npm-frontend hang,
   the reference platform's own unrelated OOM'ing codegen task, and now the main/test
   contamination class) are all **build-command-specific to compiled
   languages** — every one of them is a property of what `javac`/Gradle/
   Maven actually does, not of CodeQL's own analysis. Confirmed directly
   (`codeql resolve extractor`) that Python and JavaScript/TypeScript
   extraction is genuinely buildless — none of these five failure modes are
   structurally possible for those two languages. **This means the
   reliability objection is Java-specific, not CodeQL-general** — a real,
   important refinement to the earlier blanket framing.

3. **Scope** — was "Java/DI-resolution only." Now measurably three
   mechanism classes across two buildless and one compiled language. Still
   narrow relative to CodeQL's own full capability, but no longer a single
   data point.

## What's still unresolved, honestly

- **`engine-capability-matrix.yml`'s per-(language,framework) routing and
  `fact-trust-matrix.ts`'s actual runtime confidence remain disconnected**
  (`BACKLOG.md`'s own pre-existing, named gap). This synthesis is the first
  point where enough real per-shape evidence exists to attempt connecting
  them — still not done.
- **None of the three newer mechanisms (NestJS, Guice) are live pipeline
  passes.** All five experiments in this table are hand-run exploratory
  queries against manually-built databases — real evidence the capability
  exists, never a claim of production readiness.
- **Guice's contamination bug is understood, not fixed** — `guice_di.ql`
  still needs main/test (or active-Module) scoping before its 10 clean
  rows can be trusted as anything more than "hand-verified by grep this
  once."
- **E2a's ambiguity refusal is unbuilt** — the two-registration case is
  still silently unioned.
- **E2b (Python/FastAPI) has no candidate repo** — checked the entire
  FINOS landscape, genuinely zero FastAPI/Flask/Django usage found there;
  a candidate needs to come from elsewhere.

## Recommendation

**Not unconditional default**, for the reasons above that survive this
round of evidence (scope, unfinished mechanisms, the unresolved
routing/trust disconnect) — but the case for `--auto-codeql` /
`WEAVER_CODEQL_LICENSE_CONFIRMED` becoming the *expected* way to run this
pipeline against a real Java repo (not a rare, exotic flag) is now real,
evidence-backed, not aspirational. For Python/TypeScript specifically,
given the reliability objection doesn't apply at all, a lighter-weight
default posture is worth designing once E2b/a live pass exist — genuinely
different risk profile from Java, and this synthesis is the first place
that distinction has been stated explicitly rather than left implicit in
the per-language build-cost framing.

**Concrete next steps, in priority order, none started by this memo:**
1. Fix `guice_di.ql`'s main/test scoping — cheapest, most concrete, closes
   the freshest open gap.
2. Build a live pipeline pass for NestJS string-token DI (`E2a` is the
   most production-ready of the three unshipped mechanisms — richest real
   signal, smallest remaining gap, buildless so lowest operational risk).
3. Connect `engine-capability-matrix.yml` routing to `fact-trust-matrix.ts`
   confidence, now that real per-(language,framework) evidence exists to
   do it honestly instead of by assumption.
4. E2b candidate search outside the FINOS landscape; Tier 2's own
   `maven-doxia` (JSR-330/Sisu) run, still queued and unstarted.
