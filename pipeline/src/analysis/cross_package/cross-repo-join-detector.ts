import { OpenApiDocument } from '../../scanner/openapi-provider';
import { CdxgenComponent } from '../../scanner/cdxgen-provider';
import { RepoManifest } from '../../scanner/repo-manifest-provider';
import { repoRootNodeId, externalContractNodeId } from '../../modules/calm-generator/external-repo-node-builder';
import { TypedRelationship, PENDING_STATUS, PENDING_RELATIONSHIP_ID } from '../../types/typed-facts';

/**
 * T-MR-2 (`AGENT_TASKS_Ext_MultiRepo_Deployment.md`) — ranked cross-repo
 * joins, strictly in the order the task's own acceptance text names: shared
 * API-spec identity -> published artifact coordinates -> service-catalogue/
 * DNS. Per package root, per candidate manifest entry, tiers are tried IN
 * ORDER and stop at the first match — never "collect every tier that
 * matches," which would be a ranking in name only.
 *
 * Anchors every relationship at ROOT granularity (`repoRootNodeId`), never
 * a specific local TypedUnit — none of the three inputs here
 * (openapi documents, an SBOM's dependency list, spring-config property
 * values) are attributable to one class/file more precisely than "this
 * root produced this evidence," so guessing a specific unit would be
 * exactly the kind of unforced inference this codebase's "never guess"
 * discipline exists to forbid. This is a real, disclosed granularity limit,
 * not a placeholder for something finer later without new per-unit evidence.
 */
export interface RootJoinInputs {
  // A portable LABEL for this root (e.g. `path.basename(packageRoot)`),
  // never the raw scan path — used directly as `repoRootNodeId`'s input. A
  // real bug (2026-08-20, caught by inspecting actual generated CALM
  // output, not by reading the code) had this be the full resolved
  // absolute path, baking the scanning machine's own filesystem layout
  // into the CALM node id/name and breaking T-CL-1 fact-identity stability
  // across two runs from different checkout locations.
  root: string;
  openApiDocuments: OpenApiDocument[];
  cdxgenComponents: CdxgenComponent[];
  // Raw config VALUES only (never key names) from this root's spring-config
  // files — matched against ServiceCatalogueIdentity.dns/name by exact
  // string equality, same "names only, never guessed" discipline
  // k8s-manifest-provider.ts already applies to Secret/ConfigMap references.
  springConfigValues: string[];
}

/**
 * Review finding (2026-08-20) — a real bug caught by re-reading this
 * against `repo-manifest-provider.ts`'s own `ArtifactCoordinates` doc
 * comment, which documents THREE valid human-authored forms ("a Maven
 * `purl`, an npm `name@version`, a PyPI `name==version`"), not just the one
 * this function originally returned. `scanner/cdxgen-provider.ts` always
 * populates a real `purl` for anything it recognizes — a manifest author
 * who reasonably wrote the `name@version` form this same doc comment
 * suggested would NEVER match, silently, with no error and no signal that
 * the coordinate format was wrong (only caught by testing that this
 * pass's own fixture happened to use the purl form, which papered over the
 * gap in the original single-string version of this function). Fixed to
 * check every real representation this run can actually produce for a
 * component, matched by exact string equality against
 * `PublishedContract.artifact.coordinates` — still never fuzzy/substring,
 * just no longer silently dependent on which single representation cdxgen
 * happened to prefer.
 */
function componentCoordinates(c: CdxgenComponent): string[] {
  const coordinates = [c.name];
  if (c.purl) coordinates.push(c.purl);
  if (c.version) {
    coordinates.push(`${c.name}@${c.version}`, `${c.name}==${c.version}`);
  }
  return coordinates;
}

export function detectCrossRepoJoins(inputsByRoot: Map<string, RootJoinInputs>, manifests: RepoManifest[]): { relationships: TypedRelationship[] } {
  const relationships: TypedRelationship[] = [];
  const seenPairs = new Set<string>();

  for (const [, inputs] of inputsByRoot) {
    // `inputs.root` is the portable label the caller derived (e.g.
    // `path.basename(packageRoot)`), never the Map key itself — the key is
    // only guaranteed unique for construction-time lookup, not a good node
    // id (see cross-repo-join-pass.ts's own doc comment).
    const from = repoRootNodeId(inputs.root);

    for (const manifest of manifests) {
      for (const contract of manifest.publishes) {
        const to = externalContractNodeId(manifest.repo, contract.nodeId);
        const pairKey = `${from}->${to}`;
        if (seenPairs.has(pairKey)) continue;

        // Tier 1 — shared API-spec identity. Exact title match only.
        if (contract.apiSpec && inputs.openApiDocuments.some((doc) => doc.title === contract.apiSpec!.title)) {
          seenPairs.add(pairKey);
          relationships.push(makeRelationship(from, to, 'cross-repo-api-spec'));
          continue;
        }

        // Tier 2 — published artifact coordinates. Exact coordinate match only.
        if (contract.artifact && inputs.cdxgenComponents.some((c) => componentCoordinates(c).includes(contract.artifact!.coordinates))) {
          seenPairs.add(pairKey);
          relationships.push(makeRelationship(from, to, 'cross-repo-artifact'));
          continue;
        }

        // Tier 3 — service-catalogue/DNS. Exact string match only, never
        // substring — the weakest tier (repo-manifest-provider.ts's
        // ServiceCatalogueIdentity doc comment), but the status cap below
        // applies to every tier equally, not just this one.
        const sc = contract.serviceCatalogue;
        if (sc && (sc.name || sc.dns) && inputs.springConfigValues.some((v) => v === sc.name || v === sc.dns)) {
          seenPairs.add(pairKey);
          relationships.push(makeRelationship(from, to, 'cross-repo-service-catalogue'));
          continue;
        }

        // No tier resolved — Tier 4 ("human review") is not an automatic
        // resolution step: this is the same "never guess, leave it to a
        // real relationship_add override" discipline outbound-http-detector.ts
        // already applies to an unresolvable outbound HTTP target. No
        // relationship is emitted, and (deliberately) no per-pair
        // IgnoredItem either — every root x every manifest-entry
        // non-match would otherwise flood the review queue with pairs that
        // were never actually candidates, unlike a k8s Deployment name
        // (always a real, root-scoped correlation candidate).
      }
    }
  }

  return { relationships };
}

function makeRelationship(from: string, to: string, mechanism: 'cross-repo-api-spec' | 'cross-repo-artifact' | 'cross-repo-service-catalogue'): TypedRelationship {
  return {
    from,
    to,
    kind: 'connects',
    crossPackage: true,
    source: 'repo-manifest',
    mechanism,
    status: PENDING_STATUS,
    id: PENDING_RELATIONSHIP_ID,
  };
}
