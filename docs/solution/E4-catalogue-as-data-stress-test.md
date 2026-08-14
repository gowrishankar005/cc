# E4 — Catalogue-as-Data Under Stress (T-P0-5)

**Task:** `AGENT_TASKS_Ext_P0_Experiments.md`'s T-P0-5 row (`docs/06`'s
five-experiment framing calls this slot E4): *"add one untested framework
via catalogue row only. Passes only if zero builder code changes. Falsifies
or confirms this repo's central extensibility claim."*

**Result: MIXED — the extensibility claim mostly holds, but the test found
and fixed a real, pre-existing, generic collision bug in the shared rule
matcher, not just the new framework's own rows.** Adding NestJS GraphQL
resolver support (`@Resolver()`/`@Query()`/`@Mutation()`, `@nestjs/graphql`)
via catalogue rows alone worked cleanly. But those new rows exposed a latent
cross-ecosystem collision in `rule-schema.ts`'s `findRule()` that corrupted a
real, unrelated Java repo's output the moment the new rows existed — a
pre-existing mechanism gap the new rows merely triggered, not something
scoped to GraphQL. Confirming the claim required fixing that mechanism, not
zero code changes of any kind.

## Claim triple

`{rootSet: a hand-authored real-syntax NestJS GraphQL resolver fixture +
apache/fineract's fineract-charge module (spikes/), terminalGrain: N/A —
mechanism-level test, not an architecture-story claim, evalArtefact: direct
run-slice output inspection + full pipeline/test regression suite}`.

## What was tested and why

No framework already in `spikes/` was structurally untested — Micronaut was
tried first and rejected as a test case (see "What was rejected" below).
NestJS GraphQL resolvers were chosen because:
- They use the exact same TypeScript decorator AST shape NestJS REST routes
  already prove extraction works for (`matchSource: 'decorator'`), isolating
  the test to "does adding rows for a new bare-decorator vocabulary work,"
  not "does a new AST shape need new extraction code."
- CodeGraph's own native NestJS route resolver was found (empirically, by
  running the fixture before any catalogue change) to already type
  `@Query()`/`@Mutation()` as native routes — meaning primary detection
  needed **zero** catalogue change at all. The real, remaining catalogue gap
  was that the decorator names themselves (`Resolver`, `Query`, `Mutation`)
  stayed unmapped as *secondary* evidence, closable via catalogue rows alone.

## What was rejected as a test case, and why (a real finding on its own)

Micronaut (Java, `@Controller`/`@Get`/`@Post` from
`io.micronaut.http.annotation`) was tried first. Even with **zero catalogue
change**, a hand-authored real-syntax Micronaut fixture was already detected
as a `service` unit with `http-entry-point` evidence — because its bare
annotation names (`Get`, `Post`) coincidentally case-insensitive-word-match
`jax-rs-composed-route`'s `matchSignal: "GET|POST|PUT|DELETE|PATCH"` pattern,
and `findRule()`'s language-disambiguation only prefers a same-language
candidate when one exists — it does not verify the winning candidate's
*framework* actually matches. The result looked superficially correct
(same category/weight as what a real Micronaut row would have produced) but
the provenance was wrong (`evidence.signal: "Get"` attributed to a rule whose
own doc comment says it matches composed JAX-RS route strings, not bare
annotation names) — not usable as a clean "catalogue row alone enables
detection" test since detection already worked, for the wrong reason.

## The real finding: a generic, pre-existing collision bug

Adding `nestjs-graphql-field-decorator` (`matchSignal: "Query|Mutation"`,
`language: typescript`) to `signal-catalogue.yml` and re-running the full
`pipeline/test` regression suite (required — this is a shared file every
package's classification depends on) surfaced **6 real regressions**, all
tracing to one cause: Spring Data JPA's real `@Query(...)` annotation
(`ChargeRepository.java`, `apache/fineract`, real source) bare-word-matches
the new `"Query"` alternative. `findRule()`'s old fallback behavior —
*"prefer a same-language candidate if one exists, otherwise fall back to
`candidates[0]`"* — silently resolved this real Java `@Query` fact to the
TypeScript-only GraphQL rule, since **zero Java candidates existed for
"Query" at all**. This flipped `ChargeRepository`'s node type from
`database` to `service` (`http-entry-point` evidence from the misattributed
rule outweighed the real `extends JpaRepository` persistence evidence),
cascading into 6 failing tests (R0/R2 grading, S1 silence metrics, HITL
review, coverage percentage — every downstream consumer of that one node's
kind).

This is not scoped to GraphQL or to Fineract. It is the **third** real
instance of the same collision class this codebase's own code comments
already document twice (Lombok's `@Getter` vs. JAX-RS's `GET` composed-route
alternative; a JAX-RS composed route vs. NestJS's bare `Get` decorator) — the
first two were fixed by adding language-based disambiguation; this one
required tightening that disambiguation further, because the earlier fix's
own fallback (`candidates[0]` when no same-language candidate exists) was
never actually safe — it just hadn't been triggered by a real cross-language,
zero-same-language-candidate case yet.

## Fix (mechanism-class, not per-repo)

`rule-schema.ts`'s `findRule()`: when a `language` is given and **no**
candidate matches it, return `undefined` (unmatched — same as if
`matchSignal` had matched nothing) instead of falling back to
`candidates[0]`. Every candidate remaining at that point is provably a
different ecosystem's rule matching the same bare word by coincidence; there
is no correct fallback, only a guess. Verified against a direct unit test
(`findRule()` with a TypeScript-only candidate: a Java-language lookup now
returns `undefined`, a TypeScript-language lookup still resolves correctly,
a no-language lookup is unaffected — the existing single-candidate
convenience case). Verified against the real second instance this bug
actually manifested in (`ChargeRepository.java`, restored to `database`) —
not just the synthetic unit test.

This is **not** a per-detector carve-out (the anti-pattern CLAUDE.md's "Bug
fixes are capability work" section names) — it changes the shared matching
primitive every catalogue rule already goes through, for every language and
every future framework row, not a special case for "Query" or for GraphQL.

## Acceptance bar, scored

| Criterion | Result |
|---|---|
| One untested framework added via catalogue row only | **Yes, then narrowed on review** — `nestjs-graphql-resolver-decorator` (`@Resolver`, bootstrap) stays, catalogue-only, zero builder files. `nestjs-graphql-field-decorator` (`Query\|Mutation`) was withdrawn: same TypeScript bare word as TypeORM `@Query`, and `findRule()` does not use `framework`. Operations stay native-route when CodeGraph types them. |
| Passes only with zero builder code changes | **Builders: yes, untouched.** But the shared rule-matching primitive (`rule-schema.ts`, upstream of every builder) needed a real fix before the addition was safe — not a builder change, but not "zero code changes" either. Reporting this precisely rather than rounding to "passed" |
| Falsifies or confirms the extensibility claim | **Both, precisely:** confirms the catalogue mechanism itself (rows alone define new detection/evidence, no new extraction code) once the shared matcher is correct; falsifies the stronger, implicit assumption that adding a row is *risk-free* to existing, unrelated packages — it triggered a real, latent bug in unrelated Java output |

## Disposition

**Shipped, then intake-completed.** The `findRule()` language-fallback fix
stays. `@Resolver` stays as a catalogue row with a checked-in synthetic
fixture (`pipeline/test/fixtures/nestjs-graphql-sample`), a removal-sensitive
regression, a `U-http` honesty note, and `scope-limitations.yml`
`nestjs-graphql-resolver-bootstrap-only`. `@Query`/`@Mutation` were withdrawn
rather than intake-completed: cataloguing them would recreate the same
bare-word collision inside TypeScript (TypeORM `@Query`). The standing exam
for the matcher is still `findRule() never falls back to a different
ecosystem's rule...`; the standing exam for the remaining row is
`T-P0-5 Catalogue_Intake — NestJS GraphQL @Resolver...`.

## What this changes about the "catalogue is safe by construction" claim

**Revise it.** Catalogue rows are data, not code, but they are not
consequence-free data — a new row can change classification for existing,
unrelated units the moment its `matchSignal` happens to bare-word-collide
with a real signal in another language/framework. The safety property this
codebase actually has, now that this fix lands, is: *the shared matcher
never cross-attributes a fact to a rule outside its own language* — not
"catalogue rows can never affect existing output," which was never true and
is not the claim to make going forward. Any future catalogue addition should
still be verified against the full regression suite before being called
safe, exactly as `Catalogue_Intake.md` already requires — this finding is
evidence for why that requirement exists, not a reason to relax it.
