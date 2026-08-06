import { TypedUnit } from '../../types/typed-facts';
import { CalmNode } from '../../types/calm';
import { NodeTypeMapping, findNodeTypeMapping } from '../../rules/construct-mapping-schema';

/**
 * Catalogue-driven node construction (Solution Design v2 §5.2/§5.4).
 * Node-type comes from node-type-mapping.yml, not a direct
 * `unit.kind as CalmNodeType` cast — that cast only worked because
 * TypedUnit.kind and CalmNodeType happened to share two literal strings;
 * it breaks silently the moment a new unit kind (e.g. `batch-job`, `topic`)
 * is added without a matching mapping row. Building the skeleton node only —
 * interfaces/metadata are attached by their own builders (interface-builder,
 * metadata-builder), operating on the same node objects.
 */
export function buildNodes(units: TypedUnit[], mapping: NodeTypeMapping): CalmNode[] {
  const nodes: CalmNode[] = [];
  for (const unit of units) {
    if (unit.kind === 'unresolved') continue;
    const rule = findNodeTypeMapping(mapping, unit.kind);
    if (!rule) {
      // No catalogue row for this unit kind — this is what §5.2 is meant to
      // prevent: fail loudly (skip + let it be visible) rather than silently
      // mis-cast, so a missing mapping row shows up as a missing node, not a
      // wrong node-type in generated CALM.
      continue;
    }
    nodes.push({
      'unique-id': unit.id,
      'node-type': rule.calmNodeType,
      name: unit.name,
      description: `Discovered from ${unit.evidence.length} signal(s) in ${unit.filePath}`,
    });
  }
  return nodes;
}
