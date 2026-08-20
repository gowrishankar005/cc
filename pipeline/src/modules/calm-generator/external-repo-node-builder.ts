import { TypedRelationship } from '../../types/typed-facts';
import { CalmNode } from '../../types/calm';

/**
 * T-MR-2 — neither endpoint of a cross-repo-manifest-sourced relationship
 * has a source file this run indexed, so (same reasoning as
 * k8s-namespace-node-builder.ts's T-MR-3 synthetic namespace node) both are
 * built directly as CALM nodes, never as a `TypedUnit`. Must run BEFORE
 * `relationship-builder.ts`'s `buildRelationships` — its `nodeIds.has(r.from)
 * && nodeIds.has(r.to)` filter silently drops a relationship whose endpoint
 * isn't already a real node id in the `nodes` array.
 *
 * `repo-root:<root>` is this run's OWN anchor — root granularity (see
 * `cross-repo-join-detector.ts`'s own doc comment on why: none of its three
 * join inputs are attributable to one class/file more precisely than "this
 * root produced this evidence"). `external-contract:<repo>|<nodeId>` is the
 * OTHER repo's published contract, named by its own T-MR-1 manifest — `|`
 * as the repo/nodeId separator (not `:`, which a filesystem-derived
 * `nodeId` — e.g. `src/main/java/...`) never itself contains, but could in
 * principle collide with a second `:` if reused).
 */
const REPO_ROOT_PREFIX = 'repo-root:';
const EXTERNAL_CONTRACT_PREFIX = 'external-contract:';

export function repoRootNodeId(root: string): string {
  return `${REPO_ROOT_PREFIX}${root}`;
}

export function externalContractNodeId(repo: string, nodeId: string): string {
  return `${EXTERNAL_CONTRACT_PREFIX}${repo}|${nodeId}`;
}

export function buildCrossRepoNodes(relationships: TypedRelationship[]): CalmNode[] {
  const repoRoots = new Set<string>();
  const externalContracts = new Set<string>();
  for (const rel of relationships) {
    if (rel.source !== 'repo-manifest') continue;
    if (rel.from.startsWith(REPO_ROOT_PREFIX)) repoRoots.add(rel.from);
    if (rel.to.startsWith(EXTERNAL_CONTRACT_PREFIX)) externalContracts.add(rel.to);
  }

  const nodes: CalmNode[] = [];
  for (const id of [...repoRoots].sort()) {
    const root = id.slice(REPO_ROOT_PREFIX.length);
    nodes.push({
      'unique-id': id,
      'node-type': 'system',
      name: root,
      description: `This run's own package root "${root}" — the anchor for a T-MR-2 ranked cross-repo join (root granularity, not a specific local unit).`,
    });
  }
  for (const id of [...externalContracts].sort()) {
    const rest = id.slice(EXTERNAL_CONTRACT_PREFIX.length);
    const sepIdx = rest.indexOf('|');
    const repo = sepIdx === -1 ? rest : rest.slice(0, sepIdx);
    const nodeId = sepIdx === -1 ? '' : rest.slice(sepIdx + 1);
    nodes.push({
      'unique-id': id,
      'node-type': 'system',
      name: nodeId || repo,
      description: `External published contract "${nodeId}" from repo "${repo}", declared in that repo's own T-MR-1 manifest — never scanned by this run.`,
    });
  }
  return nodes;
}
