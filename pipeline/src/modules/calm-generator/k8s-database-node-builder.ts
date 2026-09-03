import { TypedRelationship } from '../../types/typed-facts';
import { CalmNode } from '../../types/calm';

/**
 * §5.7a (Architecture_as_Code_Solution_Design_v2.md): a k8s Deployment
 * running a recognized database engine image (postgres, mysql, mongo, ...)
 * but with no scanned source at all (a pure init-script/config directory)
 * has no TypedUnit, so unlike every other CALM node in this pipeline it is
 * never built from one; it's built directly as a CALM node, same pattern as
 * k8s-namespace-node-builder.ts's own synthetic namespace node. `node-type:
 * database` — the deployment IS a real database, confirmed by its own
 * container image, not a placement/boundary construct like the namespace
 * node.
 *
 * Must run BEFORE relationship-builder.ts's buildRelationships (same
 * constraint k8s-namespace-node-builder.ts already documents): a
 * TypedRelationship's `to` (env-soft-graph-detector.ts's target-side
 * fallback, when findUnitForDeployment finds no real TypedUnit but the
 * deployment's image matches a known database engine via
 * contradiction-detector.ts's own imageEngine()) has to already be a real
 * node id or buildRelationships' `nodeIds.has(r.to)` filter silently drops
 * it.
 */
const K8S_DATABASE_ID_PREFIX = 'k8s-database:';

export function k8sDatabaseNodeId(deploymentName: string): string {
  return `${K8S_DATABASE_ID_PREFIX}${deploymentName}`;
}

export function buildK8sDatabaseNodes(relationships: TypedRelationship[]): CalmNode[] {
  const deploymentNames = new Set<string>();
  for (const rel of relationships) {
    // Check both from/to, not just to (unlike k8s-namespace-node-builder.ts,
    // which only checks `to`) — a referencer will never carry this prefix in
    // practice (env-soft-graph-detector.ts only ever synthesizes the TARGET
    // side), but checking both costs nothing and avoids a latent gap if that
    // ever changes.
    if (rel.from.startsWith(K8S_DATABASE_ID_PREFIX)) deploymentNames.add(rel.from.slice(K8S_DATABASE_ID_PREFIX.length));
    if (rel.to.startsWith(K8S_DATABASE_ID_PREFIX)) deploymentNames.add(rel.to.slice(K8S_DATABASE_ID_PREFIX.length));
  }
  return [...deploymentNames].sort().map((name) => ({
    'unique-id': k8sDatabaseNodeId(name),
    'node-type': 'database',
    name,
    description: `Kubernetes deployment "${name}" — a recognized database engine image with no scanned source (synthesized from k8s manifest evidence only).`,
  }));
}
