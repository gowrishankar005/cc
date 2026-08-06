import * as fs from 'fs';
import * as path from 'path';

/**
 * requirements v0.6 §4: CodeGraph's detect() gate is root-relative and fails
 * silently. After indexing, verify non-zero route count for any package with
 * grep-verified route-annotation usage — never trust a single whole-run count.
 */
export interface DetectGateResult {
  packageRoot: string;
  grepVerifiedRouteUsageCount: number;
  nativeRouteCount: number;
  suspectedSilentFailure: boolean;
}

const ROUTE_PATTERNS: RegExp[] = [
  /@app\.route\s*\(/g, // Flask
  /@router\.(get|post|put|patch|delete)\s*\(/gi, // FastAPI
  /APIRouter\s*\(/g, // FastAPI
  /@(Get|Post|Put|Patch|Delete)\s*\(/g, // NestJS
  /@Controller\s*\(/g, // NestJS
];

function grepVerifiedRouteUsage(packageRoot: string, extensions: string[]): number {
  let count = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.codegraph' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        const content = fs.readFileSync(full, 'utf8');
        for (const pattern of ROUTE_PATTERNS) {
          const matches = content.match(pattern);
          if (matches) count += matches.length;
        }
      }
    }
  };
  walk(packageRoot);
  return count;
}

export function runDetectGateSmokeTest(
  packageRoot: string,
  nativeRouteCount: number,
  extensions: string[] = ['.py', '.ts']
): DetectGateResult {
  const grepCount = grepVerifiedRouteUsage(packageRoot, extensions);
  const suspectedSilentFailure = grepCount > 0 && nativeRouteCount === 0;
  if (suspectedSilentFailure) {
    // eslint-disable-next-line no-console
    console.warn(
      `[detect-gate-smoketest] WARNING: ${packageRoot} has ${grepCount} grep-verified route-annotation ` +
        `usage(s) but CodeGraph's native typing returned 0 route nodes. This matches the known ` +
        `detect()-gate silent-failure pattern (requirements v0.6 §4) — verify the indexed root is ` +
        `the exact package directory owning the manifest, not a parent.`
    );
  }
  return { packageRoot, grepVerifiedRouteUsageCount: grepCount, nativeRouteCount, suspectedSilentFailure };
}
