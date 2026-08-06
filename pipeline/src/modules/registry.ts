import { TypedFacts } from '../types/typed-facts';

/**
 * Goal A's actual plumbing (Solution Design v2 — "CALM Generator proves the
 * framework, it is not the whole product"). Before this, run-slice.ts
 * hardcoded exactly one consumer of typed-facts.json — the "platform for
 * multiple modules" claim had no code behind it. A module declares which
 * TypedFacts.contractVersion major version it supports; the registry
 * refuses to run a module against an incompatible one rather than silently
 * misfeeding it, and one module failing doesn't stop the others.
 */
export interface ModuleContext {
  outDir: string;
  overridesDir?: string;
  /** T-X7-3 — --no-system-node; only calm-generator reads this, other modules ignore it safely. */
  includeSystemNode?: boolean;
}

export interface Module {
  name: string;
  supportedMajorVersion: string; // matched against TypedFacts.contractVersion's leading segment, e.g. "1"
  run(facts: TypedFacts, ctx: ModuleContext): void;
}

export function runModules(modules: Module[], facts: TypedFacts, ctx: ModuleContext): void {
  const factsMajor = facts.contractVersion.split('.')[0];
  for (const mod of modules) {
    if (mod.supportedMajorVersion !== factsMajor) {
      console.warn(
        `[module-registry] skipping module "${mod.name}": supports contract major version ${mod.supportedMajorVersion}, facts are contractVersion ${facts.contractVersion}`
      );
      continue;
    }
    try {
      mod.run(facts, ctx);
    } catch (err) {
      console.error(`[module-registry] module "${mod.name}" failed: ${err}`);
    }
  }
}
