# JSR-330/Sisu DI generalization experiment — apache/maven-doxia (2026-08-22)

**Task:** `BACKLOG.md`'s JSR-330/Sisu row asked whether the DI-resolution
mechanism class established by `T-LR-5`(Spring)/`E2a`(NestJS string-token)/
Tier2(Guice explicit-module) generalizes to a fourth, structurally distinct
DI convention — Eclipse Sisu, the JSR-330 implementation Maven's own
ecosystem uses. `di_resolution.ql` is written against Spring-specific
semantics and needed real new query authoring to attempt this, not a config
change — confirmed correct before starting.

## Repo and real DI shape, verified before writing any query

`apache/maven-doxia` (`spikes/maven-doxia`) — real, active Apache project
(document-format conversion library used by the wider Maven ecosystem),
re-confirmed via grep (not trusted from the prior BACKLOG note alone): 17
files use `@Inject`, 24 use `@Named`, all `javax.inject.*` — zero Spring,
zero classic Plexus `@Requirement` anywhere in the tree.

**Real, disclosed pre-check that reshaped this experiment**: `doxia-core`
(and every other module in the repo) produces **zero Weaver units** —
a pure document-conversion library has no HTTP entrypoint, persistence,
messaging, or control-annotation evidence anywhere, which is exactly what
Weaver's own unit-detection floor requires before any unit exists.
`codeql-di-pass.ts` requires the INJECTING class to already be a pre-existing
Weaver unit before it will attach any relationship (only the target side can
be newly introduced) — with zero units in this repo, **no CodeQL query,
however well-written, could ever produce a single live Weaver relationship
here**, structurally, not as a quality problem. Confirmed via a direct
`run-slice` run before writing the query, not assumed. The project owner
was asked and chose to proceed mechanism-only (same framing `E2`'s
`spring-petclinic`/`spring-bot` zero-yield runs used) rather than search for
a different repo.

## Three real, structurally distinct Sisu binding shapes found

All three found by reading real source, not assumed from Sisu's docs:

1. **Single-implementer implicit binding** — `@Inject private ParserManager
   parserManager;` resolved to the sole class implementing `ParserManager`
   that itself carries `@Named` (qualified or bare) — Sisu's default rule
   when exactly one candidate exists, no qualifier match needed.
2. **`Map<String, Interface>` role-hint binding** — `@Inject private
   Map<String, Parser> parsers;` resolves to EVERY real implementer of
   `Parser` carrying a non-empty `@Named("qualifier")`, keyed by that
   qualifier string (`"xdoc"` → `XdocParser`, `"apt"` → `AptParser`, etc.).
   The real, central multi-format-registry pattern this codebase is built
   around — genuinely different from anything `T-LR-5`/`E2a`/Tier2 covered
   (none of those resolve a MAP of many keyed bindings from one field).
3. **`Collection<Interface>` multibind** — `@Inject private
   Collection<SinkWrapperFactory> ...;` resolves to every `@Named`
   implementer, unordered, no qualifier needed.

## The query — generic, no hardcoded class/token names

`sisu_di.ql` (72 lines,
`pipeline/src/rules/codeql-queries/sisu-di-resolution/`). Real bug found
and fixed while authoring, not before: the first pass used
`impl.getASupertype() = iface` (CodeQL's DIRECT-supertype-only predicate)
and silently missed every real map-role-hint binding — `XdocParser
implements Parser` only TRANSITIVELY, through several levels of abstract-
class inheritance (`XdocParser extends Xhtml1BaseParser extends ... extends
AbstractParser implements Parser`), the real, common shape for a
format-specific parser plugin in this codebase. Fixed by switching to
`getAnAncestor()` (the transitive version) — found by directly probing the
real database's actual file list (zero `doxia-modules` files present until
the reactor selection bug below was also fixed) and re-testing, not by
guessing at CodeQL's API from memory.

Two other real toolchain issues found and fixed getting a working database,
both already-known failure-mode classes from this session's own prior
experiments, not new ones:
- **Up-to-date build never re-invokes the compiler** (same class `--auto-codeql`
  already guards against) — `mvn compile` alone on an already-`install`ed
  reactor produced `"could not process any of it"`; fixed with `mvn clean compile`.
- **Aggregator POM selected instead of its real leaf modules** — `-pl
  doxia-modules` alone builds nothing (it's a parent POM with no own Java
  source); the real format-specific implementers live in its child modules
  (`doxia-modules/doxia-module-xdoc`, etc.), which had to be selected
  explicitly.

**Main/test contamination checked and clean** (the exact class of gap the
Guice experiment found): the final build command is `compile`-only, never
reaching `test-compile`; verified directly against the real database's file
list — zero `src/test/` files present.

## Real result

| Mechanism | Real bindings | Interfaces involved |
|---|---|---|
| `single-implementer` | 2 | `ParserManager`, `MacroManager` |
| `map-role-hint` | 13 | `Macro` (3), `Parser` (5), `ParserModule` (5) |
| `collection-multibind` | 1 | `SinkWrapperFactory` |
| **Total** | **16** | 5 distinct interfaces, spanning `doxia-core` AND three separate `doxia-modules/*` reactor modules (a real cross-module resolution, not single-file) |

All 16 rows hand-verified against real source (not spot-checked) — every
`(injectingClass, qualifier, resolvedImpl)` triple matches the real
`@Named("...")` string on the real implementer class.

## What this does and doesn't establish

**Establishes:**
- The DI-resolution mechanism class generalizes to a FOURTH structurally
  distinct convention (Sisu/JSR-330), on top of Spring/NestJS-string-token/
  Guice-explicit-module — confirming `CodeQL-engine-synthesis-2026-08-22.md`'s
  headline finding again: yield is gated by architecture shape and DI idiom,
  not by framework identity.
- Two genuinely new binding SHAPES not seen in any prior DI experiment:
  a multi-value `Map<String,Interface>` role-hint registry (one field
  resolving to N keyed bindings) and a `Collection<Interface>` multibind —
  both required real, generic type-argument extraction
  (`ParameterizedType.getTypeArgument`), not just an annotation-presence join.
- Ambiguity refusal mirrors `di_resolution.ql`'s already-proven discipline
  (`count(...) = 1` gate on the single-implementer mechanism) — not
  independently stress-tested here since this codebase's real implementers
  were all unambiguous; the refusal predicate itself is structurally
  identical to the already-shipped, already-tested Spring version.

**Real, disclosed gap found on review, NOT fixed here** (same class `E2a`'s
own duplicate-token finding already established precedent for — disclose,
don't silently omit): the ambiguity-refusal predicate covers ONLY
`single-implementer`. `map-role-hint`/`collection-multibind` have no
duplicate-qualifier check — if two real implementers of the same interface
both carried the identical `@Named("x")` string, both would silently emit
as separate rows rather than being flagged ambiguous, the same real-runtime-
conflict shape Sisu itself would either error on or resolve non-
deterministically. **Verified this does not occur in the real data** — all
13 map-role-hint qualifiers are pairwise distinct within their interface,
hand-checked, not assumed — so the 16-row result stands as reported. A
production version would need the same `count(...) = 1`-per-qualifier gate
mechanism (a) already has, generalized to (qualifier, interface) pairs
rather than just interface.

**Does not establish:**
- **Zero live yield, definitively, not a corner case.** Unlike `E2`'s
  Spring runs (low yield, architecture-shape-gated) or Tier2's Guice run
  (real yield, contamination-limited), this repo cannot EVER produce a live
  Weaver relationship — the injecting-class precondition fails for 100% of
  bindings, not some. `fact-trust-matrix.ts` gains no new evidence-earned
  tier from this experiment; there is nothing to place a tier on yet.
- **Not production-ready** — hand-run exploratory query against a
  hand-built database, no `codeql-sisu-di-pass.ts` exists.
- **A second repo.** `Catalogue_Intake.md`'s own generalization discipline
  (applied here to a new engine capability, same as `E2a`/Tier2 already
  disclosed) would want a second, different Sisu/JSR-330 repo before this
  ships — not attempted; Maven's own plugin ecosystem (Maven core itself,
  or `sisu` itself) is the natural next candidate, not identified/verified here.

## Recommendation

**Do not scope a live `codeql-sisu-di-pass.ts` off this result alone** — not
because the mechanism is unsound (it is real, generic, and correctly
generalizes to two new binding shapes), but because this specific repo can
structurally never produce a live relationship, so there is no real-yield
evidence to place a trust tier on. The right next step, if this is picked up
again, is finding a real Sisu/JSR-330 repo that ALSO has genuine HTTP/
persistence/messaging surface (so injecting classes are real Weaver units
already) — not re-running against `maven-doxia` with a better query.
