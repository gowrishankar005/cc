import { DeploymentManifest } from '../../scanner/k8s-manifest-provider';
import { TypedUnit, TypedRelationship, IgnoredItem, PENDING_STATUS, PENDING_RELATIONSHIP_ID } from '../../types/typed-facts';
import { namespaceNodeId } from '../../modules/calm-generator/k8s-namespace-node-builder';
import { findUnitForDeployment } from './deployment-correlation';

/**
 * Runtime PLACEMENT half of the k8s manifest provider (the trust
 * half, shares-secret, is k8s-trust-detector.ts). Flat/pre-rendered
 * manifests only, same scope boundary as the rest of this provider
 * (`OOS-helm-kustomize`).
 *
 * Deliberately narrow: one `deployed-in` edge per Deployment that resolves
 * to a real `service`-kind TypedUnit (findUnitForDeployment, shared with
 * k8s-trust-detector.ts/env-soft-graph-detector.ts — same correlation rule,
 * same MIN_SUBSTRING_MATCH_LENGTH/service-kind-only guard). A Deployment
 * that doesn't resolve is a named, honest gap (CROSS_DOMAIN_UNRESOLVED),
 * never a guess at which unit it must be.
 */
export function detectK8sDeployedInRelationships(
  deployments: DeploymentManifest[],
  units: TypedUnit[]
): { relationships: TypedRelationship[]; ignoredItems: IgnoredItem[] } {
  const relationships: TypedRelationship[] = [];
  const ignoredItems: IgnoredItem[] = [];
  const seenPairs = new Set<string>(); // 2+ Deployments naming the same unit+namespace collapse to one edge

  for (const dep of deployments) {
    const unit = findUnitForDeployment(units, dep.name);
    if (!unit) {
      ignoredItems.push({
        ref: `k8s:deployment:${dep.name}`,
        reason: 'CROSS_DOMAIN_UNRESOLVED',
        detail: `unresolved-k8s-deployed-in: no TypedUnit matches deployment "${dep.name}" (namespace "${dep.namespace}") — no code-level unit to attach the placement relationship to.`,
      });
      continue;
    }

    const to = namespaceNodeId(dep.namespace);
    const pairKey = `${unit.id}->${to}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    relationships.push({
      from: unit.id,
      to,
      kind: 'deployed-in',
      crossPackage: false, // namespace placement isn't a code-package concept
      source: 'k8s',
      status: PENDING_STATUS,
      id: PENDING_RELATIONSHIP_ID,
    });
  }

  return { relationships, ignoredItems };
}
