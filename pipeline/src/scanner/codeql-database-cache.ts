import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Real, found-the-hard-way fix (2026-08-22): when two independent CodeQL
 * passes (`codeql-di-pass.ts`, `codeql-command-dispatch-pass.ts`) each did
 * their OWN `codeql database create` against the identical
 * (sourceRoot, buildCommand), running BOTH in one `run-slice` invocation
 * silently produced an EMPTY second extraction — not a crash, not a
 * warning, just zero bindings. Root cause, confirmed against a real run
 * (Fineract, `gradle.properties` has `org.gradle.caching=true`):
 * `--rerun-tasks` only disables Gradle's up-to-date CHECK, not the
 * separate build CACHE — the second build's tasks could still restore
 * outputs from the cache (matching the first build's just-computed input
 * hashes) without ever re-invoking `javac`, so CodeQL's tracer (which only
 * observes real process execution) saw nothing.
 *
 * The real fix isn't defeating the cache — running the same multi-minute
 * build twice per invocation was already wasteful even when it worked.
 * This module makes "one real database per (sourceRoot, buildCommand) per
 * run" structural: every CodeQL-based provider calls `getOrBuildCodeqlDatabase`
 * instead of doing its own `database create`; the first real caller pays
 * the real build cost once, every subsequent caller (same key) reuses the
 * same database. A build/binary failure is cached too (as `null`), so a
 * missing `codeql` binary or a broken build only logs its WARNING once,
 * not once per mechanism.
 *
 * Lifetime: `run-slice` is a single-invocation CLI, not a long-lived
 * server — this cache is a plain module-level Map, cleaned up once via
 * `cleanupCodeqlDatabases()` after every pass that could use it has run
 * (`orchestration/run-slice.ts`), not per-call like the old per-provider
 * `fs.rmSync` did.
 */

interface CacheEntry {
  dbPath: string | undefined; // undefined = binary/build failure already logged for this key
}

const cache = new Map<string, CacheEntry>();
const workDirs: string[] = [];

function cacheKey(sourceRoot: string, buildCommand: string): string {
  return `${sourceRoot}::${buildCommand}`;
}

function codeqlBinaryAvailable(): boolean {
  try {
    execFileSync('codeql', ['version', '--format=terse'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a real CodeQL Java database path for (sourceRoot, buildCommand),
 * building it at most once per key per process. Returns `undefined` on any
 * real failure (missing binary, broken build) — same graceful-degradation
 * contract every CodeQL-based provider already has; callers treat
 * `undefined` exactly like the old per-provider "return []" path.
 */
export function getOrBuildCodeqlDatabase(sourceRoot: string, buildCommand: string): string | undefined {
  const key = cacheKey(sourceRoot, buildCommand);
  const cached = cache.get(key);
  if (cached) return cached.dbPath;

  if (!codeqlBinaryAvailable()) {
    console.warn('[codeql] WARNING: codeql CLI not found on PATH, continuing without any CodeQL evidence');
    cache.set(key, { dbPath: undefined });
    return undefined;
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weaver-codeql-db-'));
  workDirs.push(workDir);
  const dbPath = path.join(workDir, 'db');

  try {
    execFileSync('codeql', ['database', 'create', dbPath, '--language=java', `--source-root=${sourceRoot}`, `--command=${buildCommand}`], {
      stdio: 'pipe',
      timeout: 10 * 60 * 1000,
    });
  } catch (err) {
    console.warn(`[codeql] WARNING: CodeQL database creation failed (build likely broke, or produced no source-backed database), continuing without any CodeQL evidence: ${err}`);
    cache.set(key, { dbPath: undefined });
    return undefined;
  }

  cache.set(key, { dbPath });
  return dbPath;
}

/** Call once, after every pass that could have used the cache has run — deletes every real database this process built. */
export function cleanupCodeqlDatabases(): void {
  for (const dir of workDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  workDirs.length = 0;
  cache.clear();
}

/** Test-only escape hatch — the module-level cache would otherwise leak state between unrelated test cases. */
export function resetCodeqlDatabaseCacheForTests(): void {
  cache.clear();
  workDirs.length = 0;
}
