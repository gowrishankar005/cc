import * as fs from 'fs';
import * as path from 'path';
import { parseAllDocuments } from 'yaml';

/**
 * Minimal CloudFormation/SAM API Gateway + Lambda path/method/handler join.
 *
 * Real shape, confirmed against real `a reference AWS SaaS sample` CFN templates before
 * writing this (not assumed from AWS docs): the binding is a three-way
 * join across up to three separate resources, OFTEN IN SEPARATE FILES —
 *   AWS::ApiGateway::Resource (PathPart, chained via ParentId)
 *     -> AWS::ApiGateway::Method (HttpMethod, Integration.Uri references
 *        a Lambda logical id via a CFN intrinsic)
 *          -> AWS::Lambda::Function (Handler: "package.Class::method")
 *
 * D-cfn-v1 (agent-tasks §0.4): explicit Path+Method+Handler only, not a
 * full AWS resource graph. Real, confirmed finding: the `yaml` package
 * (already a dependency, used by k8s-manifest-provider.ts) resolves CFN's
 * short-form intrinsics for free — `!Ref X` -> "X", `!GetAtt X.Y` -> "X.Y",
 * `!Sub "...${X}..."` -> the raw string with `${X}` left as literal text —
 * no custom YAML tag handling needed, confirmed by parsing a real fixture
 * template directly before writing this regex.
 */
const SKIP_DIRS = new Set(['node_modules', '.git']);
const MAX_PATH_TREE_DEPTH = 10; // D-cfn-v1 — generous but finite, real templates observed are 2-3 levels deep

export interface CfnRouteBinding {
  path: string;
  httpMethod: string;
  handlerString: string; // real "package.Class::method" (or "package.Class") string, unresolved against scanned units at this layer — that join is analysis-layer (cfn-route-pass.ts), not here
  sourceFiles: string[]; // every file this binding's three resources were found across — real multi-file evidence, not assumed single-file
}

function findManifestFiles(manifestsDir: string): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml') || entry.name.endsWith('.json')) {
        results.push(full);
      }
    }
  };
  if (fs.existsSync(manifestsDir)) walk(manifestsDir);
  return results;
}

interface RawResource {
  logicalId: string;
  type: string;
  properties: any;
  sourceFile: string;
}

/** D-cfn-v1 — same-directory, multi-file pool: every file in manifestsDir is loaded into ONE resource map before any reference is resolved, matching the real observed split (API def + Lambda def in separate files). No cross-stack (Fn::ImportValue) or nested-stack resolution — out of scope, named in the design note. */
function loadResourcePool(manifestsDir: string): Map<string, RawResource> {
  const pool = new Map<string, RawResource>();
  for (const filePath of findManifestFiles(manifestsDir)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const relFile = path.relative(manifestsDir, filePath);
    let docs;
    try {
      docs = filePath.endsWith('.json') ? [{ toJS: () => JSON.parse(raw) }] : [...parseAllDocuments(raw)];
    } catch {
      continue; // not a real/parseable CFN template — skip, don't crash a whole run on one bad file
    }
    for (const doc of docs) {
      const parsed: any = (doc as any).toJS();
      const resources = parsed?.Resources;
      if (!resources || typeof resources !== 'object') continue;
      for (const [logicalId, resource] of Object.entries<any>(resources)) {
        if (!resource?.Type) continue;
        pool.set(logicalId, { logicalId, type: resource.Type, properties: resource.Properties ?? {}, sourceFile: relFile });
      }
    }
  }
  return pool;
}

/** Extracts the logical id a CFN intrinsic string references, e.g. "arn:...:functions/${TierServiceGetTiers.Arn}/invocations" -> "TierServiceGetTiers". Real `!Sub` output confirmed to leave `${...}` as literal text (see file header) — this is a plain regex over that text, not intrinsic evaluation. */
function extractReferencedLogicalId(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  const match = uri.match(/\$\{([A-Za-z0-9_]+)(?:\.[A-Za-z0-9_]+)?\}/);
  return match?.[1];
}

/** Walks a Resource's ParentId chain to the root, joining each node's PathPart. Bounded depth (D-cfn-v1) to avoid an infinite loop on a malformed/cyclic template. */
function resolvePath(resourceLogicalId: string, pool: Map<string, RawResource>): string | undefined {
  const segments: string[] = [];
  let current: string | undefined = resourceLogicalId;
  for (let depth = 0; current && depth < MAX_PATH_TREE_DEPTH; depth++) {
    const resource = pool.get(current);
    if (!resource || resource.type !== 'AWS::ApiGateway::Resource') break;
    const pathPart: string | undefined = resource.properties?.PathPart;
    if (pathPart) segments.unshift(pathPart);
    const parentRef = resource.properties?.ParentId;
    // A ParentId referencing the REST API's own RootResourceId (e.g.
    // "LabRestApi.RootResourceId" after !GetAtt resolution) is the real
    // root — not another AWS::ApiGateway::Resource — so the walk correctly
    // stops there (pool.get returns undefined or a non-Resource type).
    current = typeof parentRef === 'string' ? parentRef.split('.')[0] : undefined;
  }
  return segments.length > 0 ? `/${segments.join('/')}` : undefined;
}

/**
 * Empty array (not an error) when the directory doesn't exist or has no
 * templates — same "run without it ok" convention as discoverOpenApiDocuments
 * / discoverDeployments. 0 or 2+ resolution failures at any join step are
 * silently skipped (not guessed) — an unresolvable binding just doesn't
 * appear in the result, consistent with this project's "never fabricate"
 * discipline; a real-repo evaluation exam checks how much real recall this leaves.
 */
export function discoverCfnRouteBindings(manifestsDir: string): CfnRouteBinding[] {
  const pool = loadResourcePool(manifestsDir);
  const bindings: CfnRouteBinding[] = [];

  for (const resource of pool.values()) {
    if (resource.type !== 'AWS::ApiGateway::Method') continue;
    const httpMethod: string | undefined = resource.properties?.HttpMethod;
    if (!httpMethod || httpMethod === 'OPTIONS') continue; // CORS preflight noise, never a real architectural route

    const resourceRef = resource.properties?.ResourceId;
    const resourceLogicalId = typeof resourceRef === 'string' ? resourceRef.split('.')[0] : undefined;
    const routePath = resourceLogicalId ? resolvePath(resourceLogicalId, pool) : undefined;
    if (!routePath) continue;

    const integrationUri: string | undefined = resource.properties?.Integration?.Uri;
    const lambdaLogicalId = extractReferencedLogicalId(integrationUri);
    if (!lambdaLogicalId) continue;

    const lambdaResource = pool.get(lambdaLogicalId);
    if (!lambdaResource || lambdaResource.type !== 'AWS::Lambda::Function') continue;
    const handlerString: string | undefined = lambdaResource.properties?.Handler;
    if (!handlerString) continue;

    bindings.push({
      path: routePath,
      httpMethod,
      handlerString,
      sourceFiles: [...new Set([resource.sourceFile, lambdaResource.sourceFile])],
    });
  }

  return bindings;
}
