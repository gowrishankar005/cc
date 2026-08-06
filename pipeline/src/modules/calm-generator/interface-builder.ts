import { TypedUnit } from '../../types/typed-facts';
import { CalmNode, CalmInterface } from '../../types/calm';
import { NodeTypeMapping, findNodeTypeMapping } from '../../rules/construct-mapping-schema';

/**
 * Attaches interfaces to already-built nodes (mutates in place), catalogue-driven
 * (Solution Design v2 §5.2) rather than the earlier hardcoded
 * `category === 'http-entry-point'` literal check. Which evidence categories
 * become interfaces is a node-type-mapping.yml property now, not code.
 *
 * Native-route-beats-decorator-fallback precedence is preserved (found via the
 * NestJS fixture: when native route typing succeeds, the extractFromSource()
 * decorator fallback also fires for the same routes, producing a redundant,
 * lower-quality interface for the same endpoint) — generalized here to work
 * off Evidence.source rather than being re-derived per unit kind.
 */
export function attachInterfaces(units: TypedUnit[], nodes: CalmNode[], mapping: NodeTypeMapping): void {
  const nodesById = new Map(nodes.map((n) => [n['unique-id'], n]));

  for (const unit of units) {
    const node = nodesById.get(unit.id);
    if (!node) continue;
    const rule = findNodeTypeMapping(mapping, unit.kind);
    if (!rule) continue;

    const hasNativeRouteEvidence = unit.evidence.some((e) => e.source === 'native-route');
    const interfaces: CalmInterface[] = unit.evidence
      .filter(
        (e) => rule.interfaceCategories.includes(e.category) && (e.source === 'native-route' || !hasNativeRouteEvidence)
      )
      .map((e, i) => ({
        'unique-id': `${unit.id}::iface-${i}`,
        type: 'path-interface' as const,
        path: e.signal,
      }));

    if (interfaces.length > 0) {
      node.interfaces = interfaces;
    }
  }
}
