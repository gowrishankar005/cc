# E1 — CodeQL Engine Evaluation (T-P0-3)

**Task:** `AGENT_TASKS_Ext_P0_Experiments.md`'s T-P0-3 — reproduce the
hand-verified command-bus dispatch join on a real database, with a
detector expressed generically (never keyed to sample-repo class names,
`OOS-sample-repo-detectors`). This fires `OOS-command-bus`'s own revisit
trigger: *"A future engine (real Spring bean-graph resolution, e.g.) is
evaluated AND verified against a real command-bus case before being
adopted — never assumed to work."*

**Result: acceptance bar met.** CodeQL CLI installed, a real database built
against Apache Fineract, and a fully generic (no hardcoded class/annotation
names) query reproduces the hand-verified `ChargesApiResource` →
`CreateChargeDefinitionCommandHandler`/etc. dispatch join exactly, with zero
false positives after two rounds of tightening.

## Prerequisites (T-P0-2), all now satisfied

| Prerequisite | State |
|---|---|
| Engine licensing (T-P0-2a) | Resolved — see `soln/codeql-licensing-check-memo.md`'s 2026-08-13 update. OSS evaluation is license-clean under CodeQL's free tier; production/enterprise use is a confirmed procurement path (GHAS to be acquired), not an open question |
| CodeQL CLI installed | `brew install --cask codeql` — 2.26.3 |
| Sample cloned to `spikes/` | `apache/fineract`, unshallowed for a working `git describe` (see the Fineract count-drift fix — same unshallow operation, prerequisite for both) |
| Java build of the sample succeeds (`CON-10`) | **Confirmed — this is the exact step that blocked prior attempts.** Root cause found and fixed: the previous attempt (see "Prior art" below) failed because Gradle's dependency/plugin download couldn't reach the network in that sandbox. In this environment, network access works; the actual, different blocker hit was Fineract's Gradle version-derivation plugin requiring `git describe --tags`, which fails on a shallow clone. Fixed by `git fetch --unshallow`. `./gradlew :fineract-core:compileJava` and `:fineract-charge:compileJava` (which transitively builds `fineract-core`/`fineract-tax`) both succeed cleanly |

## Prior art — do not re-author ground truth

A previous research pass (`codeintel/Architecture Model/research-archive/handoff-package/appendices/03-codeql-validation/`)
already ran real, executed CodeQL queries against Python (OpenBB, 202 endpoints
resolved) and TypeScript (Ghostfolio, 65 security-control mappings resolved) —
both clean wins. For Java/Fineract specifically, it drafted but **never
executed** `command_dispatch_join.ql` (preserved here as
`soln/codeql-e1-evaluation/original_unvalidated_draft_for_comparison.ql`),
honestly marked `UNVALIDATED IN SANDBOX` because that environment's Gradle
build couldn't complete (no network route to Maven Central/`services.gradle.org`).
This session had a real, working build (see above), so this is the first
real execution of that query — not new ground truth authored to fit the
tool, exactly per the master task's instruction.

## Round 1 — run the existing draft as-is

Built a CodeQL Java database tracing `./gradlew :fineract-charge:compileJava`
(clean rebuild, so the build tracer actually saw `javac` invocations — an
up-to-date/cached Gradle build produces an empty database, a real gotcha
worth naming for future runs). Ran the draft query unmodified:

```
"ChargesApiResource","createCharge","createCharge","CreateChargeDefinitionCommandHandler",...
"ChargesApiResource","updateCharge","updateCharge","UpdateChargeDefinitionCommandHandler",...
"ChargesApiResource","deleteCharge","deleteCharge","DeleteChargeDefinitionCommandHandler",...
"TaxComponentApiResource","createTaxComponent","createTaxComponent","CreateTaxComponentCommandHandler",...
"TaxComponentApiResource","updateTaxCompoent","updateTaxComponent","UpdateTaxComponentCommandHandler",...
"TaxGroupApiResource","createTaxGroup","createTaxGroup","CreateTaxGroupCommandHandler",...
"TaxGroupApiResource","updateTaxGroup","updateTaxGroup","UpdateTaxGroupCommandHandler",...
```
(full CSV: `soln/codeql-e1-evaluation/original_draft_results.csv`)

**This alone satisfies "reproduces the hand-verified dispatch join on a real
database."** It also generalized further than the original hand-verification
scope on its own — the same `CommandWrapperBuilder`/`@CommandType` convention
resolves real dispatch edges in `fineract-tax` too, not just `fineract-charge`.

**But the query is rejectable on review as written**, per the master task's
own governance note (§0): it hardcodes `hasName("CommandWrapperBuilder")` and
`hasName("CommandType")` — Fineract's own real class/annotation names. This
is exactly `OOS-sample-repo-detectors`: *"any catalogue row, matcher, or code
path keyed to a specific sample/evidence-repo class, module, or package
name."*

## Round 2 — generalize to a mechanism class

Rewrote as `soln/codeql-e1-evaluation/generic_string_dispatch_join.ql`, matching
the **mechanism class**, not any specific API:

- **Registration side:** any class annotated with any custom (non-`java.*`)
  annotation type declaring 2+ String-typed elements, bound to literal String
  values at the use site — not specifically `@CommandType`.
- **Lookup side:** any *named* method (not a constructor/compiler-synthesized
  initializer) whose body assigns 2+ compile-time-constant String literals to
  fields — not specifically `CommandWrapperBuilder`'s convenience methods.
- **Join:** the registration's literal value set is found within the lookup
  site's literal value set (subset, not exact-set-equality — see the finding
  below for why), matched **by value, never by field/class/annotation name**.
- Registration and lookup required to be in different files, per the
  capability's own stated scope ("registration and lookup in different
  files").

**Two real false-positive classes found and fixed while generalizing** — the
same discipline as E2's evidencing, not assumed to be safe on the first
attempt:

1. **Exact-set-equality was too strict.** `createCharge()` sets 3 String
   constants (`actionName`, `entityName`, **and** a literal `href` template,
   `"/charges/template"`), while `updateCharge()`/`deleteCharge()` only set 2
   — their `href` concatenates a non-constant id (`"/charges/" + chargeId`),
   which isn't a compile-time constant, so it's correctly excluded. An
   exact-count join silently dropped every `create()` case (3 of 7 missing).
   **Fixed:** subset match — the registration's key must be *found within*
   what the lookup site sets, not equal to the whole of it. This is also the
   more semantically correct join in general: a real dispatch call commonly
   sets more than just the key.
2. **Constructors/field-default-value initializers matched the same shape.**
   A plain `@ConfigurationProperties` POJO's field declarations with default
   values (e.g. `private String tenantClaimName = "fineract_tenant";`) lower
   to assignments inside the implicit constructor (`<obinit>`) —
   structurally identical to "2+ String constant field assignments," but not
   a dispatch/builder call at all. Produced 2 real false-positive rows
   (`FineractSecurityOidcFederationProperties` → `BusinessDateReadPlatformServiceImpl`/`ExternalEventService`,
   coincidental literal-value overlap with unrelated `@CommandType`
   registrations). **Fixed:** exclude compiler-synthesized member names
   (`<obinit>`/`<clinit>`-shaped), a generic exclusion (not a class-name
   exclusion) — any class's own field defaults are excluded uniformly, not
   just this one coincidentally-colliding class.

**Final result, after both fixes:** exactly the same 7 rows as the
Fineract-specific draft — full reproduction, zero false positives, zero
hardcoded sample-repo names anywhere in the query
(`soln/codeql-e1-evaluation/generic_string_dispatch_join_results.csv`).

## Acceptance bar, scored

| Criterion | Result |
|---|---|
| Reproduces the hand-verified join on a real database | **Yes** — exact match, 7/7 real dispatch edges, Round 1 |
| Detector is generic (no sample-repo class/package names) | **Yes** — Round 2, verified by re-running against the same real database after removing every Fineract-specific identifier from the query |

Both conditions of `OOS-command-bus`'s revisit trigger are now satisfied:
*"A future engine is evaluated AND verified against a real command-bus case
before being adopted."* This is real, reportable progress against a
permanent non-goal's own named reopening condition — not a change to the
non-goal itself (unbounded runtime dynamic dispatch resolution is still
correctly out of scope; this is a narrower, static, string-literal-join
capability that happens to cover the concrete case that first surfaced the
OOS row).

## What this does *not* establish

- **Not yet a live `StructuralEngine`.** Per the master task: *"Then — and
  only then — implement as a second `StructuralEngine`;
  `engine-capability-matrix.yml` already carries the augment slot."* This
  evaluation is the "then" gate clearing — the actual engine adapter
  (`scanner/codeql-provider.ts` or similar, implementing the neutral
  `StructuralEngine` interface per `scanner/structural-engine.ts`) is a
  separate, real build task, not done here.
- **Operational impact not yet scoped for real.** The P0 lane file's own
  table (CI needing CodeQL installed or graceful-skip, `Dockerfile` needing
  the engine or documenting it as an external prerequisite, build-mode
  analysis needing a compiling target repo with materially different CI
  cost) is unaddressed — this evaluation ran entirely by hand, locally.
- **Java-only, one convention.** The generalization targets "annotation with
  2+ String attrs" + "named method with 2+ String constant field
  assignments" — a real, evidenced mechanism class, but only evaluated
  against one real convention (Fineract's command-bus). Whether it
  generalizes to *other* string-keyed registry-dispatch conventions (a
  different builder shape, a different annotation attribute count) is
  untested — the capability is intentionally narrow, per the master task's
  own framing ("Capability (narrow)").
- **Per-(engine, fact-type) trust tier not designed.** `BACKLOG.md` P3 names
  this as a real prerequisite for adding any engine as a genuine second
  source — still not built.

## What would be next, if this is pursued further

1. Build the `StructuralEngine` adapter, wired through
   `engine-capability-matrix.yml`'s existing augment slot.
2. Scope the operational-impact table for real (CI, Dockerfile, build-time
   cost) before it ships in any default path.
3. Test the generalized query shape against a second real string-keyed
   dispatch convention (a different repo/pattern) to confirm the mechanism
   class, not just this one case, actually generalizes.
