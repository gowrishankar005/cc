import { TypedFacts, TypedUnit } from '../../types/typed-facts';
import { CalmNode, CalmMetadataEntry } from '../../types/calm';

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
    ];
  }
}

/** Document-root x-aac-* metadata, including the scope-limitations disclosure. */
export function buildDocumentMetadata(facts: TypedFacts): CalmMetadataEntry[] {
  return [
    { key: 'x-aac-run-version', value: facts.runVersion },
    { key: 'x-aac-generated-at', value: facts.generatedAt },
    { key: 'x-aac-package-roots', value: facts.packageRoots },
    {
      key: 'x-aac-scope-limitations',
      value: [
        'HTTP-entry-point and Graphify-visible-persistence signals only (Slice 1 scope, requirements v0.6 §1.5).',
        'Config/env-var-mediated relationships (e.g. JWT signing-key trust between services) are not detected.',
        'Intra-file business logic (validation, auth checks) is not modeled as separate units.',
        'A high x-aac-confidence score reflects certainty about the SIGNALS FOUND, not completeness of the architecture picture.',
      ],
    },
  ];
}
