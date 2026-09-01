import * as fs from 'fs';

const MAX_HEADER_LINES = 10; // bounded scan — real class headers (even multi-line, extends+implements split across lines) fit well within this; never scan the whole file

/**
 * Real finding that falsifies the decision doc's OWN proposed fix before it was ever
 * implemented: "require an inherits/extends edge, not just an import edge."
 * Verified directly against real a reference Node/NestJS wealth-management app source + a real Graphify
 * extraction: `class PrismaService extends PrismaClient` produces ZERO
 * `inherits` edge at all — Graphify's inherits detection only fires when the
 * base class resolves to a real IN-REPO node (confirmed: all 31 real
 * `inherits` edges in a reference Node/NestJS wealth-management app's own graph target real in-repo class ids;
 * none target an external `ref_*` package symbol). `PrismaClient` is
 * imported from `@prisma/client`, external — so even the ONE class that
 * genuinely owns the Prisma connection would produce zero database units
 * under an edge-based rule. Not a hypothetical edge case: this is the
 * actual real evidence case Q13 itself was grounded in.
 *
 * The real, working signal is textual, not graph-structural: read the class
 * declaration's own header (multi-line — real source has `class X`,
 * `extends Y`, `implements Z` on separate lines, confirmed via
 * `prisma.service.ts:13-16`) back from source, bounded to a small window
 * ending at the opening `{`, and check for `extends <baseClassName>`. Same
 * read-back technique already proven elsewhere (Java import-target
 * resolution, decorator/call-argument extraction) — applied
 * here to a different structural gap in the same underlying tool.
 */
export function classExtendsBaseClass(absoluteFilePath: string, classSourceLocation: string, baseClassName: string, fileLineCache: Map<string, string[]>): boolean {
  const startLine = parseInt(/^L(\d+)/.exec(classSourceLocation)?.[1] ?? '', 10);
  if (!startLine) return false;

  let lines = fileLineCache.get(absoluteFilePath);
  if (!lines) {
    try {
      lines = fs.readFileSync(absoluteFilePath, 'utf8').split('\n');
    } catch {
      return false; // file no longer readable at this path — degrade to "no match", not a crash
    }
    fileLineCache.set(absoluteFilePath, lines);
  }

  const headerLines: string[] = [];
  for (let i = startLine - 1; i < lines.length && headerLines.length < MAX_HEADER_LINES; i++) {
    const line = lines[i] ?? '';
    headerLines.push(line);
    if (line.includes('{')) break; // reached the class body — header is complete
  }

  const header = headerLines.join(' ');
  const extendsMatch = new RegExp(`\\bextends\\s+${baseClassName}\\b`).exec(header);
  return extendsMatch !== null;
}

/**
 * Composition-style ownership check, the counterpart to
 * classExtendsBaseClass for libraries whose real ownership idiom is a FIELD
 * holding the client, not inheritance (the AWS SDK's Dynamo clients are
 * never subclassed — a store class holds one as `private final DynamoDbClient
 * client = DynamoDbClient.builder().build();` in Java, or
 * `private client = new DynamoDBClient(...)` / a TS constructor-property
 * `constructor(private client: DynamoDBClient)` in Node). The same
 * import-vs-ownership ambiguity Q13 found for Prisma is real here too
 * (Claim_Register.md's U-persist-import counterexample: a handler that
 * imports DynamoDbClient purely to pass it through to a method parameter is
 * not its owner).
 *
 * Scanned across the class's own real source span (classSourceLocation to
 * endLine, both already computed by the caller from real method-line
 * evidence — not an arbitrary fixed window) rather than just the header,
 * since fields are declared in the class BODY, not the `class X {` line.
 *
 * Deliberately conservative, not full parsing: a TS/JS match requires an
 * explicit accessibility/readonly modifier (private/public/protected/
 * readonly) on the declaration — this is what distinguishes a real field or
 * constructor-property-shorthand param from a plain, unmarked method
 * parameter of the same type (the exact ambiguity this exists to resolve).
 * A Java match requires the WHOLE trimmed line to be a self-contained
 * declaration statement ending in `;`, with the type immediately followed
 * by an identifier — excludes method signatures (which always have `(`
 * before reaching `;`) but does NOT distinguish a class field from a local
 * variable declared inside a method body; a class that locally constructs
 * and uses the client within one of its own methods is still real
 * ownership evidence, not the false-positive shape this guards against, so
 * this is an accepted breadth, not a bug — see scope-limitations.yml's
 * dynamo-field-ownership-heuristic entry.
 */
export function classDeclaresFieldOfType(absoluteFilePath: string, classSourceLocation: string, endLine: number, typeName: string, fileLineCache: Map<string, string[]>): boolean {
  const startLine = parseInt(/^L(\d+)/.exec(classSourceLocation)?.[1] ?? '', 10);
  if (!startLine) return false;

  let lines = fileLineCache.get(absoluteFilePath);
  if (!lines) {
    try {
      lines = fs.readFileSync(absoluteFilePath, 'utf8').split('\n');
    } catch {
      return false; // file no longer readable at this path — degrade to "no match", not a crash
    }
    fileLineCache.set(absoluteFilePath, lines);
  }

  const bodyLines = lines.slice(startLine - 1, Math.min(endLine, lines.length));
  const escapedType = typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const tsAnnotatedField = new RegExp(`\\b(?:private|public|protected|readonly)\\s+\\w+\\s*:\\s*${escapedType}\\b`);
  const tsConstructedField = new RegExp(`\\b(?:private|public|protected|readonly)\\s+\\w+\\s*=\\s*new\\s+${escapedType}\\s*\\(`);
  const javaFieldStatement = new RegExp(`^\\s*(?:private|protected|public)?\\s*(?:static\\s+)?(?:final\\s+)?${escapedType}\\s+\\w+\\s*(?:=[^;]*)?;\\s*$`);

  return bodyLines.some((line) => tsAnnotatedField.test(line) || tsConstructedField.test(line) || javaFieldStatement.test(line));
}

/**
 * Real finding (BACKLOG.md "@Configuration classes mis-typed database via
 * driver-import evidence"): a
 * `@Configuration`/`@Bean`-wiring class referencing a driver-import library
 * only as a factory-method parameter type (never actually querying with it)
 * is architecturally never a table owner, regardless of which driver-import
 * library its `@Bean` signatures happen to reference — generalizes past
 * JDBC to any catalogued library (`AccountingJournalEntryConfiguration`,
 * the memo's own cited real example, confirmed via a fresh clone of a reference Java/JAX-RS banking platform:
 * `@Configuration` sits on the line immediately above the class
 * declaration, the provider module's own `starter/AccountingJournalEntryConfiguration.java:60-61`).
 *
 * Same read-back technique as `classExtendsBaseClass` above, but scans
 * BACKWARD from the class's own start line, not forward from it —
 * annotations sit above a class declaration, never inside its header.
 * Stops at the first non-blank, non-comment, non-annotation line (or the
 * window bound), so a genuinely unrelated PRECEDING class/method's closing
 * `}` can't be mistaken for this class's own annotations.
 */
export function classHasAnnotation(absoluteFilePath: string, classSourceLocation: string, annotationName: string, fileLineCache: Map<string, string[]>): boolean {
  const startLine = parseInt(/^L(\d+)/.exec(classSourceLocation)?.[1] ?? '', 10);
  if (!startLine) return false;

  let lines = fileLineCache.get(absoluteFilePath);
  if (!lines) {
    try {
      lines = fs.readFileSync(absoluteFilePath, 'utf8').split('\n');
    } catch {
      return false; // file no longer readable at this path — degrade to "no match", not a crash
    }
    fileLineCache.set(absoluteFilePath, lines);
  }

  // Real finding running this against a reference Java/JAX-RS banking platform: Graphify attributes a class
  // node's source_location to the LAST annotation line directly above the
  // class keyword when one is present, not to the `class X {` line itself
  // (confirmed: AccountingJournalEntryConfiguration.java's real class node
  // is 'L60', the `@Configuration` line — 'public class ...' is L61). So the
  // reported line itself might be an annotation, OR the bare class
  // declaration (whichever Graphify attributed it to) — checked first,
  // without breaking the scan either way, before walking further up for any
  // additional stacked annotations.
  const annotationPattern = new RegExp(`^@${annotationName}\\b`);
  const isSkippable = (line: string): boolean => line === '' || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*');

  for (let i = startLine - 1, scanned = 0; i >= 0 && scanned < MAX_HEADER_LINES; i--, scanned++) {
    const line = (lines[i] ?? '').trim();
    if (isSkippable(line)) continue; // blank/comment lines don't break the scan
    if (annotationPattern.test(line)) return true;
    if (line.startsWith('@')) continue; // a different stacked annotation — keep scanning upward
    if (i === startLine - 1) continue; // the reported line itself may legitimately be the bare class declaration, not an annotation — not a break condition
    break; // real code above the annotation block (a preceding class/method) — stop
  }
  return false;
}
