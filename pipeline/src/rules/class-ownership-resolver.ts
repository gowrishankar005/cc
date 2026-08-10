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
