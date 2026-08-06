import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

/**
 * T-X4-1 — static OpenAPI/Swagger discovery + parse. Deliberately NOT
 * annotation-driven (springdoc-style generated-at-build-time specs are a
 * named, honest gap — G-L1-13, `docs/solution/Extraction_Gaps_Mitigation_and_IR_Platform_Review.md`
 * §8.4 — not silently claimed covered). Scanner provider only: file
 * discovery + structural parse, no TypedFacts construction here (that's
 * analysis/openapi-pass.ts, per the task's own "Scanner provider ->
 * TypedFacts, not calm-only parse" integrity home).
 */
const OPENAPI_FILENAMES = ['openapi.yaml', 'openapi.yml', 'openapi.json', 'swagger.yaml', 'swagger.yml', 'swagger.json'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.codegraph', '.graphify-cache', 'graphify-out']);

export interface OpenApiOperation {
  path: string;
  method: string; // uppercase, e.g. "GET"
}

export interface OpenApiDocument {
  filePath: string; // relative to packageRoot
  title?: string;
  operations: OpenApiOperation[];
  securitySchemeNames: string[];
}

function findOpenApiFiles(packageRoot: string): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(path.join(dir, entry.name));
      } else if (OPENAPI_FILENAMES.includes(entry.name)) {
        results.push(path.join(dir, entry.name));
      }
    }
  };
  walk(packageRoot);
  return results;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

function parseOpenApiFile(absPath: string): { title?: string; paths?: Record<string, unknown>; securitySchemeNames: string[] } {
  const raw = fs.readFileSync(absPath, 'utf8');
  const doc = absPath.endsWith('.json') ? JSON.parse(raw) : parseYaml(raw);

  const title = doc?.info?.title;
  const paths = doc?.paths ?? {};
  // OpenAPI 3: components.securitySchemes; Swagger 2: securityDefinitions.
  const securitySchemes = doc?.components?.securitySchemes ?? doc?.securityDefinitions ?? {};
  const securitySchemeNames = Object.keys(securitySchemes);

  return { title, paths, securitySchemeNames };
}

/** Discovers and parses every OpenAPI/Swagger file under packageRoot. Empty array (not an error) when none exist — "run without file ok" per T-X4-1's own acceptance. */
export function discoverOpenApiDocuments(packageRoot: string): OpenApiDocument[] {
  return findOpenApiFiles(packageRoot).map((absPath) => {
    const relativeFilePath = path.relative(packageRoot, absPath);
    const { title, paths, securitySchemeNames } = parseOpenApiFile(absPath);
    const operations: OpenApiOperation[] = [];
    for (const [routePath, methods] of Object.entries(paths ?? {})) {
      if (typeof methods !== 'object' || methods === null) continue;
      for (const method of Object.keys(methods)) {
        if (HTTP_METHODS.includes(method.toLowerCase())) {
          operations.push({ path: routePath, method: method.toUpperCase() });
        }
      }
    }
    return { filePath: relativeFilePath, title, operations, securitySchemeNames };
  });
}
