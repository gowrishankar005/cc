import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getOrBuildCodeqlDatabase } from './codeql-database-cache';

/**
 * T-LR-5 (AGENT_TASKS_Ext_CodeQL_Engine.md) — a second real structural
 * source, architecturally shaped like `codegraph-crossroot-provider.ts` (one combined,
 * whole-codebase analysis pass), not like `codegraph-provider.ts`'s
 * per-file `StructuralEngine` interface: CodeQL's DI-resolution query is a
 * single cross-file join over a whole compiled database, the same shape
 * Graphify's own "one combined pass across all package roots" already is —
 * forcing it into the per-file `extractDecoratorFacts(handle, root, file)`
 * contract would misrepresent what it actually does.
 *
 * Query: `src/rules/codeql-queries/di-resolution/di_resolution.ql` —
 * generic, no sample-repo class/package names (`OOS-sample-repo-detectors`
 * at full force), verified real at whole-codebase scale in
 * `E1b-codeql-di-resolution-experiment.md` (2106 real DI bindings on
 * Fineract, real ambiguity found and correctly refused).
 *
 * Deliberately opt-in only (`--codeql-source-root` + `--codeql-build-command`).
 * The pass is registered in DEFAULT_PASSES so grade/status still see any
 * facts it produces, but it is a no-op unless both flags are set — never a
 * default-on path. Building a CodeQL database requires a real, successful compile of the
 * target (a materially different, non-trivial cost from this pipeline's
 * normal buildless path — E1b measured ~65s build + ~50s database creation
 * for one real module), and the CodeQL CLI's free license does not permit
 * automated/CI use against a non-Open-Source codebase
 * (`soln/codeql-licensing-check-memo.md` durable summary,
 * `AGENT_TASKS_Ext_P0_Experiments.md`) — this pipeline's own CI cannot run
 * this provider at all under the free tier, so it must never be reachable
 * from a default/automatic path.
 *
 * Degrades exactly like `graphifyy`'s absence and `cdxgen`'s absence
 * already do elsewhere in this pipeline: missing binary, a failed build, or
 * a failed query run are all caught, logged as a warning, and return an
 * empty result — never a crash, never a partial/corrupt result treated as
 * real.
 */

// Checked in at src/rules/codeql-queries/di-resolution/ (copied to
// dist/rules/... at build time, same convention as every other .yml rule
// catalogue) — NOT soln/, which is entirely gitignored local scratch
// (found the hard way: this exact path pointed at soln/ during initial
// development and would have silently shipped a query file that doesn't
// exist in a fresh clone, degrading gracefully but uselessly for every
// real user).
const DI_RESOLUTION_QUERY = path.resolve(__dirname, '..', 'rules', 'codeql-queries', 'di-resolution', 'di_resolution.ql');

export interface CodeQLDiBinding {
  injectingClass: string;
  fieldName: string;
  interfaceType: string;
  resolvedImpl: string;
  mechanism: 'stereotype' | 'bean-factory';
  injectingFile: string;
  implFile: string;
}

/**
 * `buildTargetRoot` is the real, compilable root the build command runs
 * in — the query itself resolves across the WHOLE database, so a caller
 * scanning multiple `packageRoots` should pass the root whose build
 * transitively includes the others (the same "one combined pass" shape
 * Graphify's own multi-root call already assumes). `buildCommand` is never
 * defaulted or guessed — a wrong guess here would silently produce an
 * empty, source-less database (the exact real failure mode found building
 * this: an up-to-date/cached Gradle build never re-invokes `javac`, so
 * CodeQL's tracer observes nothing and the database looks "successful" but
 * captures zero source) rather than an honest error.
 */
export function runCodeQLDiResolution(sourceRoot: string, buildCommand: string, fallbackBuildCommand?: string): CodeQLDiBinding[] {
  if (!fs.existsSync(DI_RESOLUTION_QUERY)) {
    console.warn(`[codeql-di] WARNING: query file missing at ${DI_RESOLUTION_QUERY}, continuing without CodeQL DI-resolution evidence`);
    return [];
  }

  // T-onboarding-18b — shared across every CodeQL-based provider: builds
  // the real database at most once per (sourceRoot, buildCommand) per
  // process, regardless of how many mechanisms query it. See
  // codeql-database-cache.ts's own doc comment for the real bug this fixes
  // (a second independent `database create` against the same source could
  // silently return an empty extraction via Gradle's build cache).
  const dbPath = getOrBuildCodeqlDatabase(sourceRoot, buildCommand, fallbackBuildCommand);
  if (!dbPath) return []; // binary/build failure already warned by the shared cache

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weaver-codeql-di-out-'));
  const bqrsPath = path.join(workDir, 'out.bqrs');
  const csvPath = path.join(workDir, 'out.csv');

  try {
    execFileSync('codeql', ['query', 'run', '-d', dbPath, '-o', bqrsPath, '--', DI_RESOLUTION_QUERY], { stdio: 'pipe', timeout: 5 * 60 * 1000 });
    execFileSync('codeql', ['bqrs', 'decode', '--format=csv', '-o', csvPath, bqrsPath], { stdio: 'pipe' });
  } catch (err) {
    console.warn(`[codeql-di] WARNING: CodeQL query run/decode failed, continuing without CodeQL DI-resolution evidence: ${err}`);
    fs.rmSync(workDir, { recursive: true, force: true });
    return [];
  }

  const bindings = parseDiResolutionCsv(fs.readFileSync(csvPath, 'utf8'));
  fs.rmSync(workDir, { recursive: true, force: true });
  if (bindings.length === 0) {
    console.log('[codeql-di] query ran cleanly, 0 real DI bindings found (not a failure — see WARNING above if the database/query itself failed)');
  }
  return bindings;
}

/** Exported for direct testing without paying the real CodeQL build+query cost every time. */
export function parseDiResolutionCsv(csv: string): CodeQLDiBinding[] {
  const lines = csv.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return []; // header only, or empty — 0 real bindings, not an error
  const rows = lines.slice(1);
  const bindings: CodeQLDiBinding[] = [];
  for (const line of rows) {
    const cells = parseCsvLine(line);
    // di_resolution.ql's SELECT emits exactly 7 columns (injectingClass,
    // fieldName, interfaceType, resolvedImpl, mechanism, injectingFile,
    // implFile) — a real, checked-against-actual-output count, not assumed.
    if (cells.length !== 7) continue; // a malformed row is skipped, not fatal to the rest
    const [injectingClass, fieldName, interfaceType, resolvedImpl, mechanism, injectingFile, implFile] = cells;
    bindings.push({
      injectingClass,
      fieldName,
      interfaceType,
      resolvedImpl,
      mechanism: mechanism === 'bean-factory' ? 'bean-factory' : 'stereotype',
      injectingFile,
      implFile,
    });
  }
  return bindings;
}

function parseCsvLine(line: string): string[] {
  // CodeQL's own CSV decoder quotes every string field with double quotes
  // and escapes internal quotes by doubling them — a real, simple, fixed
  // shape (never arbitrary embedded commas outside quotes), not a general
  // RFC4180 parser.
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      cells.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  cells.push(current);
  return cells;
}
