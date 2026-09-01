import { CalmNode, CalmRelationship } from '../../types/calm';

/**
 * One `system`-kind node per RUN (not per package root — attributing a
 * TypedUnit back to which root it came from would need a new field on
 * TypedUnit, a real contract change this optional, rule-based enrichment
 * doesn't warrant; per-run is the simpler, still-honest granularity),
 * `composed-of` every real architectural unit this run discovered — the
 * first non-flat, C4-like layering this pipeline has ever produced (every
 * prior run was a flat list of leaf service/database/topic nodes with no
 * composite boundary).
 *
 * The documented rule that keeps this from being a synthetic node with no
 * documented rule: emitted ONLY when
 * there are 2+ real nodes — a "system" containing exactly one node is
 * cosmetic noise, not a meaningful composite boundary. Disableable via
 * --no-system-node (run-slice.ts) since it's still opinionated output some
 * consumers may not want.
 */
const SYSTEM_NODE_ID = 'system';

export function buildSystemNode(nodes: CalmNode[]): { systemNode?: CalmNode; composedOfRelationship?: CalmRelationship } {
  if (nodes.length < 2) return {};

  const systemNode: CalmNode = {
    'unique-id': SYSTEM_NODE_ID,
    'node-type': 'system',
    name: 'system',
    description: `Composite system node — composed-of the ${nodes.length} architectural unit(s) this run discovered.`,
  };

  const composedOfRelationship: CalmRelationship = {
    'unique-id': `${SYSTEM_NODE_ID}--composed-of--all`,
    description: `system is composed-of every node this run discovered`,
    'relationship-type': { 'composed-of': { container: SYSTEM_NODE_ID, nodes: nodes.map((n) => n['unique-id']) } },
  };

  return { systemNode, composedOfRelationship };
}
