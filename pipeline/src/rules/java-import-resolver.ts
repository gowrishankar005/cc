import * as fs from 'fs';

const JAVA_IMPORT_LINE = /^\s*import\s+(?:static\s+)?([\w.]+)\s*;/;
const JAVA_PACKAGE_LINE = /^\s*package\s+([\w.]+)\s*;/;

function readLines(absoluteFilePath: string, fileLineCache: Map<string, string[]>): string[] | undefined {
  let lines = fileLineCache.get(absoluteFilePath);
  if (!lines) {
    try {
      lines = fs.readFileSync(absoluteFilePath, 'utf8').split('\n');
    } catch {
      return undefined; // file no longer readable at this path — degrade to "no match", not a crash
    }
    fileLineCache.set(absoluteFilePath, lines);
  }
  return lines;
}

/**
 * Real finding, re-confirmed against real reference Java/JAX-RS banking
 * platform source before writing this (`the reference platform's security module/.../
 * SqlInjectionPreventerServiceImpl.java:26`, `import org.postgresql.core.Utils;`):
 * unlike Node/TS (deterministic `ref_<name>` transform, `graphify-import-target.ts`),
 * there is NO string transform that recovers a Java import's qualified
 * PACKAGE from Graphify's edge target — Graphify's Java `imports`-relation
 * edges target the bare, lowercased LAST SYMBOL only (`utils`, not
 * `org.postgresql` or `org.postgresql.core`), and that target is frequently
 * not even a real graph node (confirmed: `nodeById.get('utils')` is `null`
 * for this exact real edge) — a Set-membership fix keyed on the target id
 * would be a false-positive generator here (`Utils`/`Driver`/etc. are common
 * class names shared by unrelated packages), not a real fix.
 *
 * The qualified package IS still recoverable — it's in the source file, at
 * the edge's own `source_location`. Same read-back technique already proven
 * for decorator/call arguments (`codegraph-provider.ts`'s
 * `extractLiteralArgument`/`extractCallArgumentText`), applied here to a
 * Graphify edge instead of a CodeGraph `UnresolvedReference`.
 */
export function resolveJavaImportPackage(absoluteFilePath: string, sourceLocation: string, fileLineCache: Map<string, string[]>): string | undefined {
  const line = parseInt(/^L(\d+)/.exec(sourceLocation)?.[1] ?? '', 10);
  if (!line) return undefined;

  const lines = readLines(absoluteFilePath, fileLineCache);
  if (!lines) return undefined;

  const text = lines[line - 1] ?? '';
  return JAVA_IMPORT_LINE.exec(text)?.[1];
}

/** True when `qualifiedImport` (e.g. "org.postgresql.core.Utils") is exactly a catalogue package name or a member of it — never a bare substring match (avoids "org.postgresql2.Foo" false-matching "org.postgresql"). */
export function javaImportMatchesPackage(qualifiedImport: string, packageName: string): boolean {
  return qualifiedImport === packageName || qualifiedImport.startsWith(packageName + '.');
}

/**
 * B-stereotype-name-collision — Graphify resolves a bare identifier (e.g. an
 * `@Component` annotation's simple name) against ANY same-named class node
 * in the whole combined-extraction graph, ignoring what the class's own real
 * import statement actually names. Scans the WHOLE file (not one line, unlike
 * resolveJavaImportPackage above, which only reads the edge's own
 * source_location — no help here, since the annotation/reference site is
 * rarely the import line itself) for an import whose last dotted segment
 * equals `bareName`. Returns undefined when no such import exists — that's
 * the legitimate same-package-reference case (Java needs no import for a
 * class in the same package), and callers must treat undefined as "can't
 * disprove this edge, leave it alone."
 */
export function findJavaImportForBareName(absoluteFilePath: string, bareName: string, fileLineCache: Map<string, string[]>): string | undefined {
  const lines = readLines(absoluteFilePath, fileLineCache);
  if (!lines) return undefined;

  for (const line of lines) {
    const qualified = JAVA_IMPORT_LINE.exec(line)?.[1];
    if (qualified && qualified.split('.').pop() === bareName) return qualified;
  }
  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Real, second finding (a reference Java/JAX-RS banking platform's security
 * module, `TwoFactorConfigurationApiResource.java` -> `SpringSecurityPlatformSecurityContext.java`):
 * a resolved destination's bare name can differ from anything literally
 * written in the source file when the edge came from a legitimate mechanism
 * other than a direct same-name reference — e.g. dependency-injection /
 * interface-implementation resolution, where the source only ever names the
 * INTERFACE (`PlatformSecurityContext`) and CodeGraph correctly resolves it
 * to its sole same-package implementation. The same-package-mismatch check
 * (`_bareNameCollisionCore`'s no-import branch) must not fire in that case —
 * it has no evidence of the specific bug it exists to catch (a bare
 * identifier resolved to an unrelated same-named class), because the
 * destination's own bare name never appears in the source text at all.
 * Gate that branch on this: the destination bare name must be literally
 * present as a whole word somewhere in the source file before treating a
 * package mismatch as a real collision.
 */
export function javaFileReferencesBareName(absoluteFilePath: string, bareName: string, fileLineCache: Map<string, string[]>): boolean {
  const lines = readLines(absoluteFilePath, fileLineCache);
  if (!lines) return false;

  const pattern = new RegExp(`\\b${escapeRegExp(bareName)}\\b`);
  return lines.some((line) => pattern.test(line));
}

/** Reads a Java file's own `package X;` declaration (real ground truth for what package a class actually belongs to, independent of directory layout). Undefined for an unreadable file or the default/unnamed package. */
export function getJavaPackageDeclaration(absoluteFilePath: string, fileLineCache: Map<string, string[]>): string | undefined {
  const lines = readLines(absoluteFilePath, fileLineCache);
  if (!lines) return undefined;

  for (const line of lines) {
    const pkg = JAVA_PACKAGE_LINE.exec(line)?.[1];
    if (pkg) return pkg;
  }
  return undefined;
}
