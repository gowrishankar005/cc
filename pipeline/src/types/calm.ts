/**
 * Minimal CALM 1.2 TS types, scoped to what requirements v0.6 §2 puts in scope
 * for V1: nodes, relationships, interfaces, metadata. Field names and enums
 * verified against calm.finos.org (see docs/requirements/CALM_Generator_Requirements_v0_6.md §2).
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
  | 'data-asset';

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

export interface CalmNode {
  'unique-id': string;
  'node-type': CalmNodeType;
  name: string;
  description: string;
  interfaces?: CalmInterface[];
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
