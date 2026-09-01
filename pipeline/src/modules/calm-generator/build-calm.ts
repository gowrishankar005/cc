import * as path from 'path';
import { TypedFacts } from '../../types/typed-facts';
import { CalmDocument } from '../../types/calm';
import { loadNodeTypeMapping, loadRelationshipTypeMapping, loadControlRequirementCatalogue } from '../../rules/construct-mapping-schema';
import { loadPersistenceDetectionCatalogue, driverImportProtocols } from '../../rules/persistence-detection-schema';
import { buildNodes } from './node-builder';
import { attachInterfaces } from './interface-builder';
import { buildRelationships } from './relationship-builder';
import { attachNodeMetadata, buildDocumentMetadata } from './metadata-builder';
import { attachControls } from './control-builder';
import { buildSystemNode } from './system-node-builder';
import { buildK8sNamespaceNodes } from './k8s-namespace-node-builder';
import { buildCrossRepoNodes } from './external-repo-node-builder';
import { attachPortInterfaces, springConfigProtocolBySignal } from './port-interface-builder';
import { EmissionCoverageGap } from './emission-coverage';

/**
 * typed-facts.json -> CALM 1.2. Thin orchestrator over catalogue-driven
 * builders (Solution Design v2 §5) — replaces the earlier single-file version
 * that hardcoded node-type casts and an isDbEdge ? connects : interacts
 * conditional (the confirmed-live schema bug, requirements v0.9 §1). Adding a
 * new unit kind or relationship shape is now a row in node-type-mapping.yml /
 * relationship-type-mapping.yml, not a change to this file or the builders.
 *
 * decorator-builder (deployment decorators, the last of the six builders
 * specified in Solution Design v2 §5.8) is still not wired in — the
 * k8s-manifest provider that would feed it doesn't exist in the pipeline yet.
 * Left out honestly rather than stubbed to look complete. control-builder
 * IS wired in (below) — real evidence, real catalogue, real code, not a stub.
 */
export function buildCalm(facts: TypedFacts, includeSystemNode = true, gaps: EmissionCoverageGap[] = []): CalmDocument {
  const rulesDir = path.join(__dirname, '..', '..', 'rules');
  const nodeTypeMapping = loadNodeTypeMapping(rulesDir);
  const relationshipTypeMapping = loadRelationshipTypeMapping(rulesDir);
  const controlRequirementCatalogue = loadControlRequirementCatalogue(rulesDir);
  const protocolBySignal = driverImportProtocols(loadPersistenceDetectionCatalogue(rulesDir));
  for (const [signal, protocol] of springConfigProtocolBySignal(facts.units)) protocolBySignal.set(signal, protocol);

  // 'unresolved' units (graded-fact-admission placeholders) used to be
  // filtered out here unconditionally; now catalogue-driven via
  // node-type-mapping.yml's own row for unitKind: unresolved, same as every
  // other kind. No special-case filtering left in this file.
  const units = facts.units;

  const nodes = buildNodes(units, nodeTypeMapping, gaps);
  // Synthetic k8s-namespace nodes, built BEFORE buildRelationships (unlike
  // system-node-builder's system node, which runs after): a 'deployed-in'
  // TypedRelationship's `to` must already be a real node id or
  // buildRelationships' own nodeIds.has(r.to) filter silently drops it.
  nodes.push(...buildK8sNamespaceNodes(facts.relationships));
  // Same reasoning: a repo-manifest-sourced relationship's endpoints are
  // synthetic (repo-root / external-contract), never a real TypedUnit, so
  // both must already exist as real node ids before buildRelationships' own
  // nodeIds.has(...) filter runs.
  nodes.push(...buildCrossRepoNodes(facts.relationships));
  attachInterfaces(units, nodes, nodeTypeMapping);
  attachPortInterfaces(units, nodes);
  attachControls(units, nodes, controlRequirementCatalogue, gaps);
  attachNodeMetadata(units, nodes, facts);

  const relationships = buildRelationships(facts.relationships, nodes, relationshipTypeMapping, units, protocolBySignal, gaps);

  // After every other node/relationship is built, so the system node's
  // composed-of lists the FINAL node set (including any that node-builder
  // skipped for lacking a mapping row).
  if (includeSystemNode) {
    const { systemNode, composedOfRelationship } = buildSystemNode(nodes);
    if (systemNode && composedOfRelationship) {
      nodes.push(systemNode);
      relationships.push(composedOfRelationship);
    }
  }

  return {
    nodes,
    relationships,
    metadata: buildDocumentMetadata(facts),
  };
}
