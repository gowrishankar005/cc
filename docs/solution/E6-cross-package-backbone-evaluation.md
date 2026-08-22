# E6 — Cross-Package Backbone Evaluation: Graphify vs. CodeGraph

**Question:** `engine-capability-matrix.yml`'s `crossPackageBackbone: graphify`
assigns Graphify sole responsibility for cross-package relationship
resolution. Is that still the right call, or is it the one piece of Weaver's
engine trio that has never been measured against a real alternative?

**Result: the assumption behind the current assignment does not hold.**
CodeGraph, when indexed at a common-ancestor root scoped to the relevant
package subdirectories, resolves the exact same real cross-module edge that
originally justified giving Graphify the backbone role. Graphify is not
structurally necessary for cross-package resolution. This finding is
evidence for a decision the project owner still needs to make (see
"What this changes" below) — it is not itself a code change, per this
session's explicit "explore and plan, no implementation" scope.

## Background: a third-party evaluation prompted this, but didn't answer it

An independently commissioned evaluation (external to this repo, referred to
here only as "the external eval," results kept in a local research folder,
not part of this project's own artifacts) ran Graphify, CodeGraph, and CodeQL
head-to-head against 47 architecture-fact probes across ten real reference
repositories. Headline hit-rates: CodeGraph 43/47, Graphify 30/47, CodeQL
29/47. Its own conclusion assigns CodeGraph the *primary extractor* role
(typed HTTP routes, no compile step) and CodeQL the *join/model specialist*
role (command-bus dispatch resolution, JPA class→table), with Graphify as an
*always-on structural overlay* — explicitly **not** the route typer.

That evaluation is a genuine, rigorous, real-execution comparison — but it
does not settle Weaver's own cross-package-backbone question, for a specific
reason: its probe vocabulary tests single-hop, same-file-or-nearby facts
(a route's path, an entity's table name, a resolved dispatch row). Weaver's
own multi-hop cross-package mechanism (R2 in `engine-capability-matrix.yml`'s
terms) is a different shape of claim — a reference chain spanning two
different package roots, resolved through import/field/type edges. The
external eval's one polyglot-service fixture that touched cross-service
resolution (`boa-system`, an environment-variable string join) scored
**partial for all three tools, including CodeGraph even when given one
combined index** — its own findings doc flags CodeGraph's result there as a
real false-positive (resolved to the wrong variable). That is a different,
weaker join type (env-var string matching) than Weaver's own structural
import/reference join, so it provides no signal either way on the actual
question. The gap was real and needed its own targeted test.

## What justified Graphify's backbone role in the first place

`graphify-provider.ts`'s own doc comment (Weaver's first-party evidence,
predating this eval) documents the original justification: running Graphify
once per package root **structurally cannot** produce a cross-root edge —
each invocation never sees the other root's files. Running one Graphify
extraction over the common ancestor of all given roots resolves this:
verified 265 real cross-module edges in a reference Java/JAX-RS platform,
including one specific evidenced case — `ChargesApiResource`
(in one Gradle module) referencing `PlatformSecurityContext` (defined in a
different Gradle module).

**Weaver's own codebase has no equivalent documented test of whether
CodeGraph can or cannot do the same thing.** The "Graphify is needed because
CodeGraph can't do cross-root" premise, as far as this repo's own artifacts
show, was never independently tested against CodeGraph — it was carried
forward as an assumption once Graphify was shown to work.

## The test

**API check first (verify before running, per this project's own
discipline):** `CodeGraph.init(root, options)` (confirmed via the installed
SDK's `.d.ts` files) takes a single string root — but `ProjectConfig`
supports `include`/`exclude` glob-pattern scoping on that one root. This
means a common-ancestor-with-scoping approach, mirroring Graphify's own
technique, is not excluded by the API. Whether CodeGraph's internal resolver
actually produces a real cross-package edge when used this way was the open,
untested empirical question.

**Ground truth used:** the exact same real, still-current fact
`graphify-provider.ts` cites — `ChargesApiResource`
(`fineract-charge/.../api/ChargesApiResource.java`) importing and injecting
`PlatformSecurityContext` (`fineract-core/.../service/PlatformSecurityContext.java`)
— re-verified directly against a live clone of the reference platform
(import at line 50, field at line 69, both still present).

**Method (with one correction made after the fact — see below):** wrote a
temporary `codegraph.json` at the reference repo's root, ran
`CodeGraph.init(root, { index: true })` as ONE project, then queried the
confirmed real public API (`getNodesByName`, `getFileDependencies`/
`getFileDependents`, `findPath`) for a resolved edge between the two
symbols.

**Correction:** the first pass scoped via `ProjectConfig.include`, on the
assumption it acted as a restrictive whitelist. Re-reading the SDK's own
`.d.ts` doc comments (and confirming empirically) shows `include` is
additive-only — "force IN despite `.gitignore`" — never restrictive;
`exclude` is CodeGraph's actual scope-narrowing mechanism. A follow-up
check (`exclude`-ing every sibling of the two target modules) confirmed the
real behavior: `getStats().fileCount` came back **881** (matching the two
target modules' real file count), not the full monorepo's 6,704 Java files
— so `exclude` genuinely restricts scope; the finding below still holds
either way (a wider, unscoped index still contains the same real edge), but
the real provider (see the follow-on migration plan) scopes via `exclude`,
not `include`.

**Result — a real, resolved multi-hop path, not a raw dump:**

```
getFileDependents(PlatformSecurityContext.java) includes:
  fineract-charge/.../api/ChargesApiResource.java
  (plus every other real cross-module dependent — GLClosuresApiResource,
   BatchApiResource, SynchronousCommandProcessingService, ~180 more)

findPath(ChargesApiResource, PlatformSecurityContext):
  ChargesApiResource --[contains]--> field `context`
  field `context` --[references, confidence 0.9, resolvedBy: import]--> PlatformSecurityContext
```

This is a genuine two-hop resolved path across the same two package roots
Graphify's own evidence used, produced by CodeGraph alone, with no Graphify
pass involved. One implementation nuance surfaced along the way:
`getOutgoingEdges()` on the *class* node returned empty — the resolved edge
lives on the *field* node, one level down. `getFileDependencies`/
`getFileDependents` sidestep this (they already aggregate to file
granularity) and are the more direct API for a file-level cross-package
check than composing per-symbol edge walks.

## What this does and doesn't decide

**Decided by this test:** the premise that Graphify is structurally
necessary for cross-package resolution — the sole first-party justification
this repo's own comments give for `crossPackageBackbone: graphify` — is
false. CodeGraph, given a common-ancestor root with `include` scoping,
resolves the same class of fact.

**Not decided by this test (single case, single repo):**
- Whether CodeGraph's resolution is complete across the same breadth Graphify
  was measured on (265 edges, one reference platform) — this test confirmed
  one specific edge, not a full recount.
- Cost/performance at realistic Weaver scan scale — this test ran a
  two-module scoped index, not a full monorepo-width one.
- Precision (false-positive rate) of CodeGraph's cross-package `references`
  edges specifically, as distinct from its already-measured route-typing
  precision (which the external eval sampled and found clean).
- Whether keeping Graphify as a second, corroborating structural overlay
  (its own real value, per the external eval: always-on communities,
  god-node detection, EXTRACTED vs. INFERRED confidence tagging) still holds
  independent of the backbone-routing question — those are separate
  capabilities from cross-package edge resolution.

## Two other real findings from the external eval, worth capturing here

Found while establishing the above, not directly part of the backbone
question, but real and evidence-gated:

1. **Spring MVC route-typing evidence upgrade.** The external eval sampled
   40 of Shopizer's 314 CodeGraph-native Spring routes directly against
   source and found 40/40 confirmed, 0 extras. This is real, independent
   precision evidence for CodeGraph's native Spring MVC route typing beyond
   whatever repos Weaver's own fixtures currently cover — a candidate for
   upgrading `engine-capability-matrix.yml`'s Spring MVC row from
   `mechanism-proven-primary-repo-only` (if that's its current state; verify
   against the live catalogue before editing) to a broader proven status,
   with this eval cited as the second-instance evidence
   `Catalogue_Intake.md` already requires for any detection-mechanism claim.

2. **JPA class→table via CodeQL — a real, gated 4th-mechanism candidate.**
   The same Shopizer run found CodeQL's official JPA model resolving 80
   entities including `Customer → CUSTOMER`, sampled 20/20 against source.
   This is a real capability Weaver does not currently extract (persistence
   detection today is import/driver-based, not JPA-entity-to-table-name
   resolution) — a genuine catalogue-gap candidate, not yet a decision,
   flagged for `BACKLOG.md` intake per the normal evidence+test+backlog-entry
   process.

3. **A real, unrelated, fixable Weaver-side gap:** the external eval's own
   "Weaver admit" test (mapping CodeGraph's raw Shopizer route dump to
   Weaver's `NativeRouteFact`/`Evidence` shape) found 301/314 admissible, 13
   rejected with reason `name-not-METHOD-PATH` — these are Spring
   `@RequestMapping`s with no explicit HTTP method (`ANY /...`), which
   Weaver's admission logic (expecting a `METHOD /path` string) silently
   drops today. This is a real, narrow admission-logic gap, independent of
   the engine-placement question — worth its own `BACKLOG.md` row.

## Recommendation (for decision, not applied)

Given the above, the sole `crossPackageBackbone: graphify` assignment
appears to rest on an assumption that this test now directly contradicts.
The options, none implemented here:

- **(a) Keep Graphify as backbone, unchanged.** Defensible if its other
  measured strengths (breadth already verified at 265 edges, always-on
  overlay value, lower per-fixture cost in the external eval's timings)
  outweigh switching cost — but no longer defensible on the "CodeGraph can't
  do this" premise specifically.
- **(b) Switch the backbone role to CodeGraph**, using the same
  `include`/`exclude` common-ancestor scoping technique demonstrated here in
  place of Graphify's combined pass. Would need the three "not decided"
  items above resolved first (breadth, cost-at-scale, precision) before this
  is safe to adopt as a mechanism-class change, not an instance patch.
- **(c) Run both as corroborating engines** for cross-package edges (higher
  confidence where they agree, a real trust-matrix signal where they
  disagree), keeping Graphify's already-distinct overlay value (Louvain
  clustering, god-node detection) regardless of which one is authoritative
  for edge resolution specifically.

This is presented as a decision for the project owner, consistent with this
session's explicit scope: explore and plan, not implement.
