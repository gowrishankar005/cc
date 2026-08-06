import { GraphifyGraph } from '../../scanner/graphify-provider';
import { TypedUnit } from '../../types/typed-facts';

/**
 * Real gap found by auditing pipeline output against Bank of Anthos source
 * (userservice/db.py, contacts/db.py): CodeGraph gives no persistence signal
 * at all (confirmed repeatedly across this project — Java JPA and now Python
 * SQLAlchemy). Graphify's raw `imports_from` edges already carry this signal
 * for free — no new extraction engine needed, just reading what's already
 * there instead of discarding it in the cross-package-only reconciler.
 *
 * Detects: a file that imports a known persistence library, then the
 * class Graphify says that file `contains` (e.g. db.py -contains-> UserDb).
 * That class + its methods become a `database`-kind TypedUnit, spanning
 * from the class's own line to its last known member's line.
 */
// Python entries verified against real Bank of Anthos code (both db.py files
// import sqlalchemy). Node/TS entries added for Slice 1 completeness — a
// language explicitly in scope per requirements v0.6 §1.5 — but UNVERIFIED:
// no real Node/TS package with a persistence layer has been run through
// this pipeline yet. Don't treat these as confirmed the way the Python
// entries are; re-check Graphify's actual import-target naming for
// TypeORM/Prisma/Mongoose before relying on them.
const PERSISTENCE_LIBRARIES = new Set([
  // Python — verified
  'sqlalchemy',
  'psycopg2',
  'pymongo',
  'redis',
  'sqlite3',
  'mysql',
  'mysqlclient',
  'pymysql',
  // Node/TS — unverified, added for scope completeness only
  'typeorm',
  'prisma',
  '@prisma/client',
  'mongoose',
  'sequelize',
  'pg',
  'mysql2',
  'ioredis',
]);

export function detectPersistenceUnits(root: string, graph: GraphifyGraph): TypedUnit[] {
  const units: TypedUnit[] = [];

  const persistenceFiles = new Set(
    graph.edges
      .filter((e) => (e.relation === 'imports_from' || e.relation === 'imports') && PERSISTENCE_LIBRARIES.has(e.target))
      .map((e) => e.source_file)
  );

  for (const file of persistenceFiles) {
    // Find the class this file `contains` (db.py -contains-> db_userdb).
    const fileNodeId = graph.nodes.find((n) => n.source_file === file && n.source_location === 'L1')?.id;
    if (!fileNodeId) continue;

    const containsEdges = graph.edges.filter((e) => e.source === fileNodeId && e.relation === 'contains');
    for (const containsEdge of containsEdges) {
      const classNode = graph.nodes.find((n) => n.id === containsEdge.target);
      if (!classNode) continue;

      // Span: class's own line through its furthest member's line (method edges).
      const memberEdges = graph.edges.filter((e) => e.source === classNode.id && e.relation === 'method');
      const memberLines = memberEdges
        .map((e) => graph.nodes.find((n) => n.id === e.target))
        .map((n) => (n ? parseInt(/^L(\d+)/.exec(n.source_location)?.[1] ?? '0', 10) : 0));
      const classLine = parseInt(/^L(\d+)/.exec(classNode.source_location)?.[1] ?? '0', 10);
      const endLine = memberLines.length > 0 ? Math.max(classLine, ...memberLines) : classLine;

      const persistenceLib = [...persistenceFiles]
        .map(() => graph.edges.find((e) => e.source === fileNodeId && PERSISTENCE_LIBRARIES.has(e.target)))
        .find((e) => e)?.target;

      units.push({
        id: `${file}::${classNode.label}`,
        kind: 'database',
        name: classNode.label,
        filePath: file,
        startLine: classLine,
        endLine,
        evidence: [
          {
            signal: persistenceLib ?? 'unknown-persistence-lib',
            source: 'graphify-import',
            category: 'persistence',
            weight: 20, // persistence signal weight, Gap_Closure_Build_Ready_Specs_v0.1.md §7
            ref: `${file}:${classLine}`,
          },
        ],
        confidence: 20,
      });
    }
  }

  return units;
}
