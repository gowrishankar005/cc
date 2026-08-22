# Module Authoring Guide

**Who this is for:** anyone adding a new consumer of `typed-facts.json` to this pipeline — an internal team module, or (once real plugin discovery exists, not yet built) a third-party one. One page, on purpose (Wave M T-M3).

---

## The contract

A module is a plain object matching `Module` (`pipeline/src/modules/registry.ts`):

```ts
export interface Module {
  name: string;
  supportedMajorVersion: string; // matched against TypedFacts.contractVersion's leading segment, e.g. "1"
  run(facts: TypedFacts, ctx: ModuleContext): void;
}

export interface ModuleContext {
  outDir: string;
  overridesDir?: string;
}
```

`run` receives the full `TypedFacts` for the current pipeline run and a context with the output directory. It writes whatever artefact(s) it produces and returns — no return value is read by the registry.

## What you're allowed to import

**Only `TypedFacts` (`types/typed-facts.ts`) and registry types (`modules/registry.ts`).** That's the whole rule, and it's enforced by convention, not by a compiler boundary — the real, working example is `modules/threat-signals/index.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import { TypedFacts } from '../../types/typed-facts';
import { Module, ModuleContext } from '../registry';
```

**Forbidden, explicitly:**
- **Do not import from `scanner/`** (CodeGraph or the `StructuralEngine` interface). Modules consume facts *after* scanning has already happened — re-entering the Scanner breaks the pipes-and-filters boundary this whole design depends on, and breaks determinism (a module re-scanning could see different source than the run that produced its `TypedFacts`).
- **Do not import from `modules/calm-generator/`'s internals** (the builders, `override-applier.ts`). If you need CALM-shaped data, that's a sign your module should consume `architecture.calm.json` as a file artefact after the fact, not reach into calm-generator's code.
- **Do not mutate the `TypedFacts` object you're given.** Treat it as read-only. If two modules ran with a shared mutable object and one mutated it, the other's results would depend on registration order — a real, avoidable source of non-determinism.

## Versioning

`facts.contractVersion` is stamped by the orchestrator (`CONTRACT_VERSION` in `types/typed-facts.ts`). Your module declares `supportedMajorVersion` as a single string (e.g. `"1"`) — the registry compares it against `facts.contractVersion`'s leading segment and **never invokes your `run` at all** if they don't match (confirmed by test: `pipeline/test/regression.test.js`'s registry-behavior test). You don't need to handle a version mismatch inside `run` — if it's called, the version already matches.

If your module needs a `TypedUnit.kind`, `TypedRelationship.kind`, or `Evidence.category`/`Evidence.source` value that doesn't exist yet, that's a **closed-union extension**, not a module-authoring question — see `docs/solution/Contract_Evolution_Policy.md` for exactly when that requires a `CONTRACT_VERSION` bump and the mechanical steps involved.

## Registering your module

Two steps, both in `pipeline/src/modules/available-modules.ts` — this is the one place a new module still requires a core-file edit (Wave M T-M1's `--modules` flag externalizes which registered modules *run* for a given invocation, not which modules *exist*; adding a genuinely new module to the map is still this one line, by design — real third-party plugin discovery is out of scope, see the modularity assessment's P3):

```ts
import { myModule } from './my-module';

export const AVAILABLE_MODULES: Record<string, Module> = {
  'calm-generator': calmGeneratorModule,
  'threat-signals': threatSignalsModule,
  'my-module': myModule, // add here
};
```

Once registered, your module runs by default, or opt-in only via `run-slice.js <roots> --modules my-module` (or `--modules calm-generator,my-module` to run alongside others) — verified directly: `--modules calm-generator` alone correctly excludes `threat-signals`; an unknown name fails with a clear error rather than being silently dropped.

## Output — namespace your files

Write your module's artefacts under `ctx.outDir/modules/<your-module-name>/`, not directly into `ctx.outDir`. This is the convention that keeps two modules from ever overwriting each other's output by filename coincidence (Wave M T-M2). Real example:

```ts
const moduleDir = path.join(ctx.outDir, 'modules', 'my-module');
fs.mkdirSync(moduleDir, { recursive: true });
fs.writeFileSync(path.join(moduleDir, 'my-report.json'), JSON.stringify(report, null, 2));
```

Only `calm-generator` also writes a back-compat copy of `architecture.calm.json` at the top level of `outDir` — that's specific to it being the flagship deliverable this whole project produces, not a pattern to copy for a new module.

## Determinism — no LLM in a module's core path, unless explicitly, narrowly optional

This pipeline's core generation path (Scanner → Rules → Analysis → `typed-facts.json` → your `run`) is deterministic — re-running against unchanged source produces byte-identical output. Your module should preserve that: no network calls, no LLM calls, in the code path that runs by default. If your module genuinely needs an optional LLM-assisted feature (the pattern already designed for the advisory layer, `Architecture_as_Code_Solution_Design_v2.md` §7.1 — off by default, bounded trigger set, proposals only, never facts), it must be flagged explicitly off-by-default and never silently invoked as part of a normal run.

## Failure isolation — already handled, don't add your own

If your module throws, `runModules()` (`modules/registry.ts`) catches it, logs it, and continues to the next module — verified by test. You don't need a top-level try/catch inside `run` for this reason; only add one if you have module-specific partial-failure behavior to handle (e.g. "write what I have so far even if the last item errored").

## Worked example

`modules/threat-signals/index.ts` is the reference implementation — read it directly. It's ~45 lines, imports only `TypedFacts` + registry types, filters `facts.units` for a signal, writes one namespaced JSON report, and is registered in `available-modules.ts`. If your module looks structurally different from that in any of those five respects, check this guide again before assuming it's fine.
