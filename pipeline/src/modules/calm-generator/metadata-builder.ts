import * as path from 'path';
import { TypedFacts, TypedUnit } from '../../types/typed-facts';
import { CalmNode, CalmMetadataEntry } from '../../types/calm';
import { loadScopeLimitations } from '../../rules/scope-limitations-schema';

/** Attaches per-node x-aac-* metadata (mutates in place) — unchanged fields from the original build-calm.ts. */
export function attachNodeMetadata(units: TypedUnit[], nodes: CalmNode[], facts: TypedFacts): void {
  const nodesById = new Map(nodes.map((n) => [n['unique-id'], n]));
  for (const unit of units) {
    const node = nodesById.get(unit.id);
    if (!node) continue;
    node.metadata = [
      { key: 'x-aac-confidence', value: unit.confidence },
      { key: 'x-aac-provenance', value: unit.evidence.map((e) => e.ref) },
      { key: 'x-aac-run-version', value: facts.runVersion },
      // T-FS-6 — absent, not a fake default, for a unit assignStatuses()
      // hasn't run over (only ever true for a typed-facts.json predating
      // this field, never a live run).
      ...(unit.status !== undefined ? [{ key: 'x-aac-status', value: unit.status }] : []),
    ];
  }
}

/** Document-root x-aac-* metadata, including the scope-limitations disclosure (T-X0-3 — sourced from rules/scope-limitations.yml, not a hardcoded literal). */
export function buildDocumentMetadata(facts: TypedFacts): CalmMetadataEntry[] {
  const scopeLimitations = loadScopeLimitations(path.join(__dirname, '..', '..', 'rules'));
  return [
    { key: 'x-aac-run-version', value: facts.runVersion },
    { key: 'x-aac-generated-at', value: facts.generatedAt },
    { key: 'x-aac-package-roots', value: facts.packageRoots },
    {
      key: 'x-aac-scope-limitations',
      value: scopeLimitations.limitations.map((l) => l.text),
    },
  ];
}
