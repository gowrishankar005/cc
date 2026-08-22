# CodeQL DI-resolution framework-generalization experiment (2026-08-21)

**Task:** `T-LR-5-codeql-di`'s only real-world verification is Fineract
(one repo, one JAX-RS/Spring shape). `fact-trust-matrix.ts`'s confidence
tier for `codeql-di-stereotype`/`codeql-di-bean-factory` was set from that
single data point. Before treating that number as generalized fact rather
than a Fineract-specific measurement, this experiment asks: does the same
mechanism, run unmodified against real, different Spring applications,
behave the same way?

**Result: the mechanism generalizes correctly — mechanically safe, zero
false positives, correct built-in ambiguity/empty-name refusal on both new
repos — but its *yield* does not generalize. Zero usable relationships on
either repo, for a real, traceable reason that has nothing to do with
CodeQL's own capability.** This is a materially different and more useful
finding than a pass/fail on "does CodeQL work on Spring" — it identifies
*when* the mechanism is worth reaching for, not just that it's safe to run.

## Repos used

Both real, public, not built for this experiment. Selected from a larger
candidate list by grep-verifying real DI-relevant volume before cloning
anything speculatively (`Catalogue_Intake.md`'s own evidence-first
discipline, applied here to engine evaluation, not just catalogue rows):

| Repo | Real signal (grep-verified before use) |
|---|---|
| `spring-projects/spring-petclinic` | 4 files with `@Service`/`@Repository`/`@Bean`, thin — included as a fast/cheap sanity check, not primary evidence |
| `finos/spring-bot` | 22 stereotype-carrying files, **135 `@Bean` occurrences**, 67 files with real interfaces — the primary evidence source, real production Spring app (Symphony chat-bot platform), structurally unrelated domain to Fineract |

Ruled out from the original candidate list before cloning: `openrewrite/rewrite-recipe-bom`
(no source, a version-alignment BOM only — `primaryLanguage: null` confirmed
via `gh repo view`); `apache/maven-doxia` (real DI, but JSR-330/Sisu, not
Spring — a different mechanism-class question, scoped separately, see
`BACKLOG.md`'s Tier 2 row); `Netflix/photon`, `Netflix/ribbon`,
`finos/messageml-utils` (plain libraries, no real stereotype/DI-wiring
shape); `spring-projects/spring-data-commons` (a framework defining
abstractions, not an application consuming them — wrong shape for this
question); `awslabs/aws-saas-boost` (mixed-language, heavier setup for
uncertain payoff).

## Method

Same shape as `E1b`: real build, real CodeQL database, the unmodified
`di_resolution.ql` query, real output inspected directly — not inferred
from the pipeline's own log lines, which turned out to matter (see below).

## Real result

| Repo | CodeQL DB | Raw bindings found | Survived filters | Attached as a relationship |
|---|---|---|---|---|
| `spring-petclinic` | Real, Maven build (Gradle build failed — see below) | 0 | — | 0 |
| `spring-bot` | Real, 5,506 files indexed, 18MB dataset, genuine `javac` logs confirmed | 3 | 1 | **0** |

**The pipeline's own `[codeql-di]` log line is silent on a genuine
zero-bindings run** (`codeqlDiPass`'s `if (bindings.length === 0) return;`
has no accompanying log) — this made the two real "0 relationships" results
indistinguishable from a silent tool failure from the log alone. Verified
directly instead: ran `codeql database create` and `codeql query run`
standalone against `spring-bot`, outside the pipeline, confirming both a
real, substantial extraction and a real, non-empty query result before
trusting either "zero" as genuine.

### Root cause, traced to a specific class, not inferred

`spring-bot`'s 3 raw bindings:

```
RoomMembershipChangeHandler.sc -> SymphonyConversations -> SymphonyConversationsImpl   (bean-factory)
Scheduler.responseHandlers -> ResponseHandlers -> ""                                    (bean-factory, empty impl name)
AbstractResponseConverter.rh -> ResponseHandlers -> ""                                  (bean-factory, empty impl name)
```

Two of three hit the already-documented anonymous-implementation empty-name
case (`codeql-di-pass.ts`'s own disclosed T-LR-5 limitation) — correctly
filtered, not a new gap. The third is real and valid — and still produced
zero relationships, because **`RoomMembershipChangeHandler` itself carries
no unit at all** in this pipeline's own `typed-facts.json`: no native
route, no stereotype evidence, no persistence evidence, nothing. The
`injectingUnit` gate (`codeql-di-pass.ts:79`) refused it exactly as
designed — "CodeQL saw a real class; this pipeline's own extraction never
turned it into a unit — nothing to anchor a relationship to." Confirmed
directly against `typed-facts.json`, not assumed from the gate's own
comment.

**This is the real finding:** Fineract has 30,778 decorator facts feeding
6,741 units — a codebase saturated with the specific "ambiguous interface,
resolved via `@Bean`-factory/stereotype" shape this query targets.
`spring-bot` has 1,071 decorator facts feeding only 22 units, and the one
class CodeQL found real wiring evidence for isn't among them. The DI-
resolution query's yield is proportional to how much of that specific
architecture shape a codebase has — not to whether it's "a real Spring
app" in general.

### A separate, real limitation found along the way

`--auto-codeql` picked Gradle for `spring-petclinic` (which has both
`build.gradle` and `pom.xml` checked in) — Gradle's toolchain resolution
failed on this machine (`Cannot find a Java installation ... matching
languageVersion=17`, only JDK 21 linked; installing `openjdk@17` via
Homebrew didn't fix it either, since it's keg-only and Gradle's toolchain
auto-detection doesn't scan Homebrew's Cellar path). Maven, against the
identical repo, compiled cleanly with the same JDK 21 (`--release 17`
compiler targeting doesn't need Gradle's stricter toolchain match).
`codeql-auto-detect.ts` currently always prefers Gradle when both build
files exist — a real, disclosed limitation of that preference order, not
fixed here (see `BACKLOG.md`).

## What this does and doesn't establish

**Establishes:**
- The DI-resolution mechanism's *safety* generalizes: no false positives,
  no crashes, correct ambiguity/empty-name refusal on two new, real,
  independently-selected Spring codebases.
- The mechanism's *yield* does not generalize by framework identity — it's
  gated by how much of a specific architecture shape (ambiguous interface +
  bean-factory/stereotype resolution) a given codebase actually contains.
  Fineract is unusually rich in this shape; that richness is not a property
  of "being a Spring app," it's a property of Fineract's own specific
  layering convention.
- A real pipeline observability gap: a genuine zero-bindings run and a
  silent tool failure currently look identical in `run-slice`'s own output.

**Does not establish:**
- Whether the shape generalizes to *other* Spring apps with heavier
  interface-abstraction layering than `spring-bot`/`spring-petclinic` — only
  two data points beyond Fineract, both on the low end of that spectrum.
- Anything about non-Spring Java DI (JSR-330/Sisu, e.g. `maven-doxia`) —
  a structurally different mechanism-class question, scoped as its own
  follow-up (`BACKLOG.md` Tier 2 row), not answered here.
- Whether `fact-trust-matrix.ts`'s confidence numbers should change — this
  experiment is about yield/generalization, not about whether the mechanism
  is *wrong* when it does fire; no evidence here contradicts the existing
  tier placement.

## Recommendation

1. **Don't read "CodeQL found nothing on spring-bot" as a capability
   regression.** It's the mechanism correctly reporting that this
   particular codebase doesn't have much of the shape it targets — the same
   honest-refusal discipline this pipeline already applies everywhere else,
   now demonstrated at the whole-run level, not just per-binding.
2. **Fix the observability gap**: log a real, explicit line on a genuine
   zero-bindings run (distinct from the existing WARNING for an actual
   build/query failure), so "ran clean, found nothing" and "silently
   failed" are never indistinguishable from the log again.
3. **Fix (or at least document) the Gradle-preferred-over-Maven ordering**
   in `codeql-auto-detect.ts` when both build files are present — a real,
   reproducible failure mode on a genuinely common repo shape (dual
   Gradle+Maven support), not a hypothetical edge case.
4. Before generalizing the confidence tier itself to "any Java/Spring repo,"
   the more valuable next experiment is a repo *known* to be
   interface-abstraction-heavy (closer to Fineract's own shape) rather than
   another arbitrary Spring app — yield is the variable that matters here,
   not framework name.
