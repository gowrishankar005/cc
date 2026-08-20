import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

/**
 * T-MR-1 (`AGENT_TASKS_Ext_MultiRepo_Deployment.md`, BACKLOG.md "Cross-repo
 * relationship resolution") — a small, human-authored, checked-in file a
 * target repo's own maintainers declare at their repo's root, naming what
 * that repo publishes for another repo's pipeline run to join against.
 * **The pipeline never writes this file** — only reads it, and only ever
 * from a local directory a human has placed copies/symlinks of OTHER repos'
 * manifests into (`discoverRepoManifests`) for THIS run's own T-MR-2 join
 * pass to consume. Same "structured non-code file provider" mechanism class
 * as `k8s-manifest-provider.ts`/`openapi-provider.ts`/
 * `spring-config-provider.ts` — file discovery + structural parse only, no
 * TypedFacts construction here (that's `analysis/cross_package/cross-repo-join-detector.ts`).
 *
 * `nodeId` is documentation for humans/future joins, not something this
 * provider verifies: it's expected to be the value the PUBLISHING repo's
 * own pipeline run would compute as that unit's real `TypedUnit.id` (see
 * `typed-facts.ts`'s own doc comment on that field) when it scans itself,
 * but since the publishing repo isn't scanned by the CONSUMING run at all,
 * nothing here can confirm that — it flows through as an opaque label into
 * the synthetic external-contract node id
 * (`modules/calm-generator/external-repo-node-builder.ts`).
 */
export const REPO_MANIFEST_FILENAME = 'weaver-manifest.yml';

export interface ApiSpecIdentity {
  // Exact-string identity only — the OpenAPI/AsyncAPI document `title` field
  // this pipeline's own `scanner/openapi-provider.ts` already parses for any
  // root it scans. Never fuzzy-matched (Tier 1, "shared API-spec identity" —
  // the strongest tier precisely because it's an exact match, not a guess).
  title: string;
}

export interface ArtifactCoordinates {
  // A published package coordinate in whatever form the ecosystem's own
  // package manager uses — a Maven `purl` (pkg:maven/...), an npm
  // `name@version`, a PyPI `name==version`. Matched exactly against
  // `scanner/cdxgen-provider.ts`'s own `purl` (preferred) or `name@version`
  // fallback — see `cross-repo-join-detector.ts`'s `componentCoordinate`.
  coordinates: string;
}

export interface ServiceCatalogueIdentity {
  // Tier 3 — the weakest tier this mechanism resolves automatically,
  // because both fields are NAME strings, not an identity independently
  // verified by content (unlike apiSpec/artifact). Exact-string match only,
  // never substring/fuzzy — "never infer a cross-repo edge from naming
  // alone" (this task's own acceptance text) is honored by capping every
  // relationship this whole mechanism produces at `requires-review`
  // (status-assignment.ts), regardless of which tier resolved it.
  name?: string;
  dns?: string;
}

export interface PublishedContract {
  nodeId: string;
  name: string;
  apiSpec?: ApiSpecIdentity;
  artifact?: ArtifactCoordinates;
  serviceCatalogue?: ServiceCatalogueIdentity;
}

export interface RepoManifest {
  repo: string;
  publishes: PublishedContract[];
  sourceFile: string; // relative to the manifests directory, for provenance/error messages
}

function validatePublishedContract(entry: unknown, repo: string, index: number): PublishedContract {
  const e = entry as Record<string, unknown>;
  if (!e || typeof e.nodeId !== 'string' || typeof e.name !== 'string') {
    throw new Error(`repo manifest for "${repo}": publishes[${index}] must have string "nodeId" and "name"`);
  }
  const contract: PublishedContract = { nodeId: e.nodeId, name: e.name };
  if (e.apiSpec !== undefined) {
    const apiSpec = e.apiSpec as Record<string, unknown>;
    if (typeof apiSpec?.title !== 'string') throw new Error(`repo manifest for "${repo}": publishes[${index}].apiSpec.title must be a string`);
    contract.apiSpec = { title: apiSpec.title };
  }
  if (e.artifact !== undefined) {
    const artifact = e.artifact as Record<string, unknown>;
    if (typeof artifact?.coordinates !== 'string') throw new Error(`repo manifest for "${repo}": publishes[${index}].artifact.coordinates must be a string`);
    contract.artifact = { coordinates: artifact.coordinates };
  }
  if (e.serviceCatalogue !== undefined) {
    const sc = e.serviceCatalogue as Record<string, unknown>;
    if (sc.name !== undefined && typeof sc.name !== 'string') throw new Error(`repo manifest for "${repo}": publishes[${index}].serviceCatalogue.name must be a string`);
    if (sc.dns !== undefined && typeof sc.dns !== 'string') throw new Error(`repo manifest for "${repo}": publishes[${index}].serviceCatalogue.dns must be a string`);
    contract.serviceCatalogue = { name: sc.name as string | undefined, dns: sc.dns as string | undefined };
  }
  if (!contract.apiSpec && !contract.artifact && !contract.serviceCatalogue) {
    throw new Error(`repo manifest for "${repo}": publishes[${index}] ("${e.name}") declares no identity (apiSpec/artifact/serviceCatalogue) a join could ever resolve against — a manifest entry must carry at least one`);
  }
  return contract;
}

/** Throws on a malformed file — same "fail loudly on a human-authored file" discipline `loadSignalCatalogue` already uses, not a silent best-effort parse. */
export function loadRepoManifest(filePath: string, sourceFile: string): RepoManifest {
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = parseYaml(raw) as Record<string, unknown>;
  if (typeof doc?.repo !== 'string' || !Array.isArray(doc.publishes)) {
    throw new Error(`${filePath} is malformed: missing string "repo" or "publishes" array`);
  }
  return {
    repo: doc.repo,
    publishes: doc.publishes.map((entry, i) => validatePublishedContract(entry, doc.repo as string, i)),
    sourceFile,
  };
}

/**
 * Reads every other repo's manifest a human has placed directly inside
 * `manifestsDir` (not recursive — one file per target repo, e.g.
 * `payments-service.weaver-manifest.yml`, `orders-service.weaver-manifest.yml`).
 * Empty array (not an error) when the directory doesn't exist or holds no
 * manifest files — "run without it OK", same convention as
 * `discoverDeployments`/`discoverOpenApiDocuments`.
 */
export function discoverRepoManifests(manifestsDir: string): RepoManifest[] {
  if (!fs.existsSync(manifestsDir)) return [];
  const manifests: RepoManifest[] = [];
  for (const entry of fs.readdirSync(manifestsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.yaml') && !entry.name.endsWith('.yml')) continue;
    manifests.push(loadRepoManifest(path.join(manifestsDir, entry.name), entry.name));
  }
  return manifests;
}
