import * as fs from 'fs';
import * as path from 'path';
import { CalmDocument, CalmNode, CalmNodeType } from '../../types/calm';
import { DecisionRecord, Override, OverrideApplicationResult } from '../../types/overrides';

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
 * Applies ACTIVE overrides to an already-deterministically-built CalmDocument
 * — the final pass, per Solution Design v2 §5.4. Mechanically enforces the
 * "no override without a traceable decision" integrity rule from
 * Gap_Closure_Build_Ready_Specs_v0.1.md §6: an Override whose
 * decision_record_ref doesn't resolve to a real, ACTIVE Decision Record in
 * the same directory is rejected, not applied and not silently dropped —
 * every rejection is reported so a run doesn't silently ignore a
 * misconfigured correction.
 *
 * Deliberately supports only node_add / type_change / node_remove /
 * node_rename this round — relationship_add/relationship_remove/
 * boundary_change are recognized (won't crash) but reported as skipped, not
 * pretended-complete, since this pipeline's relationship-side needs are less
 * urgent than node-side corrections (the ambiguous/unknown-node use case
 * this was built for) and haven't been evidenced yet.
 */
export function applyOverrides(calm: CalmDocument, overridesDir: string): { calm: CalmDocument; result: OverrideApplicationResult } {
  const result: OverrideApplicationResult = { applied: [], rejected: [], skipped: [] };

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
          metadata: [...(newNode.metadata ?? []), { key: 'x-aac-override-provenance', value: override.decision_record_ref }],
        });
        result.applied.push({ override_id: override.override_id, override_type: override.override_type, target_ref: override.target_ref });
        break;
      }

      case 'type_change': {
        const idx = nodes.findIndex((n) => n['unique-id'] === override.target_ref);
        if (idx === -1) {
          result.rejected.push({ override_id: override.override_id, reason: `type_change target_ref "${override.target_ref}" not found among nodes` });
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
          metadata: [...(existing.metadata ?? []), { key: 'x-aac-override-provenance', value: override.decision_record_ref }],
        };
        result.applied.push({ override_id: override.override_id, override_type: override.override_type, target_ref: override.target_ref });
        break;
      }

      case 'node_rename': {
        const idx = nodes.findIndex((n) => n['unique-id'] === override.target_ref);
        if (idx === -1) {
          result.rejected.push({ override_id: override.override_id, reason: `node_rename target_ref "${override.target_ref}" not found among nodes` });
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
          metadata: [...(existing.metadata ?? []), { key: 'x-aac-override-provenance', value: override.decision_record_ref }],
        };
        result.applied.push({ override_id: override.override_id, override_type: override.override_type, target_ref: override.target_ref });
        break;
      }

      case 'node_remove': {
        const idx = nodes.findIndex((n) => n['unique-id'] === override.target_ref);
        if (idx === -1) {
          result.rejected.push({ override_id: override.override_id, reason: `node_remove target_ref "${override.target_ref}" not found among nodes` });
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

      case 'relationship_add':
      case 'relationship_remove':
      case 'boundary_change':
        result.skipped.push({ override_id: override.override_id, override_type: override.override_type, reason: `override_type "${override.override_type}" is recognized but not yet implemented` });
        break;
    }
  }

  return { calm: { ...calm, nodes, relationships }, result };
}
