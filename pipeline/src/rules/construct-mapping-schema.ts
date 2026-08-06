import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

/** Catalogue 2a — docs/solution/Architecture_as_Code_Solution_Design_v2.md §5.2. */
export interface NodeTypeMappingRule {
  unitKind: string;
  calmNodeType: 'service' | 'database' | 'system' | 'network' | 'actor' | 'webclient' | 'ecosystem' | 'ldap' | 'data-asset';
  interfaceCategories: string[];
  descriptiveCategories: string[];
}

export interface NodeTypeMapping {
  version: string;
  mappings: NodeTypeMappingRule[];
}

export function loadNodeTypeMapping(catalogueDir: string = __dirname): NodeTypeMapping {
  const filePath = path.join(catalogueDir, 'node-type-mapping.yml');
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = parseYaml(raw) as NodeTypeMapping;
  if (!doc.version || !Array.isArray(doc.mappings)) {
    throw new Error(`node-type-mapping.yml at ${filePath} is malformed: missing version or mappings array`);
  }
  return doc;
}

export function findNodeTypeMapping(mapping: NodeTypeMapping, unitKind: string): NodeTypeMappingRule | undefined {
  return mapping.mappings.find((m) => m.unitKind === unitKind);
}

/** Catalogue 2b — docs/solution/Architecture_as_Code_Solution_Design_v2.md §5.3. */
export interface RelationshipTypeMappingRule {
  relationshipKind: string;
  sourceNodeType: string;
  targetNodeType: string;
  calmRelationshipType: 'connects' | 'interacts' | 'deployed-in' | 'composed-of';
  protocol: string | null;
}

export interface RelationshipTypeMapping {
  version: string;
  mappings: RelationshipTypeMappingRule[];
  default: { calmRelationshipType: 'connects' | 'interacts' | 'deployed-in' | 'composed-of'; protocol: string | null };
}

export function loadRelationshipTypeMapping(catalogueDir: string = __dirname): RelationshipTypeMapping {
  const filePath = path.join(catalogueDir, 'relationship-type-mapping.yml');
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = parseYaml(raw) as RelationshipTypeMapping;
  if (!doc.version || !Array.isArray(doc.mappings) || !doc.default) {
    throw new Error(`relationship-type-mapping.yml at ${filePath} is malformed: missing version, mappings array, or default`);
  }
  return doc;
}

/**
 * Resolves a relationship to its CALM shape. Falls back to `default` (always
 * `connects`, never `interacts` — see the catalogue's own header comment) when
 * no row matches, rather than guessing or defaulting to the wrong variant.
 */
export function findRelationshipTypeMapping(
  mapping: RelationshipTypeMapping,
  relationshipKind: string,
  sourceNodeType: string,
  targetNodeType: string
): RelationshipTypeMappingRule | RelationshipTypeMapping['default'] {
  const match = mapping.mappings.find(
    (m) => m.relationshipKind === relationshipKind && m.sourceNodeType === sourceNodeType && m.targetNodeType === targetNodeType
  );
  return match ?? mapping.default;
}
