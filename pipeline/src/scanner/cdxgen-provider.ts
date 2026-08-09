import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * T-CDX-1/T-CDX-2 (B-cdxgen-reuse) — real, deterministic dependency-name
 * corroboration via `@cyclonedx/cdxgen` (OWASP, npm), shelled out the same
 * way `graphify-provider.ts` already shells out to Graphify — a structured
 * EXTERNAL TOOL OUTPUT provider, not a new mechanism class.
 *
 * Real findings from verifying the tool before writing this (see
 * `AGENT_TASKS_Cdxgen_Reuse.md` §0, not assumed from the reuse-check doc
 * alone): (1) the real npm package is `@cyclonedx/cdxgen` — bare `cdxgen`
 * is a 404 on the real registry, the source docs' informal name was wrong;
 * (2) `cdxgen` only produces real components when the target already has a
 * committed lockfile (`uv.lock`/`package-lock.json`/etc) — confirmed via a
 * real run against the reference Python app's `userservice` (75 real components from its real
 * `uv.lock`) vs. the checked-in NestJS fixture (0 components, no
 * lockfile — honest, not a bug); (3) `--no-install-deps` is ALWAYS passed —
 * cdxgen's own default installs real packages (npm/mvn/gradle) as a side
 * effect of generating an SBOM, a real, uncontrolled network/build-tool
 * side effect this project's determinism principle would never accept, even
 * for an optional corroboration lane.
 */
const CDXGEN_BIN = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'cdxgen');

export interface CdxgenComponent {
  name: string;
  version?: string;
  purl?: string;
}

/**
 * Manifest-based language-type inference, same convention as
 * `deployable-manifest-provider.ts`'s own root-level marker check — checked
 * AT packageRoot only (not recursive). Review finding (2026-08-09): `-t`
 * was originally treated as if it only accepted one value, picking the
 * first ecosystem found and silently ignoring the rest — but `cdxgen
 * --help` documents `-t, --type` as `[array]`, i.e. the tool itself
 * natively supports scanning more than one ecosystem in a single
 * invocation. A genuinely polyglot root (e.g. a Java service with a small
 * Node-based tooling `package.json` alongside its `pom.xml`) would
 * otherwise only ever get corroboration for whichever ecosystem happened
 * to be checked first. Fixed: returns EVERY matching type, not just the
 * first.
 */
function inferProjectTypes(packageRoot: string): string[] {
  const types: string[] = [];
  if (fs.existsSync(path.join(packageRoot, 'package.json'))) types.push('nodejs');
  if (
    fs.existsSync(path.join(packageRoot, 'requirements.txt')) ||
    fs.existsSync(path.join(packageRoot, 'pyproject.toml')) ||
    fs.existsSync(path.join(packageRoot, 'uv.lock')) ||
    fs.existsSync(path.join(packageRoot, 'Pipfile'))
  ) {
    types.push('python');
  }
  if (
    fs.existsSync(path.join(packageRoot, 'pom.xml')) ||
    fs.existsSync(path.join(packageRoot, 'build.gradle')) ||
    fs.existsSync(path.join(packageRoot, 'build.gradle.kts'))
  ) {
    types.push('java');
  }
  return types;
}

/**
 * Empty array (not an error) when no recognized manifest exists at
 * packageRoot, when cdxgen produces zero components (no lockfile — the
 * honest, common case, see the header comment), or when the `cdxgen` binary
 * itself is missing (real, disclosed limitation: this is an OPTIONAL
 * corroboration lane — a run must never fail because this devDependency
 * isn't installed in some environment) — same graceful-degradation
 * convention `detectPersistencePass`'s try/catch around the Graphify
 * subprocess already established.
 */
export function discoverCdxgenComponents(packageRoot: string): CdxgenComponent[] {
  const projectTypes = inferProjectTypes(packageRoot);
  if (projectTypes.length === 0) return [];
  if (!fs.existsSync(CDXGEN_BIN)) return [];

  const typeArgs = projectTypes.flatMap((t) => ['-t', t]);
  const outFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'weaver-cdxgen-')), 'bom.json');
  try {
    execFileSync(CDXGEN_BIN, [...typeArgs, '--no-install-deps', '-o', outFile, packageRoot], { stdio: 'pipe' });
    if (!fs.existsSync(outFile)) return [];
    const bom = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    const components: unknown[] = Array.isArray(bom?.components) ? bom.components : [];
    return components
      .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null && typeof (c as Record<string, unknown>).name === 'string')
      .map((c) => ({
        name: c.name as string,
        version: typeof c.version === 'string' ? c.version : undefined,
        purl: typeof c.purl === 'string' ? c.purl : undefined,
      }));
  } catch (err) {
    // Review finding (2026-08-09) — this used to swallow every shell-out
    // failure with zero logging, inconsistent with this codebase's own
    // established convention for optional-tool degradation
    // (detectPersistencePass's console.warn on a Graphify failure,
    // passes.ts). Still never fails a Weaver run (corroboration-only,
    // never load-bearing) — but now visible, not silent.
    console.warn(`[cdxgen-provider] WARNING: cdxgen failed for ${packageRoot}, continuing without dependency corroboration: ${err}`);
    return [];
  } finally {
    fs.rmSync(path.dirname(outFile), { recursive: true, force: true });
  }
}
