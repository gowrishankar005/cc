import { DeploymentManifest, ConfigMapKeys } from '../../scanner/k8s-manifest-provider';
import { TypedUnit, TypedRelationship, IgnoredItem, PENDING_STATUS, PENDING_RELATIONSHIP_ID } from '../../types/typed-facts';
import { EnvRelationshipAllowlist, allowlistedBasename } from '../../rules/env-relationship-schema';
import { findUnitForDeployment } from './deployment-correlation';
import { imageEngine } from './contradiction-detector';
import { k8sDatabaseNodeId } from '../../modules/calm-generator/k8s-database-node-builder';

/**
 * Real evidence: a reference Python microservices banking app's
 * `service-api-config` ConfigMap has KEY NAMES like
 * `USERSERVICE_API_ADDR`/`CONTACTS_API_ADDR` that, after stripping an
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
 *
 * Value-based fallback (found live, real evidence, 2026-09-04, a different
 * reference Java/Python microservices banking sample): when name-basename
 * correlation fails, the key's own VALUE — a bare `host:port` or a URI —
 * often resolves to the real target by an EXACT literal match instead of a
 * fuzzy name guess (`k8s-manifest-provider.ts`'s `ConfigMapKeys.keyHosts`,
 * populated with a bare, already-credential-stripped host, never a raw
 * value). Deliberately never auto-emitted into `relationships` at any
 * confidence — routed through the existing `unresolved-outbound-target`
 * HITL review queue as a suggested target instead, since this is still
 * only one repo's evidence for this specific correlation shape.
 */
// Exported so hitl-review-trigger.ts (§3.2, unresolved-outbound-target) can
// match this exact prefix instead of re-typing it — same convention
// outbound-http-detector.ts's own exported prefix already established.
export const UNRESOLVED_ENV_TARGET_PREFIX = 'unresolved-env-target:';

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
          // Value-based fallback (found live, real evidence, 2026-09-04): the
          // key's own VALUE is often a literal, exact reference this
          // basename-name guess just failed to find by name alone — e.g.
          // "TRANSACTIONS_API_ADDR" guesses basename "TRANSACTIONS" (no
          // deployment named that), but the real value is literally
          // "ledgerwriter:8080". extractedHost is already stripped to a bare
          // host by k8s-manifest-provider.ts — never a raw value, never a
          // credential, this file never sees either. Structurally stronger
          // than the name guess above (an exact literal match, not a fuzzy
          // one) but deliberately NOT auto-emitted into `relationships` —
          // still only ONE repo's evidence for this specific correlation
          // path, and per this project's explicit HITL-gating decision for
          // this mechanism, it becomes a high-confidence SUGGESTED target for
          // human review via the existing unresolved-outbound-target queue
          // (same UNRESOLVED_ENV_TARGET_PREFIX-matching hitl-review-trigger.ts
          // already reuses unmodified — no new trigger plumbing needed), not
          // a 4th path that writes directly into canonical CALM.
          const extractedHost = configMap.keyHosts?.[keyName];
          if (extractedHost && normalize(extractedHost) === normalize(referencer.name)) {
            ignoredItems.push({
              ref: `k8s:configmap:${configMapName}:${keyName}`,
              reason: 'CROSS_DOMAIN_UNRESOLVED',
              detail: `${UNRESOLVED_ENV_TARGET_PREFIX} "${referencer.name}" references ConfigMap "${configMapName}" key "${keyName}" whose own value resolves back to itself (self-reference, e.g. a shared ConfigMap applied to every deployment regardless of use) — no relationship emitted, this is not a missing correlation.`,
            });
            continue;
          }
          const valueTarget = extractedHost ? deployments.find((d) => d.name !== referencer.name && normalize(d.name) === normalize(extractedHost)) : undefined;
          if (valueTarget) {
            ignoredItems.push({
              ref: `k8s:configmap:${configMapName}:${keyName}`,
              reason: 'CROSS_DOMAIN_UNRESOLVED',
              detail: `${UNRESOLVED_ENV_TARGET_PREFIX} "${referencer.name}" references ConfigMap "${configMapName}" key "${keyName}" — the key's own NAME doesn't correlate to any deployment, but its VALUE resolves to a real deployment "${valueTarget.name}" by exact host match — high-confidence candidate for relationship_add via HITL review, not auto-emitted (single-repo-evidenced mechanism, deliberately review-gated).`,
            });
            continue;
          }
          ignoredItems.push({
            ref: `k8s:configmap:${configMapName}:${keyName}`,
            reason: 'CROSS_DOMAIN_UNRESOLVED',
            detail: `${UNRESOLVED_ENV_TARGET_PREFIX} "${referencer.name}" references ConfigMap "${configMapName}" key "${keyName}" (allowlisted basename "${basename}") but no other deployment name correlates — no relationship emitted, per the "never guess" rule.`,
          });
          continue;
        }

        const referencerUnit = findUnitForDeployment(units, referencer.name);
        if (!referencerUnit) {
          ignoredItems.push({
            ref: `k8s:configmap:${configMapName}:${keyName}`,
            reason: 'CROSS_DOMAIN_UNRESOLVED',
            detail: `${UNRESOLVED_ENV_TARGET_PREFIX} name-correlated "${referencer.name}" -> "${target.name}" (ConfigMap "${configMapName}" key "${keyName}") but no TypedUnit matches "${referencer.name}" — no code-level unit to attach the relationship to.`,
          });
          continue;
        }

        // §5.7a: the target may have no scanned source at all (a pure
        // init-script/config directory, e.g. a Postgres Deployment with no
        // application code) — real, checked evidence (a reference Java
        // microservices banking sample's ledger-db/accounts-db). Before
        // giving up, check whether the target's own container image OR
        // container name is a recognized database engine
        // (contradiction-detector.ts's own imageEngine() — already
        // shipped, already battle-tested against real Docker
        // image-reference edge cases, reused rather than re-derived) and
        // synthesize a k8s-database: node id instead of requiring a real
        // TypedUnit. Only the TARGET side gets this fallback — a
        // referencer with no scanned source is a different, out-of-scope
        // case (handled above, unchanged).
        //
        // Real gap found verifying end-to-end against the actual real
        // manifests this was designed for: a team's own custom-built
        // database image commonly carries NO literal engine name anywhere
        // in its registry path at all (real example: a reference Java
        // microservices banking sample's own `ledger-db`/`accounts-db`
        // StatefulSets both publish under their own app-registry path,
        // e.g. ".../bank-of-anthos/ledger-db:v0.6.10@sha256:...", not
        // "postgres") — but the container is conventionally still NAMED
        // after its role (the real manifest's own container carries
        // `name: postgres`). imageEngine() works unmodified on a bare
        // container-name string too (it already splits on '/' and matches
        // each segment, and a name with no slashes is just a one-segment
        // input) — checked image first (a stronger, structural signal),
        // container name second, never guessed from anything else.
        const targetUnit = findUnitForDeployment(units, target.name);
        const targetEngine = !targetUnit ? imageEngine(target.image ?? '') ?? imageEngine(target.containerName ?? '') : undefined;
        if (!targetUnit && !targetEngine) {
          ignoredItems.push({
            ref: `k8s:configmap:${configMapName}:${keyName}`,
            reason: 'CROSS_DOMAIN_UNRESOLVED',
            detail: `${UNRESOLVED_ENV_TARGET_PREFIX} name-correlated "${referencer.name}" -> "${target.name}" (ConfigMap "${configMapName}" key "${keyName}") but no TypedUnit matches "${target.name}", its deployment image ${
              target.image ? `"${target.image}"` : '(none recorded)'
            }, and its container name ${
              target.containerName ? `"${target.containerName}"` : '(none recorded)'
            } do not match a known database engine — no code-level unit to attach the relationship to.`,
          });
          continue;
        }

        const targetId = targetUnit ? targetUnit.id : k8sDatabaseNodeId(target.name);
        const pairKey = `${referencerUnit.id}->${targetId}`;
        if (seenPairs.has(pairKey)) continue; // multiple allowlisted keys can point at the same target — one edge, not one per key
        seenPairs.add(pairKey);

        relationships.push({
          from: referencerUnit.id,
          to: targetId,
          kind: 'connects',
          crossPackage: targetUnit ? referencerUnit.filePath !== targetUnit.filePath : true, // a synthesized target has no real filePath to compare — definitionally outside any scanned root
          source: 'k8s',
          confidence: 20, // low, fixed — a name-correlation guess, never promoted
          evidenceNote: targetUnit
            ? `ConfigMap "${configMapName}" key "${keyName}" (allowlisted basename "${basename}") name-correlated to deployment "${target.name}"`
            : `ConfigMap "${configMapName}" key "${keyName}" name-correlated to deployment "${target.name}" (${
                target.image && imageEngine(target.image) ? `image "${target.image}"` : `container name "${target.containerName}"`
              }, recognized database engine "${targetEngine}", no scanned source — synthesized k8s-evidenced database node)`,
          status: PENDING_STATUS,
          id: PENDING_RELATIONSHIP_ID,
        });
      }
    }
  }

  return { relationships, ignoredItems };
}
