import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

export interface EngineCapabilityRoute {
  language: string;
  framework: string[];
  primaryEngine: string;
  fallbackEngine?: string;
  augmentEngine?: string;
  augmentTrigger?: string;
  corroborateEngine?: string;
  evidenceLevel: string;
}

/**
 * T-onboarding-16 — a relationship-resolution capability (cuts across
 * units), deliberately a separate shape from EngineCapabilityRoute
 * (per-unit type dispatch) rather than forced into its
 * primaryEngine/augmentEngine fields. See the YAML file's own comment for
 * why. `evidenceLevel` is a measured-or-not gate, not a numeric confidence
 * value — real per-framework confidence numbers don't exist; inventing them
 * would be unevidenced.
 */
export interface RelationshipMechanismEntry {
  language: string;
  framework: string[];
  mechanism: string;
  evidenceLevel: string;
  note?: string;
}

export interface EngineCapabilityMatrix {
  version: string;
  routes: EngineCapabilityRoute[];
  relationshipMechanisms?: RelationshipMechanismEntry[];
  crossPackageBackbone: string;
}

export function loadEngineCapabilityMatrix(scannerDir: string = __dirname): EngineCapabilityMatrix {
  const filePath = path.join(scannerDir, 'engine-capability-matrix.yml');
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = parseYaml(raw) as EngineCapabilityMatrix;
  if (!doc.version || !Array.isArray(doc.routes)) {
    throw new Error(`engine-capability-matrix.yml at ${filePath} is malformed: missing version or routes array`);
  }
  return doc;
}

/**
 * T-onboarding-16 — a real, cheap runtime check: does this file's own
 * `relationshipMechanisms:` section already know about this mechanism for
 * this language, and mark it `proven`? Framework is deliberately NOT part
 * of this check (only language + mechanism) — `di_resolution.ql` and its
 * kind only ever match real, framework-specific syntax (Spring
 * annotations, Guice's `bind().to()`, etc.), so producing real bindings at
 * all is itself strong evidence the matched code genuinely is that
 * framework; the risk this guards against is DRIFT (a mechanism shipping
 * or being exploratorily run without this file ever being told about it),
 * not per-framework confidence scaling.
 */
export function isRelationshipMechanismProven(matrix: EngineCapabilityMatrix, language: string, mechanism: string): boolean {
  return (matrix.relationshipMechanisms ?? []).some((m) => m.language === language && m.mechanism === mechanism && m.evidenceLevel === 'proven');
}

/**
 * Call after a relationship mechanism actually produces real output — logs
 * a WARNING (never blocks the run) when this file has no `proven` entry
 * for it, so a future new/exploratory mechanism firing without this file
 * being updated is surfaced, not silently unnoticed. `bindingCount` is
 * purely for the log message, no gating logic depends on it.
 */
export function warnIfMechanismUnverified(matrix: EngineCapabilityMatrix, language: string, mechanism: string, bindingCount: number): void {
  if (bindingCount === 0) return;
  if (isRelationshipMechanismProven(matrix, language, mechanism)) return;
  const entry = (matrix.relationshipMechanisms ?? []).find((m) => m.language === language && m.mechanism === mechanism);
  const status = entry ? `evidenceLevel "${entry.evidenceLevel}"` : 'no entry at all';
  console.warn(`[engine-capability-matrix] WARNING: "${mechanism}" (${language}) produced ${bindingCount} real binding(s) but engine-capability-matrix.yml's relationshipMechanisms section has ${status} for it — update the matrix if this mechanism is now real and measured, or investigate if this firing was unexpected.`);
}

/**
 * Wave M T-M10 — stub integration, per the task's own allowance ("load and
 * validate + log planned engines" is acceptable when there's no second real
 * engine to route to yet — only codeGraphEngine exists as a real
 * StructuralEngine, structural-engine.ts). Confirms the matrix stays in
 * sync with what's actually running (primaryEngine for jax-rs/jpa really is
 * codegraph-extract-from-source, not codeql) rather than letting docs and
 * code drift the way v2 §6.1's YAML once did before this fix.
 */
export function logEngineCapabilitySummary(matrix: EngineCapabilityMatrix): void {
  const proven = matrix.routes.filter((r) => r.evidenceLevel === 'proven' || r.evidenceLevel === 'proven-entity-only').length;
  const augmentPending = matrix.routes.filter((r) => r.augmentEngine).length;
  console.log(
    `[engine-capability-matrix] v${matrix.version}: ${matrix.routes.length} route(s), ${proven} proven, ${augmentPending} with a Phase 2 augment engine (none fired yet), cross-package backbone: ${matrix.crossPackageBackbone}`
  );
}
