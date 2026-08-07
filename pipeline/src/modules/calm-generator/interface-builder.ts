import { Evidence, TypedUnit } from '../../types/typed-facts';
import { CalmNode, CalmInterface } from '../../types/calm';
import { NodeTypeMapping, findNodeTypeMapping } from '../../rules/construct-mapping-schema';

/**
 * Attaches interfaces to already-built nodes (mutates in place), catalogue-driven
 * (Solution Design v2 §5.2) rather than the earlier hardcoded
 * `category === 'http-entry-point'` literal check. Which evidence categories
 * become interfaces is a node-type-mapping.yml property now, not code.
 *
 * T-X4-2 (AGENT_TASKS_Extraction_Enrichment.md, G-L3-08) — generalizes the
 * original binary "native-route beats decorator" check (found via the
 * NestJS fixture: native route typing AND the extractFromSource() decorator
 * fallback both firing for the same routes, producing a redundant,
 * lower-quality duplicate interface) into a real authority-tier table, now
 * that a genuine third source exists (openapi, T-X4-1) — this IS the
 * Contract_Evolution_Policy.md §3 reopen trigger firing, done as the policy
 * itself specified: "at that point there will be a real second data point
 * to design the tiers against, not a guess." Lower number wins; only the
 * lowest tier PRESENT on a unit contributes interfaces, deduped by signal
 * within that tier (two evidence entries for "GET /users" from the same
 * source still produce one interface).
 */
const SOURCE_PRECEDENCE: Record<Evidence['source'], number> = {
  'native-route': 0,
  openapi: 1,
  decorator: 2,
  'graphify-import': 3, // never actually contributes interfaces today (no node-type-mapping row lists persistence/graphify-import under interfaceCategories) — ordered last for completeness, not because it's been exercised
  call: 4, // AREC T-D1 — security-control category only, never interface-building; ordered last for the same reason as graphify-import (completeness, not exercised)
  'field-type': 5, // AREC T-E1 — messaging category only, never interface-building; ordered last for the same reason
  extends: 6, // AREC T-E3 — persistence category only, never interface-building; ordered last for the same reason
};

export function attachInterfaces(units: TypedUnit[], nodes: CalmNode[], mapping: NodeTypeMapping): void {
  const nodesById = new Map(nodes.map((n) => [n['unique-id'], n]));

  for (const unit of units) {
    const node = nodesById.get(unit.id);
    if (!node) continue;
    const rule = findNodeTypeMapping(mapping, unit.kind);
    if (!rule) continue;

    const interfaceCandidates = unit.evidence.filter((e) => rule.interfaceCategories.includes(e.category));
    if (interfaceCandidates.length === 0) continue;

    const bestTier = Math.min(...interfaceCandidates.map((e) => SOURCE_PRECEDENCE[e.source]));
    const winningEvidence = interfaceCandidates.filter((e) => SOURCE_PRECEDENCE[e.source] === bestTier);

    const seenSignals = new Set<string>();
    const interfaces: CalmInterface[] = [];
    for (const e of winningEvidence) {
      if (seenSignals.has(e.signal)) continue; // dedupe within the winning tier — same METHOD+path from two evidence entries is one interface
      seenSignals.add(e.signal);
      interfaces.push({
        'unique-id': `${unit.id}::iface-${interfaces.length}`,
        type: 'path-interface' as const,
        path: e.signal,
      });
    }

    if (interfaces.length > 0) {
      node.interfaces = interfaces;
    }
  }
}
