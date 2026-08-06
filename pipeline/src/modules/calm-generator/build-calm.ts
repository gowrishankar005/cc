import * as path from 'path';
import { TypedFacts } from '../../types/typed-facts';
import { CalmDocument } from '../../types/calm';
import { loadNodeTypeMapping, loadRelationshipTypeMapping } from '../../rules/construct-mapping-schema';
import { buildNodes } from './node-builder';
import { attachInterfaces } from './interface-builder';
import { buildRelationships } from './relationship-builder';
import { attachNodeMetadata, buildDocumentMetadata } from './metadata-builder';

/**
 * typed-facts.json -> CALM 1.2. Thin orchestrator over catalogue-driven
 * builders (Solution Design v2 §5) — replaces the earlier single-file version
 * that hardcoded node-type casts and an isDbEdge ? connects : interacts
 * conditional (the confirmed-live schema bug, requirements v0.9 §1). Adding a
 * new unit kind or relationship shape is now a row in node-type-mapping.yml /
 * relationship-type-mapping.yml, not a change to this file or the builders.
 *
 * control-builder / decorator-builder (the remaining two of the six builders
 * specified in Solution Design v2 §5.5/§5.8) are not wired in here yet —
 * control detection (rules/control-requirement-catalogue.yml) and the
 * k8s-manifest provider that feeds deployment decorators don't exist in the
 * pipeline yet. Left out honestly rather than stubbed to look complete.
 */
export function buildCalm(facts: TypedFacts): CalmDocument {
  const rulesDir = path.join(__dirname, '..', '..', 'rules');
  const nodeTypeMapping = loadNodeTypeMapping(rulesDir);
  const relationshipTypeMapping = loadRelationshipTypeMapping(rulesDir);

  const units = facts.units.filter((u) => u.kind !== 'unresolved');

  const nodes = buildNodes(units, nodeTypeMapping);
  attachInterfaces(units, nodes, nodeTypeMapping);
  attachNodeMetadata(units, nodes, facts);

  const relationships = buildRelationships(facts.relationships, nodes, relationshipTypeMapping);

  return {
    nodes,
    relationships,
    metadata: buildDocumentMetadata(facts),
  };
}
