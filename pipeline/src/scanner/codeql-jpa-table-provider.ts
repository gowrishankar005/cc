import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getOrBuildCodeqlDatabase } from './codeql-database-cache';

/**
 * JPA entity -> real table name, corroboration-only. Distinct mechanism
 * shape from `codeql-di-provider.ts`/`codeql-command-dispatch-provider.ts`:
 * those RESOLVE new relationships/units between things this pipeline's own
 * extraction hadn't connected; this one only ENRICHES an evidence detail
 * (the real table name string) on a unit `signal-mapper.ts`'s existing
 * `jpa-entity`/`jpa-table` catalogue rows already correctly classified as
 * `database` — that classification is unaffected either way, this only adds
 * the table name @Table's own decorator-PRESENCE detection can't see (a
 * decorator fact carries the annotation name, never its string argument).
 *
 * Query: `src/rules/codeql-queries/jpa-entity-table/jpa_entity_table.ql` —
 * generic, no sample-repo class/package names, requires an EXPLICIT
 * `@Table(name=...)` and never infers JPA's implicit default table name.
 * Real result running against a reference Java/JAX-RS banking platform: 39 real bindings, 0 @Entity
 * classes lacking an explicit @Table in that codebase.
 *
 * Same opt-in/graceful-degradation contract as every other CodeQL-based
 * provider here: `--codeql-source-root`/`--codeql-build-command` (or
 * `--auto-codeql`), shares the one-database-per-(sourceRoot,buildCommand)
 * cache, never crashes on a missing binary/broken build/query failure.
 */

const JPA_TABLE_QUERY = path.resolve(__dirname, '..', 'rules', 'codeql-queries', 'jpa-entity-table', 'jpa_entity_table.ql');

export interface CodeQLJpaTableBinding {
  entityClass: string;
  tableName: string;
  file: string;
}

export function runCodeQLJpaTableResolution(sourceRoot: string, buildCommand: string, fallbackBuildCommand?: string): CodeQLJpaTableBinding[] {
  if (!fs.existsSync(JPA_TABLE_QUERY)) {
    console.warn(`[codeql-jpa-table] WARNING: query file missing at ${JPA_TABLE_QUERY}, continuing without CodeQL JPA table-name evidence`);
    return [];
  }

  const dbPath = getOrBuildCodeqlDatabase(sourceRoot, buildCommand, fallbackBuildCommand);
  if (!dbPath) return []; // binary/build failure already warned by the shared cache

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weaver-codeql-jpa-table-out-'));
  const bqrsPath = path.join(workDir, 'out.bqrs');
  const csvPath = path.join(workDir, 'out.csv');

  try {
    execFileSync('codeql', ['query', 'run', '-d', dbPath, '-o', bqrsPath, '--', JPA_TABLE_QUERY], { stdio: 'pipe', timeout: 5 * 60 * 1000 });
    execFileSync('codeql', ['bqrs', 'decode', '--format=csv', '-o', csvPath, bqrsPath], { stdio: 'pipe' });
  } catch (err) {
    console.warn(`[codeql-jpa-table] WARNING: CodeQL query run/decode failed, continuing without CodeQL JPA table-name evidence: ${err}`);
    fs.rmSync(workDir, { recursive: true, force: true });
    return [];
  }

  const bindings = parseJpaTableCsv(fs.readFileSync(csvPath, 'utf8'));
  fs.rmSync(workDir, { recursive: true, force: true });
  if (bindings.length === 0) {
    console.log('[codeql-jpa-table] query ran cleanly, 0 real JPA entity->table bindings found (not a failure — see WARNING above if the database/query itself failed)');
  }
  return bindings;
}

/** Exported for direct testing without paying the real CodeQL build+query cost every time. */
export function parseJpaTableCsv(csv: string): CodeQLJpaTableBinding[] {
  const lines = csv.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return []; // header only, or empty — 0 real bindings, not an error
  const rows = lines.slice(1);
  const bindings: CodeQLJpaTableBinding[] = [];
  for (const line of rows) {
    const cells = parseCsvLine(line);
    // jpa_entity_table.ql's SELECT emits exactly 3 columns (entityClass,
    // tableName, file) — a real, checked-against-actual-output count.
    if (cells.length !== 3) continue; // a malformed row is skipped, not fatal to the rest
    const [entityClass, tableName, file] = cells;
    if (!tableName.trim()) continue; // never a fact with an empty table name
    bindings.push({ entityClass, tableName, file });
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
