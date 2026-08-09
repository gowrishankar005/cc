import { DeploymentManifest } from '../../scanner/k8s-manifest-provider';
import { TypedUnit, TypedRelationship, IgnoredItem } from '../../types/typed-facts';
import { findUnitForDeployment } from './deployment-correlation';

/**
 * T-X5-1 (requirements v0.7 §3.1) — groups Deployments by shared Secret
 * name, infers issuer/verifier role ONLY from the manifest's own
 * `items[].key` naming (a real, grep-verified pattern in a reference Python microservices banking app:
 * `userservice` mounts BOTH `jwtRS256.key` (private) and `jwtRS256.key.pub`
 * (public) under `secretName: jwt-key`; `contacts`/`frontend`/
 * `balance-reader`/`ledger-writer`/`transaction-history` mount ONLY the
 * `.pub` key under the same secret name) — never guesses a direction when
 * that signal is absent, matching v0.7 §3.1's explicit rule.
 *
 * Deployment<->TypedUnit correlation is `deployment-correlation.ts`'s
 * `findUnitForDeployment()` — shared with env-soft-graph-detector.ts, fixed
 * generically (not here) to also resolve Java's verbose controller-class
 * naming (BalanceReaderController.java <-> "balance-reader" deployment).
 */
// Grep-verified against the real manifests, not assumed: the reference Python app's convention
// names the PUBLIC half with a ".pub" suffix (`jwtRS256.key.pub`) and the
// PRIVATE half with none (`jwtRS256.key`) — a naive "look for the word
// 'private'" heuristic finds nothing, since the private key's name doesn't
// say so; it's the ABSENCE of the public-key marker that signals it.
const PUBLIC_KEY_HINT = /pub/i;

function inferRole(itemKeys: string[]): 'issuer' | 'verifier' | 'ambiguous' {
  if (itemKeys.length === 0) return 'ambiguous'; // whole secret mounted, no per-key signal to read a role from
  const mountsNonPublicKey = itemKeys.some((k) => !PUBLIC_KEY_HINT.test(k));
  return mountsNonPublicKey ? 'issuer' : 'verifier';
}

export function detectK8sTrustRelationships(
  deployments: DeploymentManifest[],
  units: TypedUnit[]
): { relationships: TypedRelationship[]; ignoredItems: IgnoredItem[] } {
  const relationships: TypedRelationship[] = [];
  const ignoredItems: IgnoredItem[] = [];

  const secretGroups = new Map<string, DeploymentManifest[]>();
  for (const dep of deployments) {
    for (const mount of dep.secretMounts) {
      if (!secretGroups.has(mount.secretName)) secretGroups.set(mount.secretName, []);
      secretGroups.get(mount.secretName)!.push(dep);
    }
  }

  for (const [secretName, members] of secretGroups) {
    if (members.length < 2) continue; // a secret mounted by only one deployment isn't a trust relationship between services

    const issuers = members.filter((m) => inferRole(m.secretMounts.find((s) => s.secretName === secretName)!.itemKeys) === 'issuer');
    const verifiers = members.filter((m) => inferRole(m.secretMounts.find((s) => s.secretName === secretName)!.itemKeys) === 'verifier');

    if (issuers.length !== 1) {
      // 0 issuers: no manifest-level signal distinguishes a direction. >1 issuer: ambiguous, don't guess which is authoritative.
      ignoredItems.push({
        ref: `k8s:secret:${secretName}`,
        reason: 'CROSS_DOMAIN_UNRESOLVED',
        detail: `unresolved-k8s-trust: Secret "${secretName}" shared by ${members.length} deployment(s) (${members.map((m) => m.name).join(', ')}) but issuer role could not be inferred (${issuers.length} candidate issuer(s) found via items[].key naming) — no relationship emitted, per v0.7 §3.1's "never guess a direction" rule.`,
      });
      continue;
    }

    const issuerUnit = findUnitForDeployment(units, issuers[0].name);
    for (const verifier of verifiers) {
      const verifierUnit = findUnitForDeployment(units, verifier.name);
      if (!issuerUnit || !verifierUnit) {
        ignoredItems.push({
          ref: `k8s:secret:${secretName}:${verifier.name}`,
          reason: 'CROSS_DOMAIN_UNRESOLVED',
          detail: `unresolved-k8s-trust: inferred trust edge "${verifier.name}" -> "${issuers[0].name}" (shared secret "${secretName}") but ${!verifierUnit ? `no TypedUnit matches deployment "${verifier.name}"` : `no TypedUnit matches deployment "${issuers[0].name}"`} — no code-level unit to attach the relationship to.`,
        });
        continue;
      }
      relationships.push({
        from: verifierUnit.id,
        to: issuerUnit.id,
        kind: 'shares-secret',
        crossPackage: verifierUnit.filePath !== issuerUnit.filePath, // best-effort; real cross-package-ness is a Graphify-reconciler concept this doesn't have access to
        source: 'k8s',
      });
    }
  }

  return { relationships, ignoredItems };
}
