# Contract Evolution Policy — when a change is catalogue-only vs. a `CONTRACT_VERSION` bump

**Why this exists** (Wave M T-M4, `docs/solution/Modularity_and_Integration_Assessment.md` friction F2): closed unions on `TypedUnit.kind`, `TypedRelationship.kind`, `Evidence.category`, and `Evidence.source` (`pipeline/src/types/typed-facts.ts`) protect every module downstream of `typed-facts.json` from silently mis-reading a field they don't recognize — that's good governance. It's also a real surprise for anyone who's internalized "new signal = catalogue row, not code" (true for `signal-catalogue.yml` and the three construct-mapping catalogues) and expects the same for `TypedFacts` itself. It isn't, and this document says precisely where the line is instead of leaving it to be rediscovered per pull request.

---

## 1. The actual closed unions, as of this session

```ts
// pipeline/src/types/typed-facts.ts
Evidence.source:   'native-route' | 'decorator' | 'graphify-import'
Evidence.category: 'http-entry-point' | 'framework-bootstrap' | 'persistence' | 'messaging' | 'folder-convention' | 'security-control'
TypedUnit.kind:         'service' | 'database' | 'unresolved'
TypedRelationship.kind: 'calls' | 'imports' | 'connects'
IgnoredItem.reason:     8 fixed values (TEST_CODE, GENERATED_CODE, ...)
```

## 2. The policy, three tiers

### (a) Catalogue-only — no `CONTRACT_VERSION` bump, no code review of `typed-facts.ts`

Adding a new **signal** for an **existing** `kind`/`category`/`source` value. Example: a new Spring annotation mapped to the existing `security-control` category. This is a `signal-catalogue.yml` row (and, for CALM output shape, a construct-mapping catalogue row) — exactly the discipline this project already has, unchanged by this policy.

### (b) Additive optional field — minor-equivalent, no `CONTRACT_VERSION` major bump, but a real PR

Adding a new **optional** field to `Evidence`, `TypedUnit`, `TypedRelationship`, or `TypedFacts` that a module can safely ignore if it doesn't know about it (TypeScript's structural typing already makes an unknown optional field harmless to an existing module). Requires: (1) the field is genuinely optional (`field?:`), (2) no existing module's behavior changes when it's absent, (3) a one-line note in this document's changelog (§4) so the next person doesn't have to `git blame` to find out why it exists.

### (c) Closed-union extension or a new required field — `CONTRACT_VERSION` major bump, required

Adding a new **value** to any of the closed unions in §1 (e.g. `TypedUnit.kind` gaining `'batch-job'`), or adding a new **required** field to any interface. This changes what a module must be able to handle to read `TypedFacts` correctly — a module written against `contractVersion: "1.x"` that doesn't know about `'batch-job'` could silently mis-handle it (e.g. `threat-signals` filtering on `category === 'http-entry-point'` would just never see it, which might be correct or might be a real gap depending on the module). The registry's version-gate (`modules/registry.ts`) exists specifically so this can't happen silently: a module declaring `supportedMajorVersion: "1"` is never invoked against `contractVersion: "2.x"` facts.

**Who updates what, mechanically, for a (c)-tier change:**
1. Bump `CONTRACT_VERSION` in `types/typed-facts.ts` (major segment).
2. Add the new union value(s).
3. Every existing module in `modules/available-modules.ts` needs its `supportedMajorVersion` reviewed — does it need updating to `"2"` (it now understands the new value), or does it stay `"1"` deliberately (it doesn't handle the new case yet, and the registry should keep skipping it until it does)? This is a real per-module decision, not automatic.
4. Add a fixture/regression test exercising the new value (`test/regression.test.js`).
5. Note the bump and reason in this document's changelog (§4).

## 3. `Evidence.source` — resolved as a freeze, not an open/tiered rework (Wave M T-M5)

**The question:** `Solution Design v2` §6.1 originally sketched opening `Evidence.source` into a tiered "authority" system (native-typed=1, framework-aware-query=1, decorates-extracted=2, fuzzy=3) so `interface-builder.ts`'s hardcoded `hasNativeRouteEvidence` precedence check could generalize to "lowest tier wins" once a second engine (CodeQL) actually routes evidence through it.

**Decision: freeze the current closed set (`'native-route' | 'decorator' | 'graphify-import'`) as intentional for Slice 2a, not implement the tiered system now.** Reasoning, stated so the freeze can be revisited on its own terms later, not just inherited:

- **No second real engine exists yet.** CodeQL, scip-java, and tree-sitter are all still Phase 2 / researched-not-built (`docs/solution/language/java.md` §1). Building an authority-tier abstraction with only one real tier (`native-route` beats `decorator`, which is the entirety of what `hasNativeRouteEvidence` already does correctly) is exactly the "speculative flexibility nobody's using yet" this project's own principles warn against.
- **`hasNativeRouteEvidence`'s current two-value precedence already correctly handles the one real conflict found** (NestJS's decorator fallback firing alongside native typing — the bug this mechanism was built to fix, still correctly fixed).
- **The modularity assessment's own "do not do" list** (§7) warns against forcing a mega-interface ahead of a real second implementation needing one — the same reasoning applies here at the data-model level, not just the engine-adapter level.

**Reopen trigger, named explicitly so this isn't an indefinite freeze by omission:** the moment a second engine (CodeQL, most likely, per `language/java.md`'s Phase 2 triggers) is actually wired into the routing table and produces `Evidence` for the same construct kind another engine also produces evidence for, this freeze is void and the tiered system should be built — at that point there will be a real second data point to design the tiers against, not a guess.

**Trigger fired — T-X4-1/T-X4-2 (`AGENT_TASKS_Extraction_Enrichment.md`), `CONTRACT_VERSION` 2.0.0.** Not CodeQL as anticipated above, but the same shape of event: the static OpenAPI provider (`scanner/openapi-provider.ts`) is a second real source producing `Evidence` for the same construct kind (interfaces/routes) `native-route`/`decorator` already produce. `Evidence.source` gained `'openapi'`; `interface-builder.ts`'s binary `hasNativeRouteEvidence` check became a real `SOURCE_PRECEDENCE` tier table (`native-route: 0, openapi: 1, decorator: 2, graphify-import: 3`) — built against this real second data point, not a guess, exactly as this freeze anticipated. Both existing modules were reviewed per §2(c)'s mechanical steps and bumped to `supportedMajorVersion: "2"` (neither needed a code change: `calm-generator` already generalizes over `Evidence.source`; `threat-signals` filters on `category` only).

## 4. §T-M6 — proving the additive-kind process: a dry run for `topic`

**Not shipping Kafka detection this round** (that's Wave E, `Node/AWS SQS/SNS + Kafka catalogue`, explicitly out of scope here) — this is a **dry run of the (c)-tier process from §2**, so it's exercised once, deliberately, before a real crisis forces it.

**If `TypedUnit.kind` gained `'topic'` today, here is exactly what would happen, step by step:**

1. `CONTRACT_VERSION` bumps `1.0.0` → `2.0.0` in `types/typed-facts.ts`. `TypedUnit.kind` gains `'topic'` in the union.
2. `modules/available-modules.ts`'s two current modules get reviewed: `calm-generator` needs a `node-type-mapping.yml` row for `unitKind: topic` (§5.2 of the platform root) before it can meaningfully handle a `'topic'` unit — until that row exists, bumping `calmGeneratorModule.supportedMajorVersion` to `"2"` would let it run against topic-bearing facts but silently produce nothing useful for them (`node-builder.ts` currently skips any unit whose kind has no mapping row, per its own "fail loudly by skipping" design, §5.4) — so the correct sequencing is: add the mapping row **first**, then bump the module's declared version, not the reverse. `threat-signals` doesn't care about `kind` at all (it filters on `Evidence.category`) — its `supportedMajorVersion` could stay `"1"` and it would keep working unmodified against `2.0.0` facts that happen to include topic units, or get bumped to `"2"` purely to reflect that it's been re-verified against the new contract, at the maintainer's discretion.
3. A real detection mechanism (Kafka `@KafkaListener`/`KafkaTemplate`, per `language/java.md` §2's already-evidenced backlog row) would need to actually emit `kind: 'topic'` units — a `signal-catalogue.yml` row plus, since this is a genuinely new architectural shape rather than an existing detection mechanism's new signal, possibly a small addition to `signal-mapper.ts`'s kind-voting logic (§ the `nodeTypeVotesByFile` mechanism already added this session for `service`/`database` — extending it to a third vote value is additive, not a rewrite).
4. A fixture exercising a real `'topic'` unit gets added to `test/regression.test.js`.
5. This document's changelog (§5 below) gets a line: "`2.0.0`: added `TypedUnit.kind: 'topic'` for Kafka/SQS-SNS messaging detection, `calm-generator` mapping added, `threat-signals` unaffected."

**What this dry run proves:** the process in §2(c) is concrete enough to execute without inventing new judgment calls mid-change — the one real decision point (module-version-bump sequencing relative to the mapping-catalogue row) is now named explicitly rather than left to be figured out under time pressure when messaging detection actually ships.

## 5. Changelog

| Version | Change | Reason |
|---|---|---|
| `1.0.0` | Initial `CONTRACT_VERSION`, this session | First version-stamped `TypedFacts` shape; see `Architecture_as_Code_Solution_Design_v2.md` §3.4 |
| `2.0.0` | `Evidence.source` gained `'openapi'` | T-X4-1 (`AGENT_TASKS_Extraction_Enrichment.md`) — static OpenAPI provider is a real second evidence-producing source for interfaces; fires the reopen trigger documented in §3 above. `calm-generator`/`threat-signals` both bumped to `supportedMajorVersion: "2"`. |
| `3.0.0` | `TypedRelationship.kind` gained `'shares-secret'`, `TypedRelationship.source` gained `'k8s'` | T-X5-0 (`AGENT_TASKS_Extraction_Enrichment.md`) — a k8s shared-Secret/ConfigMap trust relationship is architecturally distinct from a code-level `calls`/`imports`/`connects` edge (implicit trust via a shared credential, not a network call), so it gets a named kind rather than being folded into `connects` — directly fixes G-L3-02 ("relationship vocabulary thin"). Still maps to CALM's `connects` relationship-type (no dedicated CALM "trust" shape exists) via a new `relationship-type-mapping.yml` row — the distinction is preserved upstream of CALM construction, not lost. `calm-generator`/`threat-signals` both bumped to `supportedMajorVersion: "3"`, neither needed a code change. |
| `4.0.0` | `TypedUnit.kind`/`CatalogueRule.calmNodeType` gained `'topic'` | T-X7-1 — real dry run of §4 above, executed for real for Kafka/JMS/SQS messaging (G-L2-03). `node-type-mapping.yml` row added in the same change, before the module bump, per §4's own sequencing note. Both modules bumped to `"4"`. |
| (no bump) | `TypedRelationship` gained `confidence?: number` | T-X9-1 — additive OPTIONAL field, tier (b), no bump required. Set only by the env soft-graph detector (`env-soft-graph-detector.ts`) today, a fixed low value (20) for a name-correlation-inferred edge; every other relationship producer leaves it unset. `relationship-builder.ts` surfaces it as an `x-aac-confidence` CALM relationship-metadata entry only when present. |
