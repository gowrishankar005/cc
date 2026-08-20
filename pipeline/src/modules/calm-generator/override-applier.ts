import * as fs from 'fs';
import * as path from 'path';
import { CalmDocument, CalmNode, CalmNodeType, CalmRelationship, CalmMetadataEntry } from '../../types/calm';
import { DecisionRecord, Override, OverrideApplicationResult } from '../../types/overrides';

/**
 * T-FS-6 — the only place `x-aac-status: 'reviewed'` is ever set (see
 * TypedUnit.status/TypedRelationship.status's own doc comment in
 * typed-facts.ts: Analysis never writes 'reviewed', only override-applier.ts
 * does, on the element an ACTIVE Override actually touched). Replaces any
 * existing x-aac-status entry (assignStatusPass's own analysis-time value)
 * rather than appending a second one — a human confirmation supersedes the
 * deterministic default, it doesn't sit alongside it.
 */
function withReviewedStatus(metadata: CalmMetadataEntry[]): CalmMetadataEntry[] {
  return [...metadata.filter((m) => m.key !== 'x-aac-status'), { key: 'x-aac-status', value: 'reviewed' }];
}

/** T-X6-2 — records a "target not found" rejection as BOTH a rejection (existing behavior, unchanged) and an orphan (new, dedicated classification) — see OverrideApplicationResult.orphans' own doc comment for why these are reported separately from other rejection causes. */
function reportOrphan(result: OverrideApplicationResult, override: Override, reason: string): void {
  result.rejected.push({ override_id: override.override_id, reason });
  result.orphans.push({ override_id: override.override_id, override_type: override.override_type, target_ref: override.target_ref, reason });
}

/**
 * Reads an overrides/ directory: any .json file is inspected and dispatched
 * by which unique key it carries (decision_id vs override_id) rather than a
 * strict naming convention — simple, and tolerant of either
 * `<id>.decision.json`/`<id>.override.json` or any other naming a human
 * or the future LLM advisory layer (Solution Design v2 §7.1) chooses to
 * write.
 */
function loadOverridesDir(dir: string): { decisions: Map<string, DecisionRecord>; overrides: Override[] } {
  const decisions = new Map<string, DecisionRecord>();
  const overrides: Override[] = [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`overrides directory: ${file} is not valid JSON: ${e}`);
    }
    if (parsed.decision_id) {
      decisions.set(parsed.decision_id, parsed as DecisionRecord);
    } else if (parsed.override_id) {
      overrides.push(parsed as Override);
    } else {
      throw new Error(`overrides directory: ${file} has neither decision_id nor override_id — not a recognized Decision Record or Override`);
    }
  }

  return { decisions, overrides };
}

function isValidCalmNode(value: unknown): value is CalmNode {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['unique-id'] === 'string' && typeof v['node-type'] === 'string' && typeof v['name'] === 'string' && typeof v['description'] === 'string';
}

/**
 * T-X6-1 — "connects shape validated" per the task's own acceptance
 * criterion: relationship_add only accepts the `connects` relationship-type
 * shape, the only one this pipeline emits from the deterministic core today
 * (v0.9 §1's interacts/connects fix). A future override supporting
 * interacts/deployed-in/composed-of would need this extended deliberately,
 * not silently — same "don't build ahead of a real need" discipline as
 * node_remove's already-existing four-shape cleanup logic below.
 */
/**
 * T-MR-5 — `boundary_change`'s own new_value shape: which `composed-of`
 * CONTAINER node the target node should belong to now (`container: null`
 * moves it out of every boundary it's currently in, without placing it in a
 * new one — an honest "no boundary" outcome, not a silently-refused case).
 * Not exported: same convention as relationship_add's own inline
 * isValidConnectsRelationship — this override type's new_value shape isn't
 * part of the module boundary, only this file's own validation.
 */
interface BoundaryChangeValue {
  container: string | null;
}

function isValidBoundaryChange(value: unknown): value is BoundaryChangeValue {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.container === null || typeof v.container === 'string';
}

function composedOfShape(rel: CalmRelationship): { container: string; nodes: string[] } | undefined {
  return (rel['relationship-type'] as unknown as Record<string, unknown>)['composed-of'] as { container: string; nodes: string[] } | undefined;
}

function isValidConnectsRelationship(value: unknown): value is CalmRelationship {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v['unique-id'] !== 'string' || typeof v['description'] !== 'string') return false;
  const rt = v['relationship-type'];
  if (typeof rt !== 'object' || rt === null) return false;
  const connects = (rt as Record<string, unknown>)['connects'];
  if (typeof connects !== 'object' || connects === null) return false;
  const c = connects as Record<string, unknown>;
  const source = c['source'] as Record<string, unknown> | undefined;
  const destination = c['destination'] as Record<string, unknown> | undefined;
  return typeof source?.['node'] === 'string' && typeof destination?.['node'] === 'string';
}

/**
 * Applies ACTIVE overrides to an already-deterministically-built CalmDocument
 * — the final pass, per Solution Design v2 §5.4. Mechanically enforces the
 * "no override without a traceable decision" integrity rule: an Override whose
 * decision_record_ref doesn't resolve to a real, ACTIVE Decision Record in
 * the same directory is rejected, not applied and not silently dropped —
 * every rejection is reported so a run doesn't silently ignore a
 * misconfigured correction.
 *
 * Supports node_add / type_change / node_remove / node_rename /
 * relationship_add / relationship_remove — the hard predecessor for
 * human-in-the-loop-completed edges; those mitigations were false claims
 * until this shipped. `boundary_change` (T-MR-5) reassigns which
 * `composed-of` container node a target node belongs to — the first override
 * type to touch the `composed-of` relationship shape (relationship_add stays
 * `connects`-only, per isValidConnectsRelationship's own doc comment); moves
 * the target out of any boundary it's currently in and into `new_value.container`
 * (or out of every boundary entirely when `container` is explicitly `null`).
 */
export function applyOverrides(calm: CalmDocument, overridesDir: string): { calm: CalmDocument; result: OverrideApplicationResult } {
  const result: OverrideApplicationResult = { applied: [], rejected: [], skipped: [], orphans: [] };

  if (!fs.existsSync(overridesDir)) {
    return { calm, result };
  }

  const { decisions, overrides } = loadOverridesDir(overridesDir);

  // Work on copies so a partially-applied run never mutates the caller's
  // deterministic CalmDocument in place if something downstream throws.
  const nodes = [...calm.nodes];
  const relationships = [...calm.relationships];

  for (const override of overrides) {
    if (override.status !== 'active') {
      result.skipped.push({ override_id: override.override_id, override_type: override.override_type, reason: 'override status is not active' });
      continue;
    }

    const decision = decisions.get(override.decision_record_ref);
    if (!decision) {
      result.rejected.push({ override_id: override.override_id, reason: `decision_record_ref "${override.decision_record_ref}" does not resolve to any Decision Record in ${overridesDir}` });
      continue;
    }
    if (decision.status !== 'active') {
      result.rejected.push({ override_id: override.override_id, reason: `decision_record_ref "${override.decision_record_ref}" resolves to a Decision Record with status "${decision.status}", not "active"` });
      continue;
    }

    switch (override.override_type) {
      case 'node_add': {
        if (!isValidCalmNode(override.new_value)) {
          result.rejected.push({ override_id: override.override_id, reason: 'node_add new_value is not a valid CalmNode shape (needs unique-id, node-type, name, description)' });
          break;
        }
        const newNode = override.new_value as CalmNode;
        if (newNode['unique-id'] !== override.target_ref) {
          result.rejected.push({ override_id: override.override_id, reason: `node_add target_ref "${override.target_ref}" does not match new_value's unique-id "${newNode['unique-id']}"` });
          break;
        }
        if (nodes.some((n) => n['unique-id'] === newNode['unique-id'])) {
          result.rejected.push({ override_id: override.override_id, reason: `node_add target_ref "${override.target_ref}" already exists — use type_change/node_rename to modify an existing node, not node_add` });
          break;
        }
        nodes.push({
          ...newNode,
          metadata: withReviewedStatus([...(newNode.metadata ?? []), { key: 'x-aac-override-provenance', value: override.decision_record_ref }]),
        });
        result.applied.push({ override_id: override.override_id, override_type: override.override_type, target_ref: override.target_ref });
        break;
      }

      case 'type_change': {
        const idx = nodes.findIndex((n) => n['unique-id'] === override.target_ref);
        if (idx === -1) {
          reportOrphan(result, override, `type_change target_ref "${override.target_ref}" not found among nodes`);
          break;
        }
        if (typeof override.new_value !== 'string') {
          result.rejected.push({ override_id: override.override_id, reason: 'type_change new_value must be a node-type string' });
          break;
        }
        const existing = nodes[idx];
        nodes[idx] = {
          ...existing,
          'node-type': override.new_value as CalmNodeType,
          metadata: withReviewedStatus([...(existing.metadata ?? []), { key: 'x-aac-override-provenance', value: override.decision_record_ref }]),
        };
        result.applied.push({ override_id: override.override_id, override_type: override.override_type, target_ref: override.target_ref });
        break;
      }

      case 'node_rename': {
        const idx = nodes.findIndex((n) => n['unique-id'] === override.target_ref);
        if (idx === -1) {
          reportOrphan(result, override, `node_rename target_ref "${override.target_ref}" not found among nodes`);
          break;
        }
        if (typeof override.new_value !== 'string') {
          result.rejected.push({ override_id: override.override_id, reason: 'node_rename new_value must be a name string' });
          break;
        }
        const existing = nodes[idx];
        nodes[idx] = {
          ...existing,
          name: override.new_value as string,
          metadata: withReviewedStatus([...(existing.metadata ?? []), { key: 'x-aac-override-provenance', value: override.decision_record_ref }]),
        };
        result.applied.push({ override_id: override.override_id, override_type: override.override_type, target_ref: override.target_ref });
        break;
      }

      case 'node_remove': {
        const idx = nodes.findIndex((n) => n['unique-id'] === override.target_ref);
        if (idx === -1) {
          reportOrphan(result, override, `node_remove target_ref "${override.target_ref}" not found among nodes`);
          break;
        }
        nodes.splice(idx, 1);
        // Removing a node without also removing relationships that reference
        // it would produce a CALM document with a dangling relationship
        // endpoint — calm validate would (correctly) flag that as broken, so
        // this is cleaned up here rather than left for the next run to
        // discover. Checks all four relationship-type shapes (connects'
        // source/destination, interacts' actor/nodes[], deployed-in/
        // composed-of's container/nodes[]) — not just `connects`, even
        // though that's the only shape this pipeline currently emits (§5.3's
        // interacts/connects fix), since the type system already supports
        // all four and this should stay correct once actor-node detection
        // or k8s deployed-in relationships land.
        for (let i = relationships.length - 1; i >= 0; i--) {
          const rt = relationships[i]['relationship-type'] as unknown as Record<string, unknown>;
          const touchesRemoved = Object.values(rt).some((v) => {
            if (typeof v !== 'object' || v === null) return false;
            const shape = v as { source?: { node: string }; destination?: { node: string }; actor?: string; container?: string; nodes?: string[] };
            return (
              shape.source?.node === override.target_ref ||
              shape.destination?.node === override.target_ref ||
              shape.actor === override.target_ref ||
              shape.container === override.target_ref ||
              (shape.nodes ?? []).includes(override.target_ref)
            );
          });
          if (touchesRemoved) relationships.splice(i, 1);
        }
        result.applied.push({ override_id: override.override_id, override_type: override.override_type, target_ref: override.target_ref });
        break;
      }

      case 'relationship_add': {
        if (!isValidConnectsRelationship(override.new_value)) {
          result.rejected.push({ override_id: override.override_id, reason: 'relationship_add new_value is not a valid connects-shaped CalmRelationship (needs unique-id, description, relationship-type.connects.source.node, relationship-type.connects.destination.node)' });
          break;
        }
        const newRel = override.new_value as CalmRelationship;
        if (newRel['unique-id'] !== override.target_ref) {
          result.rejected.push({ override_id: override.override_id, reason: `relationship_add target_ref "${override.target_ref}" does not match new_value's unique-id "${newRel['unique-id']}"` });
          break;
        }
        if (relationships.some((r) => r['unique-id'] === newRel['unique-id'])) {
          result.rejected.push({ override_id: override.override_id, reason: `relationship_add target_ref "${override.target_ref}" already exists — use relationship_remove first if replacing it` });
          break;
        }
        const connects = (newRel['relationship-type'] as unknown as { connects: { source: { node: string }; destination: { node: string } } }).connects;
        const missingEndpoint = [connects.source.node, connects.destination.node].find((id) => !nodes.some((n) => n['unique-id'] === id));
        if (missingEndpoint) {
          reportOrphan(result, override, `relationship_add references node "${missingEndpoint}" which does not exist — would create a dangling relationship endpoint`);
          break;
        }
        relationships.push({
          ...newRel,
          metadata: withReviewedStatus([...(newRel.metadata ?? []), { key: 'x-aac-override-provenance', value: override.decision_record_ref }]),
        });
        result.applied.push({ override_id: override.override_id, override_type: override.override_type, target_ref: override.target_ref });
        break;
      }

      case 'relationship_remove': {
        const idx = relationships.findIndex((r) => r['unique-id'] === override.target_ref);
        if (idx === -1) {
          reportOrphan(result, override, `relationship_remove target_ref "${override.target_ref}" not found among relationships`);
          break;
        }
        relationships.splice(idx, 1);
        result.applied.push({ override_id: override.override_id, override_type: override.override_type, target_ref: override.target_ref });
        break;
      }

      case 'boundary_change': {
        if (!isValidBoundaryChange(override.new_value)) {
          result.rejected.push({ override_id: override.override_id, reason: 'boundary_change new_value must be { container: string | null } — the composed-of container node the target should belong to, or null to remove it from every boundary' });
          break;
        }
        const { container } = override.new_value;
        if (!nodes.some((n) => n['unique-id'] === override.target_ref)) {
          reportOrphan(result, override, `boundary_change target_ref "${override.target_ref}" not found among nodes`);
          break;
        }
        if (container !== null && !nodes.some((n) => n['unique-id'] === container)) {
          reportOrphan(result, override, `boundary_change references container "${container}" which does not exist — would create a dangling composed-of container`);
          break;
        }

        // Remove target_ref from every composed-of relationship it's
        // CURRENTLY a member of (its prior boundary, if any) — a node
        // belongs to at most one boundary at a time under this override, so
        // moving it means leaving the old one first. A composed-of left
        // with zero members is dropped entirely rather than kept as a
        // degenerate empty container (same "don't leave a broken construct
        // behind" instinct as node_remove's own relationship cleanup above).
        for (let i = relationships.length - 1; i >= 0; i--) {
          const composedOf = composedOfShape(relationships[i]);
          if (!composedOf) continue;
          const memberIdx = composedOf.nodes.indexOf(override.target_ref);
          if (memberIdx === -1) continue;
          const remainingNodes = composedOf.nodes.filter((n) => n !== override.target_ref);
          if (remainingNodes.length === 0) {
            relationships.splice(i, 1);
          } else {
            relationships[i] = {
              ...relationships[i],
              'relationship-type': { 'composed-of': { container: composedOf.container, nodes: remainingNodes } },
              metadata: withReviewedStatus([...(relationships[i].metadata ?? []), { key: 'x-aac-override-provenance', value: override.decision_record_ref }]),
            };
          }
        }

        if (container !== null) {
          const existingIdx = relationships.findIndex((r) => composedOfShape(r)?.container === container);
          if (existingIdx !== -1) {
            const composedOf = composedOfShape(relationships[existingIdx])!;
            if (!composedOf.nodes.includes(override.target_ref)) {
              relationships[existingIdx] = {
                ...relationships[existingIdx],
                'relationship-type': { 'composed-of': { container, nodes: [...composedOf.nodes, override.target_ref] } },
                metadata: withReviewedStatus([...(relationships[existingIdx].metadata ?? []), { key: 'x-aac-override-provenance', value: override.decision_record_ref }]),
              };
            }
          } else {
            relationships.push({
              'unique-id': `${container}--composed-of--override`,
              description: `${container} is composed-of ${override.target_ref} (T-MR-5 boundary_change override)`,
              'relationship-type': { 'composed-of': { container, nodes: [override.target_ref] } },
              metadata: withReviewedStatus([{ key: 'x-aac-override-provenance', value: override.decision_record_ref }]),
            });
          }
        }

        result.applied.push({ override_id: override.override_id, override_type: override.override_type, target_ref: override.target_ref });
        break;
      }

      default:
        // override_type is read from an on-disk JSON file, so an
        // unrecognized value is real, reachable input (not just a TS
        // exhaustiveness formality) — must be reported as rejected, not
        // silently dropped from every result category.
        result.rejected.push({ override_id: override.override_id, reason: `override_type "${String((override as { override_type: unknown }).override_type)}" is not a recognized override type` });
        break;
    }
  }

  return { calm: { ...calm, nodes, relationships }, result };
}
