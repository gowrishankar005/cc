import { Module } from './registry';
import { calmGeneratorModule } from './calm-generator/write-artefacts';
import { threatSignalsModule } from './threat-signals';

/**
 * The built-in name -> Module lookup. Before this, adding a
 * module to a run meant editing `run-slice.ts`'s hardcoded
 * `runModules([calmGeneratorModule, threatSignalsModule], ...)` call — a
 * core-file edit, not a "seamless module add". `run-slice.ts` now resolves module NAMES (via `--modules
 * calm-generator,threat-signals` or the default list below) against this
 * map — adding an internal module still means adding one entry here, not
 * touching orchestration logic, and an external/third-party module could
 * extend this map without a platform PR once a real plugin-discovery
 * mechanism exists (out of scope for this task — see T-M1's own "out of
 * scope: npm plugin marketplace").
 */
export const AVAILABLE_MODULES: Record<string, Module> = {
  'calm-generator': calmGeneratorModule,
  'threat-signals': threatSignalsModule,
};

export const DEFAULT_MODULE_NAMES = ['calm-generator', 'threat-signals'];

/** Resolves module names to Module objects. Throws with a clear message on an unknown name, per T-M1's acceptance criterion — never silently drops one. */
export function resolveModules(names: string[]): Module[] {
  return names.map((name) => {
    const mod = AVAILABLE_MODULES[name];
    if (!mod) {
      throw new Error(`Unknown module "${name}" — available modules: ${Object.keys(AVAILABLE_MODULES).join(', ')}`);
    }
    return mod;
  });
}
