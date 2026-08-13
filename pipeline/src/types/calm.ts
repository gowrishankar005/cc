/**
 * Minimal CALM 1.2 TS types, scoped to what Weaver's requirements put in
 * scope for V1: nodes, relationships, interfaces, metadata. Field names and
 * enums verified directly against calm.finos.org and the authoritative schema.
 */

export type CalmNodeType =
  | 'actor'
  | 'ecosystem'
  | 'system'
  | 'service'
  | 'database'
  | 'network'
  | 'ldap'
  | 'webclient'
  | 'data-asset'
  // T-P0-1 (E2) — not one of CALM 1.2's 9 enum values, but schema-valid:
  // core.json's node-type-definition is `anyOf: [enum, {type: string}]`,
  // confirmed directly against
  // node_modules/@finos/calm-cli/dist/calm/release/1.2/meta/core.json —
  // any string passes `calm validate`. Used only for a graded-fact-admission
  // placeholder unit (TypedUnit.kind === 'unresolved') representing a real
  // Graphify-referenced class this pipeline could not classify into any of
  // the 9 real architectural kinds above; reusing one of those 9 instead
  // would misrepresent unclassified code as a real architectural kind.
  | 'unresolved-endpoint';

export type CalmInterfaceType =
  | 'host-port-interface'
  | 'hostname-interface'
  | 'path-interface'
  | 'oauth2-audience-interface'
  | 'url-interface'
  | 'rate-limit-interface'
  | 'container-image-interface'
  | 'port-interface';

export interface CalmInterface {
  'unique-id': string;
  type: CalmInterfaceType;
  [key: string]: unknown; // type-specific fields (host/port/path/...)
}

export interface CalmMetadataEntry {
  key: string;
  value: unknown;
}

// Real shape confirmed directly against the authoritative schema
// (control.json#/defs/{controls,control-detail}) and a real worked example
// (calm/getting-started/conference-signup.pattern.json — a node-level
// micro-segmentation control and a relationship-level permitted-connection
// control, both with this exact structure). The control-id is the object
// KEY, not a field inside the value — a precision the original schema read
// (requirements v0.9 §3) got right but is easy to get wrong in code.
export interface CalmControlDetail {
  'requirement-url': string; // per v0.10 §0: project-owned, honestly labeled as provisional until this project hosts real dereferenceable schemas
  'config-url'?: string;
  config?: Record<string, unknown>; // oneOf config-url/config — this pipeline always uses inline `config` (no hosted config-url yet)
}
export interface CalmControls {
  [controlId: string]: {
    description: string;
    requirements: CalmControlDetail[];
  };
}

export interface CalmNode {
  'unique-id': string;
  'node-type': CalmNodeType;
  name: string;
  description: string;
  interfaces?: CalmInterface[];
  controls?: CalmControls;
  metadata?: CalmMetadataEntry[];
}

export type CalmRelationshipType = 'interacts' | 'connects' | 'deployed-in' | 'composed-of';

// Per-variant shapes, not one shape reused for all four (the earlier version of
// this type was itself part of the interacts/connects bug: it forced every
// variant into {source, destination}, which is only actually correct for
// `connects` — confirmed against the authoritative schema, core.json#/defs,
// requirements v0.9 §1). `interacts` is actor-centric fan-out; `deployed-in`/
// `composed-of` are container/nodes[] composition — different shapes entirely.
export interface CalmConnectsType {
  connects: {
    source: { node: string; interfaces?: string[] };
    destination: { node: string; interfaces?: string[] };
  };
}
export interface CalmInteractsType {
  interacts: { actor: string; nodes: string[] };
}
export interface CalmDeployedInType {
  'deployed-in': { container: string; nodes: string[] };
}
export interface CalmComposedOfType {
  'composed-of': { container: string; nodes: string[] };
}
export type CalmRelationshipTypeShape = CalmConnectsType | CalmInteractsType | CalmDeployedInType | CalmComposedOfType;

export interface CalmRelationship {
  'unique-id': string;
  description: string;
  'relationship-type': CalmRelationshipTypeShape;
  protocol?: string;
  metadata?: CalmMetadataEntry[];
}

export interface CalmDocument {
  nodes: CalmNode[];
  relationships: CalmRelationship[];
  metadata?: CalmMetadataEntry[];
}
