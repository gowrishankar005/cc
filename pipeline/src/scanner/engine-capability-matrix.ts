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

export interface EngineCapabilityMatrix {
  version: string;
  routes: EngineCapabilityRoute[];
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
 * Wave M T-M10 — stub integration, per the task's own allowance ("load and
 * validate + log planned engines" is acceptable when there's no second real
 * engine to route to yet — only codeGraphEngine exists as a real
 * StructuralEngine, structural-engine.ts). Confirms the matrix stays in
 * sync with what's actually running (primaryEngine for jax-rs/jpa really is
 * codegraph-extract-from-source, not codeql) rather than letting docs and
 * code drift the way v2 §6.1's YAML once did before this session's fix.
 */
export function logEngineCapabilitySummary(matrix: EngineCapabilityMatrix): void {
  const proven = matrix.routes.filter((r) => r.evidenceLevel === 'proven' || r.evidenceLevel === 'proven-entity-only').length;
  const augmentPending = matrix.routes.filter((r) => r.augmentEngine).length;
  console.log(
    `[engine-capability-matrix] v${matrix.version}: ${matrix.routes.length} route(s), ${proven} proven, ${augmentPending} with a Phase 2 augment engine (none fired yet), cross-package backbone: ${matrix.crossPackageBackbone}`
  );
}
