/**
 * The Analysis <-> Module contract (requirements v0.6 §1).
 * modules/calm-generator reads exactly this shape and nothing else about
 * how the facts were produced — CodeGraph, Graphify, or a future engine.
 */

export interface Evidence {
  signal: string; // raw signal name, e.g. "app.route" or "Controller"
  source: 'native-route' | 'decorator' | 'graphify-import';
  category: 'http-entry-point' | 'framework-bootstrap' | 'persistence' | 'messaging' | 'folder-convention';
  weight: number;
  ref: string; // file:line
}

export interface TypedUnit {
  id: string; // stable id, derived from qualifiedName or file+line
  kind: 'service' | 'database' | 'unresolved';
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  evidence: Evidence[];
  confidence: number; // 0-100, Gap_Closure_Build_Ready_Specs_v0.1.md §7 bands
}

export interface TypedRelationship {
  from: string;
  to: string;
  kind: 'calls' | 'imports' | 'connects';
  crossPackage: boolean;
  source: 'codegraph' | 'graphify';
}

export interface IgnoredItem {
  ref: string;
  reason:
    | 'TEST_CODE'
    | 'GENERATED_CODE'
    | 'PURE_UTILITY'
    | 'AMBIGUOUS_BOUNDARY'
    | 'INSUFFICIENT_EVIDENCE'
    | 'EXCLUDED_BY_CONFIG'
    | 'CROSS_DOMAIN_UNRESOLVED'
    | 'OTHER';
  detail?: string;
}

export interface TypedFacts {
  runVersion: string; // pins the signal-catalogue.yml version used for this run
  generatedAt: string;
  packageRoots: string[];
  units: TypedUnit[];
  relationships: TypedRelationship[];
  ignoredItems: IgnoredItem[];
}
