import * as fs from 'fs';

const JAVA_IMPORT_LINE = /^\s*import\s+(?:static\s+)?([\w.]+)\s*;/;

/**
 * T-R1-3 (Robustness Phase R1) — real finding, re-confirmed against real
 * a reference Java/JAX-RS banking platform source before writing this (`fineract-security/.../
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

  let lines = fileLineCache.get(absoluteFilePath);
  if (!lines) {
    try {
      lines = fs.readFileSync(absoluteFilePath, 'utf8').split('\n');
    } catch {
      return undefined; // file no longer readable at this path — degrade to "no match", not a crash
    }
    fileLineCache.set(absoluteFilePath, lines);
  }

  const text = lines[line - 1] ?? '';
  return JAVA_IMPORT_LINE.exec(text)?.[1];
}

/** True when `qualifiedImport` (e.g. "org.postgresql.core.Utils") is exactly a catalogue package name or a member of it — never a bare substring match (avoids "org.postgresql2.Foo" false-matching "org.postgresql"). */
export function javaImportMatchesPackage(qualifiedImport: string, packageName: string): boolean {
  return qualifiedImport === packageName || qualifiedImport.startsWith(packageName + '.');
}
