# CodeQL buildless TypeScript/NestJS evaluation — the truth, found (2026-08-22)

**Task:** confirm CodeQL's own docs (`codeql.github.com/docs/codeql-overview/supported-languages-and-frameworks`)
and CLI (`codeql resolve extractor --language=javascript`) that JavaScript/
TypeScript extraction is genuinely buildless, then ask the same question
`E1b` asked for Java: does this pipeline have a real, measured gap CodeQL
can close for a NestJS codebase — string-token custom-provider DI
(`{ provide: 'Token', inject: [...], useFactory: ... }`), the NestJS
structural analogue of Spring's `@Bean`-factory pattern that justified
`T-LR-5`?

**Result: yes — a real, measured gap, closed by a first, hand-rolled
exploratory query, on a repo chosen for fintech domain relevance (Weaver's
first target customer is a large asset-management/brokerage platform).**
Strong enough evidence to justify scoping a real `T-LR-5`-style engine, same
bar `E1b` cleared for Java DI resolution — with one real, disclosed
ambiguity gap this exploratory pass does not yet handle.

## Repo and real gap, verified before writing any query

`ghostfolio/ghostfolio` — real, public, wealth-management platform
(portfolio tracking, asset allocation, market-data integration), 9,167
stars, actively maintained, already available locally
(`spikes/ghostfolio`). Selected over other candidates
(`E2a-typescript-nestjs-candidate-search`, informal — see `BACKLOG.md`) for
real, grep-verified custom-provider volume (7 files, 86 `@Injectable`
classes) and fintech-domain relevance, not because it was the only option:
`samchon/payments` (361 stars, real Korean payment system) was checked and
ruled out — zero `useClass`/`useFactory`/`@Injectable` usage anywhere
despite using `@nestjs` packages (a different architectural style,
code-generated via `nestia`) — a real negative finding, not silently
skipped.

**The real gap, found by reading source, not assumed:**
`apps/api/src/services/data-provider/data-provider.service.ts` injects
`@Inject('DataProviderInterfaces') private readonly dataProviderInterfaces: DataProviderInterface[]`
— a string TOKEN, not a class or interface type, resolved elsewhere via
```ts
{
  inject: [AlphaVantageService, CoinGeckoService, /* ...7 more */],
  provide: 'DataProviderInterfaces',
  useFactory: (alphaVantageService, coinGeckoService, /* ... */) => [
    alphaVantageService, coinGeckoService, /* ... */
  ]
}
```
Confirmed against the run's own baseline output (`out/ghostfolio-baseline`,
CodeGraph + Graphify, no CodeQL): **zero relationships touch
`data-provider.service.ts` at all** — this wiring is completely invisible
to this pipeline's own import-tracing, the identical shape of gap `E1b`
found for the reference Java/JAX-RS banking platform's `@Bean`-factory wiring.

## The query — generic, no hardcoded class/token names

`nestjs_token_di.ql` (66 lines, not yet relocated into the pipeline's own
`rules/codeql-queries/`). Two structural classes, joined on a matching
token string:

1. `TokenProviderRegistration` — any object literal with a string-literal
   `provide` property, a sibling `inject` array, and a `useFactory`
   function — the real, generic NestJS custom-provider shape, not a match
   on `'DataProviderInterfaces'` or any other specific token name
   (`OOS-sample-repo-detectors` at full force, same discipline as `E1b`'s
   query).
2. `TokenInjectionSite` — any constructor parameter decorated
   `@Inject('<token>')`, resolved back to its declaring class via
   `ClassDefinition.getConstructor().getBody() = parameter.getParent()`.

## Real result, whole-repo scale

| Metric | Value |
|---|---|
| Real injecting classes resolved | 3 (`DataProviderService`, `DataGatheringService`, `DataEnhancerService`) |
| Real string tokens resolved | 2 (`DataProviderInterfaces`, `DataEnhancers`) |
| Total (injectingClass, provider) bindings | 15 |
| New relationships vs. baseline (CodeGraph+Graphify) | **15 of 15** — zero prior coverage for any of the three injecting classes, confirmed directly against `typed-facts.json` |

The query generalized within the repo without further tuning — it found
`DataEnhancers` (consumed by two different classes,
`DataGatheringService`/`DataEnhancerService`) without having been written
with that token in mind, only having seen `DataProviderInterfaces` during
authoring.

## Real ambiguity found — NOT yet refused (disclosed gap, not hidden)

`DataProviderInterfaces` is genuinely registered **twice** —
`ghostfolio.module.ts` (8 injected providers) and
`data-provider.module.ts` (9 — the same 8 plus `GhostfolioService`).
Confirmed via `diff` on the two real `inject` arrays, not assumed. The
exploratory query's `select` silently unions both registrations' results
rather than flagging the token as ambiguously-registered — the identical
class of gap `E1b` had to build explicit `ambiguousBeanFactory`/
`ambiguousStereotype` refusal predicates for (the reference platform's
`@ConditionalOnMissingBean`-guarded duplicate `@Bean` methods). **Not
fixed here** — this exploratory query does not yet refuse, so its output
should not be trusted as a finished mechanism, only as evidence the
underlying capability is real.

## What this does and doesn't establish

**Establishes:**
- CodeQL's buildless JavaScript/TypeScript extraction is real and fast in
  practice, not just documented — `codeql database create` completed in
  seconds against the whole `ghostfolio` repo, no build command, no daemon,
  none of Java's five real failure modes from this session's earlier
  benchmark work.
- A real, measured gap exists: string-token custom-provider DI is
  completely invisible to CodeGraph/Graphify's own import-tracing today.
- The underlying join (token string → real provider class list) is
  resolvable by a real, generic, non-hardcoded query — the capability
  exists, mirroring exactly what `E1b` established for Java before `T-LR-5`
  was scoped.

**Does not establish:**
- **Not production-ready.** Hand-run exploratory query against a manually
  built database, not a live `StructuralEngine`/pipeline pass. No
  `codeql-js-di-pass.ts` exists.
- **Ambiguity refusal is unbuilt.** The one real duplicate-registration case
  found here is silently merged, not refused — must be fixed before this
  becomes a real mechanism, same bar `T-LR-5` was held to for Spring.
- **One repo only.** `Catalogue_Intake.md`'s own bug-fix-generalization
  rule (applied here to a new engine capability, not a catalogue row) would
  ask for a second, different NestJS repo before this ships — not done
  here. `invoicerr-app/invoicerr` (716 stars, real but thinner signal — 1
  `useClass`/`useFactory` file) is the natural next candidate, named in the
  earlier candidate search but not run.
- **String-token DI only.** Doesn't attempt class-token
  (`useClass`)-resolved custom providers, `useExisting` aliasing, or
  NestJS's default constructor-type-based injection (already covered by
  CodeGraph's own native typing where it resolves).

## Recommendation

Strong enough to scope a real `T-LR-5`-shaped follow-up for TypeScript —
same sequencing discipline as `E1b`→`T-LR-5`: this experiment clears "does
the capability exist," a real production task would need to (1) fix the
disclosed ambiguity-refusal gap, (2) verify against a second real NestJS
repo, (3) decide `--auto-codeql`'s build-file detection needs a
`package.json`+`@nestjs/core` branch (buildless — no `gradlew`/`pom.xml`
equivalent needed, a materially simpler integration than the Java path),
and (4) place a trust tier in `fact-trust-matrix.ts` the same
evidence-earned way Java's was — not assumed to inherit Java's tier.
