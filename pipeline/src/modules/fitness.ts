import * as fs from 'fs';
import * as path from 'path';

/**
 * T-LM-5 (AGENT_TASKS_Ext_Lens_Modules.md, BR-110) — "fitness-for-purpose
 * must be measured, not assumed... a lens with no current fitness
 * measurement may inform, but must not gate, a governance decision." Before
 * this, a module's measured status (P/R against `coe-lab/gold/modules/`)
 * lived ONLY as Claim_Register.md prose — real, but not machine-readable,
 * so nothing consuming a module's own report JSON could tell "measured" from
 * "assumed" without a human going and reading a different document.
 *
 * Deliberately NOT computed live at run time: the coe-lab gold this measures
 * against is evaluation-only data (`CoE Lab isolation`, CLAUDE.md) — a real
 * customer run has no gold present and must never try to read any, so the
 * fitness NUMBER is checked-in, human-updated declaration data (same class
 * as Claim_Register.md itself: a claim, sourced from evaluation work done
 * separately, not derived from the live run it's attached to). Re-run the
 * module's own `coe-lab/scripts/score-module-<name>.mjs` and update its
 * `fitness.json` by hand whenever real coverage changes — never let this
 * drift stale silently; there is no test that can catch that for you.
 */
export interface ModuleFitness {
  status: 'measured' | 'not-yet-fit-to-gate';
  lastMeasuredAt?: string; // ISO date, only when status is 'measured'
  exactMatchRate?: number; // 0-1, gold packages that scored an exact match / packages scored
  goldSampleSize?: number;
  evidence?: string; // pointer to the real scorer + gold directory this number came from
}

const UNMEASURED: ModuleFitness = { status: 'not-yet-fit-to-gate' };

function isValidFitness(value: unknown): value is ModuleFitness {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.status === 'measured' || v.status === 'not-yet-fit-to-gate';
}

/**
 * Reads `<this file's dir>/<moduleName>/fitness.json`. Absent, unreadable,
 * or malformed all resolve to the same honest default — BR-110's own rule
 * ("no measurement -> must not gate") means a missing declaration is never
 * treated as an error, only ever as "not yet measured."
 */
export function loadModuleFitness(moduleName: string): ModuleFitness {
  const fitnessPath = path.join(__dirname, moduleName, 'fitness.json');
  if (!fs.existsSync(fitnessPath)) return UNMEASURED;
  try {
    const parsed = JSON.parse(fs.readFileSync(fitnessPath, 'utf8'));
    return isValidFitness(parsed) ? parsed : UNMEASURED;
  } catch {
    return UNMEASURED;
  }
}
