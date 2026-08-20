import { DeploymentManifest, ConfigMapKeys } from '../../scanner/k8s-manifest-provider';
import { TypedUnit, TypedRelationship, IgnoredItem, PENDING_STATUS, PENDING_RELATIONSHIP_ID } from '../../types/typed-facts';
import { EnvRelationshipAllowlist, allowlistedBasename } from '../../rules/env-relationship-schema';
import { findUnitForDeployment } from './deployment-correlation';

/**
 * Real evidence: a reference Python microservices banking app's
 * `service-api-config` ConfigMap has KEY NAMES (never read: its values)
 * like `USERSERVICE_API_ADDR`/`CONTACTS_API_ADDR` that, after stripping an
 * allowlisted suffix (env-relationship-allowlist.yml), match OTHER real
 * deployment names in the same manifest set almost exactly
 * ("USERSERVICE_API_ADDR" -> "userservice", an EXACT match against the
 * real `userservice` Deployment). This is a soft, low-confidence signal —
 * unlike the shares-secret detector (a structural fact: two deployments
 * literally mount the same secret), this is a NAME-CORRELATION GUESS
 * (the key name strongly suggests, but doesn't prove, the referencing
 * deployment talks to that target) — hence fixed low confidence (20,
 * matching every other import-only/weak-evidence mechanism in this
 * pipeline) and OFF BY DEFAULT (env-soft-graph-pass.ts only runs when
 * explicitly enabled).
 *
 * Real, checked limitation: 2 of 5 real the reference Python app keys do NOT correlate this way
 * (BALANCES_API_ADDR -> "balances" vs. the real deployment name
 * "balance-reader"; TRANSACTIONS_API_ADDR -> "transactions" vs. the real
 * deployment name "ledger-writer" — no naming relationship at all) — both
 * correctly produce an unresolved ignored-item, not a wrong guess. This was
 * verified against the real manifest BEFORE writing the matching logic,
 * not discovered after the fact.
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findMatchingDeployment(basename: string, deployments: DeploymentManifest[], excludeName: string): DeploymentManifest | undefined {
  const normBase = normalize(basename);
  const candidates = deployments.filter((d) => d.name !== excludeName);
  const exact = candidates.find((d) => normalize(d.name) === normBase);
  if (exact) return exact;
  return candidates.find((d) => normalize(d.name).includes(normBase) || normBase.includes(normalize(d.name)));
}

export function detectEnvSoftGraphRelationships(
  deployments: DeploymentManifest[],
  configMaps: ConfigMapKeys[],
  units: TypedUnit[],
  allowlist: EnvRelationshipAllowlist
): { relationships: TypedRelationship[]; ignoredItems: IgnoredItem[] } {
  const relationships: TypedRelationship[] = [];
  const ignoredItems: IgnoredItem[] = [];
  const seenPairs = new Set<string>();
  const configMapByName = new Map(configMaps.map((c) => [c.name, c]));

  for (const referencer of deployments) {
    for (const configMapName of referencer.configMapNames) {
      const configMap = configMapByName.get(configMapName);
      if (!configMap) continue;

      for (const keyName of configMap.keyNames) {
        const basename = allowlistedBasename(keyName, allowlist);
        if (!basename) continue; // key name doesn't match an allowlisted pattern — not considered at all

        const target = findMatchingDeployment(basename, deployments, referencer.name);
        if (!target) {
          ignoredItems.push({
            ref: `k8s:configmap:${configMapName}:${keyName}`,
            reason: 'CROSS_DOMAIN_UNRESOLVED',
            detail: `unresolved-env-target: "${referencer.name}" references ConfigMap "${configMapName}" key "${keyName}" (allowlisted basename "${basename}") but no other deployment name correlates — no relationship emitted, per the "never guess" rule.`,
          });
          continue;
        }

        const referencerUnit = findUnitForDeployment(units, referencer.name);
        const targetUnit = findUnitForDeployment(units, target.name);
        if (!referencerUnit || !targetUnit) {
          ignoredItems.push({
            ref: `k8s:configmap:${configMapName}:${keyName}`,
            reason: 'CROSS_DOMAIN_UNRESOLVED',
            detail: `unresolved-env-target: name-correlated "${referencer.name}" -> "${target.name}" (ConfigMap "${configMapName}" key "${keyName}") but ${!referencerUnit ? `no TypedUnit matches "${referencer.name}"` : `no TypedUnit matches "${target.name}"`} — no code-level unit to attach the relationship to.`,
          });
          continue;
        }

        const pairKey = `${referencerUnit.id}->${targetUnit.id}`;
        if (seenPairs.has(pairKey)) continue; // multiple allowlisted keys can point at the same target — one edge, not one per key
        seenPairs.add(pairKey);

        relationships.push({
          from: referencerUnit.id,
          to: targetUnit.id,
          kind: 'connects',
          crossPackage: referencerUnit.filePath !== targetUnit.filePath,
          source: 'k8s',
          confidence: 20, // low, fixed — a name-correlation guess, never promoted (T-X9-1's own explicit instruction)
          status: PENDING_STATUS,
          id: PENDING_RELATIONSHIP_ID,
        });
      }
    }
  }

  return { relationships, ignoredItems };
}
