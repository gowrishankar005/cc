import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getOrBuildCodeqlDatabase } from './codeql-database-cache';

/**
 * The second real CodeQL capability this pipeline evaluated
 * (`E1-codeql-engine-evaluation.md`, 7 real edges on a reference
 * Java/JAX-RS banking platform) but didn't ship at the same time as the DI
 * resolution engine, which was scoped as the smaller safe first unit.
 * Architecturally identical to
 * `codeql-di-provider.ts` — a real, whole-codebase CodeQL query, not a
 * per-file `StructuralEngine` — deliberately duplicated in shape rather
 * than abstracted, since the two mechanisms' binding shapes (interface
 * resolution vs. a dispatcher/handler join) are different enough that a
 * shared abstraction would be premature (Simplicity First: two similar
 * files beat one generic one with no second real user yet).
 *
 * Query: `src/rules/codeql-queries/command-dispatch/command_dispatch.ql` —
 * generic, no sample-repo class/annotation names, re-verified real at
 * whole-codebase scale 2026-08-22 (408 real bindings on the whole
 * its own provider-module tree, including a genuine second real dispatch
 * convention, `InteropWrapperBuilder`, found unprompted — see the query's
 * own doc comment and `docs/solution/E1-codeql-engine-evaluation.md`).
 *
 * Same opt-in/degradation/license posture as `codeql-di-provider.ts` —
 * shares the SAME `--codeql-source-root`/`--codeql-build-command` flags
 * (both queries run against the same database when both mechanisms are
 * enabled; no separate flag pair needed).
 */

const COMMAND_DISPATCH_QUERY = path.resolve(__dirname, '..', 'rules', 'codeql-queries', 'command-dispatch', 'command_dispatch.ql');

export interface CodeQLDispatchBinding {
  dispatcherClass: string;
  dispatchMethod: string;
  handlerClass: string;
  dispatcherFile: string;
  handlerFile: string;
}

/**
 * Same real, non-trivial cost/degradation shape as `runCodeQLDiResolution`
 * — see that function's own doc comment. Shares its database with
 * `codeql-di-provider.ts` via `getOrBuildCodeqlDatabase` (T-onboarding-18b)
 * rather than building its own — see `codeql-database-cache.ts`'s doc
 * comment for the real silent-empty-extraction bug this fixes.
 */
export function runCodeQLCommandDispatchResolution(sourceRoot: string, buildCommand: string, fallbackBuildCommand?: string): CodeQLDispatchBinding[] {
  if (!fs.existsSync(COMMAND_DISPATCH_QUERY)) {
    console.warn(`[codeql-command-dispatch] WARNING: query file missing at ${COMMAND_DISPATCH_QUERY}, continuing without CodeQL command-dispatch evidence`);
    return [];
  }

  const dbPath = getOrBuildCodeqlDatabase(sourceRoot, buildCommand, fallbackBuildCommand);
  if (!dbPath) return []; // binary/build failure already warned by the shared cache

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weaver-codeql-dispatch-out-'));
  const bqrsPath = path.join(workDir, 'out.bqrs');
  const csvPath = path.join(workDir, 'out.csv');

  try {
    execFileSync('codeql', ['query', 'run', '-d', dbPath, '-o', bqrsPath, '--', COMMAND_DISPATCH_QUERY], { stdio: 'pipe', timeout: 5 * 60 * 1000 });
    execFileSync('codeql', ['bqrs', 'decode', '--format=csv', '-o', csvPath, bqrsPath], { stdio: 'pipe' });
  } catch (err) {
    console.warn(`[codeql-command-dispatch] WARNING: CodeQL query run/decode failed, continuing without CodeQL command-dispatch evidence: ${err}`);
    fs.rmSync(workDir, { recursive: true, force: true });
    return [];
  }

  const bindings = parseCommandDispatchCsv(fs.readFileSync(csvPath, 'utf8'));
  fs.rmSync(workDir, { recursive: true, force: true });
  if (bindings.length === 0) {
    console.log('[codeql-command-dispatch] query ran cleanly, 0 real dispatch bindings found (not a failure — see WARNING above if the database/query itself failed)');
  }
  return bindings;
}

/** Exported for direct testing without paying the real CodeQL build+query cost every time. */
export function parseCommandDispatchCsv(csv: string): CodeQLDispatchBinding[] {
  const lines = csv.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return []; // header only, or empty — 0 real bindings, not an error
  const rows = lines.slice(1);
  const bindings: CodeQLDispatchBinding[] = [];
  for (const line of rows) {
    const cells = parseCsvLine(line);
    // command_dispatch.ql's SELECT emits exactly 5 columns (dispatcherClass,
    // dispatchMethod, handlerClass, dispatcherFile, handlerFile) — a real,
    // checked-against-actual-output count, not assumed.
    if (cells.length !== 5) continue; // a malformed row is skipped, not fatal to the rest
    const [dispatcherClass, dispatchMethod, handlerClass, dispatcherFile, handlerFile] = cells;
    bindings.push({ dispatcherClass, dispatchMethod, handlerClass, dispatcherFile, handlerFile });
  }
  return bindings;
}

function parseCsvLine(line: string): string[] {
  // CodeQL's own CSV decoder quotes every string field with double quotes
  // and escapes internal quotes by doubling them — a real, simple, fixed
  // shape (never arbitrary embedded commas outside quotes), not a general
  // RFC4180 parser. Identical to codeql-di-provider.ts's own parser.
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
