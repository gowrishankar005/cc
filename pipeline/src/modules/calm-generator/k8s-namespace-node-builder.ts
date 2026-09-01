import { TypedRelationship } from '../../types/typed-facts';
import { CalmNode } from '../../types/calm';

/**
 * A k8s namespace has no source file, so unlike every other CALM
 * node in this pipeline it is never a TypedUnit; it's built directly as a
 * CALM node, same pattern as system-node-builder.ts's synthetic `system`
 * node. `node-type: system` per Architecture_as_Code_Solution_Design_v2.md
 * §14.1's own "Closed here" decision (confirmed real CALM usage in
 * calm-3.json, §5.7).
 *
 * Must run BEFORE relationship-builder.ts's buildRelationships (unlike
 * system-node-builder.ts, which deliberately runs after — its composed-of
 * set needs the FINAL node list): a `deployed-in` TypedRelationship's `to`
 * has to already be a real node id in the `nodes` array, or
 * buildRelationships' `nodeIds.has(r.to)` filter silently drops it.
 */
const NAMESPACE_ID_PREFIX = 'k8s-namespace:';

export function namespaceNodeId(namespace: string): string {
  return `${NAMESPACE_ID_PREFIX}${namespace}`;
}

export function buildK8sNamespaceNodes(relationships: TypedRelationship[]): CalmNode[] {
  const namespaces = new Set<string>();
  for (const rel of relationships) {
    if (rel.kind === 'deployed-in' && rel.to.startsWith(NAMESPACE_ID_PREFIX)) {
      namespaces.add(rel.to.slice(NAMESPACE_ID_PREFIX.length));
    }
  }
  return [...namespaces].sort().map((namespace) => ({
    'unique-id': namespaceNodeId(namespace),
    'node-type': 'system',
    name: namespace,
    description: `Kubernetes namespace "${namespace}" — runtime placement container.`,
  }));
}
