import * as fs from 'fs';
import * as path from 'path';
import { computeCommonAncestor } from './codegraph-crossroot-provider';

/**
 * `--auto-codeql` (opt-in flag, run-slice.ts) — derives `--codeql-source-root`
 * / `--codeql-build-command` from a real build file instead of requiring the
 * caller to hand-write both. Still requires the caller to pass the flag: this
 * pipeline's own CodeQL DI pass must never become reachable without an
 * explicit, conscious opt-in (the free CodeQL CLI license permits
 * automated/CI use only against an Open Source Codebase or under GHAS — see
 * `codeql-di-provider.ts`'s own doc comment and `Claim_Register.md`'s
 * `T-LR-5-codeql-di` row). `--auto-codeql` only removes the friction of
 * hand-deriving the two flag values; it does not change what "opt-in" means.
 *
 * Gradle root only auto-detected when a `gradlew` wrapper is present — a
 * system-installed `gradle` could be any version, silently producing a
 * different (or broken) build than the repo's own pinned wrapper; refusing
 * to guess here matches this pipeline's existing "never guess across an
 * unscanned boundary" discipline elsewhere. Same reasoning for Maven's
 * `mvnw`, with a plain `mvn` fallback since Maven has no daemon-reuse
 * failure mode of its own (verified during a real three-engine benchmark,
 * 2026-08-21 — Gradle's persistent daemon silently empties a CodeQL
 * database unless `--no-daemon` is passed; Maven wasn't affected).
 *
 * `--rerun-tasks`/`clean` are both required, not stylistic — an up-to-date
 * incremental build never re-invokes the compiler, so CodeQL's tracer
 * observes nothing and the database silently comes back empty (same real
 * failure mode documented in README.md's CodeQL section).
 */
export interface CodeqlAutoDetectResult {
  sourceRoot: string;
  buildCommand: string;
  buildTool: 'gradle' | 'maven';
  /**
   * Set only when Gradle is the primary `buildTool` AND a `pom.xml` also
   * exists at the same `sourceRoot` — real gap found 2026-08-21 running
   * `spring-petclinic` (checks in both build files): Gradle's toolchain
   * resolution failed there (`languageVersion=17` unmatched) while Maven,
   * against the identical source with the identical JDK, compiled cleanly.
   * `getOrBuildCodeqlDatabase` (`codeql-database-cache.ts`) only tries this
   * after the primary Gradle build genuinely fails, never speculatively.
   */
  fallbackBuildCommand?: string;
}

function mavenBuildCommand(sourceRoot: string): string {
  const mvnwName = process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw';
  const mvnwPath = path.join(sourceRoot, mvnwName);
  const mvnInvocation = fs.existsSync(mvnwPath) ? (process.platform === 'win32' ? mvnwName : `./${mvnwName}`) : 'mvn';
  return `${mvnInvocation} -q -DskipTests clean compile`;
}

export function detectCodeqlBuildConfig(packageRoots: string[]): CodeqlAutoDetectResult | undefined {
  const sourceRoot = packageRoots.length === 1 ? path.resolve(packageRoots[0]) : computeCommonAncestor(packageRoots);

  const hasMavenBuild = fs.existsSync(path.join(sourceRoot, 'pom.xml'));
  const hasGradleBuild = fs.existsSync(path.join(sourceRoot, 'build.gradle')) || fs.existsSync(path.join(sourceRoot, 'build.gradle.kts'));
  if (hasGradleBuild) {
    const gradlewName = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    const gradlewPath = path.join(sourceRoot, gradlewName);
    if (!fs.existsSync(gradlewPath)) {
      console.warn(`[codeql-auto-detect] found build.gradle at ${sourceRoot} but no ${gradlewName} wrapper — refusing to guess a system-wide gradle version, continuing without CodeQL DI-resolution evidence`);
      return undefined;
    }
    const gradlewInvocation = process.platform === 'win32' ? gradlewName : `./${gradlewName}`;
    return {
      sourceRoot,
      buildTool: 'gradle',
      buildCommand: `${gradlewInvocation} --no-daemon compileJava --rerun-tasks`,
      fallbackBuildCommand: hasMavenBuild ? mavenBuildCommand(sourceRoot) : undefined,
    };
  }

  if (hasMavenBuild) {
    return {
      sourceRoot,
      buildTool: 'maven',
      buildCommand: mavenBuildCommand(sourceRoot),
    };
  }

  return undefined;
}
