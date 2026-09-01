# Finding: a reference Java governance platform multi-hop genericity probe — R2/R2b's discipline generalizes, its coverage doesn't

**Date:** 2026-08-08
**Source:** [finos/waltz](https://github.com/finos/waltz) — real, fresh shallow clone (`waltz-web` + `waltz-service` + `waltz-data`, full monorepo; the pre-existing `spikes/waltz/repo` sparse copy in this repo was missing `waltz-service` entirely and could not answer this question)
**Track:** genericity probe for `B-layered-story`'s L0-L4 program (the item ranked highest-value in the program's own honest review: "a second real evidenced multi-root case to test genericity of the R2/R2b mechanism"). No platform code changed.
**Motivation:** the layered-story program's headline real case (a reference Java/JAX-RS banking platform `ChargesApiResource → ChargeReadPlatformServiceImpl`) only ever exercised the `r2-phase1` branch. `R2b` (`D-terminal-refine`'s prerequisite) has never had a real case. This probe went looking for one.

---

## 0. What was checked, and why a reference Java governance platform

a reference Java governance platform is a real, already-partially-evidenced repo (`U-jooq`, `C-call` vocabularies both proven against it) with a genuine three-tier module split (`waltz-web` API layer / `waltz-service` business logic / `waltz-data` jOOQ persistence) — structurally the kind of layered shape the R2/R2b mechanism targets, and a genuinely different Java stack from a reference Java/JAX-RS banking platform (Spark-style route registration instead of JAX-RS annotations, Spring `@Autowired` constructor injection instead of Lombok `@RequiredArgsConstructor`).

## 1. Real scan result

Combined `run-slice` over all three real modules (no sample selection, no cherry-picking):

| Metric | Value |
|---|---|
| Total units | 385 (373 database, 12 service) |
| Multi-hop-resolved relationships (`mechanism` set) | **0** |
| Real `unresolved-multi-hop` candidates found | **28** |
| Fabricated edges | **0** |

**`ComplexityKindEndpoint` → `ComplexityKindService` → `ComplexityKindDao`** (the case this probe originally went looking at) never even reaches the multi-hop mechanism: `ComplexityKindEndpoint` and `ComplexityKindService` both carry **zero evidence of any kind** (no native route typing — a reference Java governance platform doesn't use JAX-RS/Spring MVC route annotations; no persistence/messaging/security-control signal) and so never become `TypedUnit`s at all. This is quieter than an `S1` miss — there's no service unit to even flag as silent.

## 2. The 28 real candidates — honesty held, coverage didn't

Of the 12 real `service`-kind units a reference Java governance platform *does* produce (all via C-call security evidence — `WebUtilities`/`hasRole`/`isAuthenticated`, not route typing), several reference real zero-evidence bridge candidates (`PersonService`, `SettingsService`, `InvolvementKindService`, `SurveyQuestionService`, and more — real, grep-verifiable). **Every one of the 28 was correctly refused, never fabricated**:

- 26 cases: **0 implementers found** — not because the reference is ambiguous, but because the referenced node is a **concrete class**, and nothing structurally `implements` it. `multi-hop-bridge-detector.ts`'s bridge-implementer lookup (`implementersByTarget`, built only from `edge.relation === 'implements'` edges) has nothing to find — a concrete class is never the *target* of an `implements` edge.
- 2 cases: **126 implementers** — every real `Endpoint`-implementing class in a reference Java governance platform counted, because several endpoints reference the marker interface `Endpoint` itself as a bridge candidate. Correctly refused as hopelessly ambiguous, exactly the intended "never guess" behavior.

**This is the real, generic finding**: R2/R2b's discipline (never fabricate on 0 or 2+ candidates) generalized perfectly to a genuinely different real codebase, in both directions of failure. But its **resolution mechanism** — bridge discovery via `implements` edges — is scoped to exactly the shape a reference Java/JAX-RS banking platform happens to use (interface + implementer). a reference Java governance platform's idiomatic shape (a concrete `@Service` class referenced directly, itself directly importing its DAO — no interface abstraction at all) is a **different, real, common Spring pattern** that the current mechanism cannot see, not because it's ambiguous, but because bridge discovery never considers a directly-referenced concrete class as a candidate at all.

Concretely, `ComplexityKindService` (confirmed via real source, `waltz-service/src/main/java/org/finos/waltz/service/complexity_kind/ComplexityKindService.java`) is a `@Service`-annotated concrete class that directly imports and delegates to `ComplexityKindDao` (in `waltz-data`) — a real, unambiguous, single-target delegation chain that a human reading the source would resolve in one hop. The current mechanism structurally cannot chase it, because there's no `implements` edge to enter through.

## 3. Is this a reference Java governance platform-specific, or generic?

**Generic, not a one-off.** Skipping an interface abstraction for an internal service layer (`@Service` class injected and called directly) is a common, idiomatic Spring pattern — arguably at least as common as a reference Java/JAX-RS banking platform's interface-based layering, not an oddity specific to this reference Java governance platform. This is very likely to recur in other real Spring monorepos.

## 4. What this does and doesn't justify

- **Does not, by itself, resolve the `D-terminal-refine`/L2b question** — that decision needs a real case where a bridge candidate *does* get chased through an implementer and then needs a domain-store refine choice. This probe never reached that stage; the gap here is earlier (bridge discovery itself, not the post-resolution terminal choice).
- **Does surface a real, new, generic gap class**, distinct from both R2 Phase 1 and R2b: **direct reference to a zero-evidence concrete class that itself delegates further** — call it, for future naming, "R2c" or "direct-delegate hop." The natural mechanism shape (not built here, named only): if a bridge candidate has 0 `implements`-based implementers, but the candidate node *itself* has exactly one import/reference to a database/topic unit, treat the candidate as its own implementer and chase that one hop — same "never guess" discipline, a genuinely different structural check (no `implements` edge required at all).
- **Reinforces, rather than undermines, the honesty claim this whole program is built on** — 28 real candidates, 0 fabricated, in a codebase the mechanism was never tuned against.

## 5. What this is not

- Not a bug in R2/R2b as built — they do exactly what they were designed to do (chase `implements`-based bridges), correctly.
- Not evidence that the mechanism doesn't generalize — the *discipline* generalized perfectly; only the *coverage* is narrower than "any layered Spring service," which was never the claimed scope.
- Not something to silently patch — named here, with real evidence, for a deliberate scoping decision, same discipline as `D-terminal-refine`.

---

## Related artefacts

- Real evidence source: fresh shallow clone of `finos/waltz` (not the pre-existing `spikes/waltz/repo`, which is missing `waltz-service`)
- Layered-story program context: `docs/solution/AGENT_TASKS_Layered_Architecture_Story.md`, `docs/solution/AREC_Store_Terminal_Policy.md`
- Prior a reference Java governance platform evidence: `U-jooq` (`java-import-resolver.ts`, 229 real database units), `C-call` (`security-rbac-003`, real `hasRole` call sites)
