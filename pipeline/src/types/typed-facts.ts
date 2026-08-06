/**
 * The Analysis <-> Module contract (requirements v0.6 §1).
 * modules/calm-generator reads exactly this shape and nothing else about
 * how the facts were produced — CodeGraph, Graphify, or a future engine.
 */

export interface Evidence {
  signal: string; // raw signal name, e.g. "app.route" or "Controller"
  // 'openapi' added in CONTRACT_VERSION 2.0.0 (T-X4-1) — this is the named
  // reopen trigger from Contract_Evolution_Policy.md §3: a second real
  // engine (the OpenAPI provider) now produces Evidence for the same
  // construct kind (interfaces/routes) native-route/decorator already
  // produce, so the freeze documented there is void as of this version.
  source: 'native-route' | 'decorator' | 'graphify-import' | 'openapi';
  category: 'http-entry-point' | 'framework-bootstrap' | 'persistence' | 'messaging' | 'folder-convention' | 'security-control';
  weight: number;
  ref: string; // file:line for code-sourced evidence; "relativeFilePath:paths"-style pointer for openapi (no line numbers available from a parsed YAML/JSON document)
}

export interface TypedUnit {
  id: string; // stable id, derived from qualifiedName or file+line
  // 'topic' added in CONTRACT_VERSION 4.0.0 (T-X7-1) — executes the dry run
  // already rehearsed in Contract_Evolution_Policy.md §4 for real: a
  // message queue/topic (Kafka topic, JMS queue, SQS queue, SNS topic) is a
  // genuinely new architectural category, not a service or a database.
  kind: 'service' | 'database' | 'topic' | 'unresolved';
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
  // 'shares-secret' added in CONTRACT_VERSION 3.0.0 (T-X5-0) — a k8s
  // Secret/ConfigMap-mounted-by-both-deployments trust relationship is
  // architecturally distinct from a code-level calls/imports/connects edge
  // (implicit trust via a shared credential, not a network call or a static
  // import), so it gets its own named kind rather than being silently
  // folded into 'connects' — the exact "relationship vocabulary thin"
  // complaint (G-L3-02, Extraction_Gaps_Mitigation_and_IR_Platform_Review.md)
  // this was named to fix, not perpetuate.
  kind: 'calls' | 'imports' | 'connects' | 'shares-secret';
  crossPackage: boolean;
  // 'k8s' added alongside 'shares-secret' in the same 3.0.0 bump — the k8s
  // manifest provider (scanner/k8s-manifest-provider.ts) is a third
  // relationship-evidence source, distinct from codegraph/graphify.
  source: 'codegraph' | 'graphify' | 'k8s';
  // T-X9-1 — additive OPTIONAL field (Contract_Evolution_Policy.md §2(b),
  // no CONTRACT_VERSION bump needed: an unknown optional field is harmless
  // to any existing module). Set only by the env soft-graph detector today
  // (low, fixed confidence for a name-correlation-inferred edge) — every
  // other relationship producer leaves it unset, which relationship-builder.ts
  // correctly treats as "no confidence claim," not zero.
  confidence?: number;
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

// Versions the SHAPE of TypedFacts itself (this interface), separate from
// runVersion (which pins the signal-catalogue.yml content used for a given
// run). A module declares which contractVersions it supports
// (modules/registry.ts); the registry refuses to run a module against an
// incompatible shape rather than silently misfeeding it. Bump only on a
// breaking shape change to TypedUnit/TypedRelationship/Evidence/IgnoredItem.
//
// 2.0.0 (T-X4-1, Contract_Evolution_Policy.md §5): Evidence.source gained
// 'openapi' — a closed-union extension, tier (c). Both existing modules
// (calm-generator, threat-signals) were reviewed and bumped to
// supportedMajorVersion "2" (available-modules.ts) since neither needs
// code changes to keep working correctly against the new value —
// calm-generator's interface-builder already generalizes over Evidence.source
// via a precedence table (T-X4-2), threat-signals filters on category only.
//
// 3.0.0 (T-X5-0, Contract_Evolution_Policy.md §5): TypedRelationship.kind
// gained 'shares-secret', TypedRelationship.source gained 'k8s' — another
// closed-union extension, tier (c), for the k8s manifest provider (T-X5-1).
// Both modules reviewed again and bumped to supportedMajorVersion "3":
// calm-generator's relationship-builder.ts needed no code change (the
// generic `${rel.kind} relationship (...)` description and the
// catalogue-driven relationship-type-mapping.yml lookup both already
// generalize over TypedRelationship.kind); threat-signals is unaffected
// (it inspects Evidence.category on units, never touches relationships).
//
// 4.0.0 (T-X7-1, Contract_Evolution_Policy.md §5): TypedUnit.kind gained
// 'topic' — the exact dry run §4 rehearsed, executed for real. Sequencing
// followed §4's own note precisely: the node-type-mapping.yml row
// (unitKind: topic -> calmNodeType: network) was added in the SAME change
// as this bump, before calm-generator's supportedMajorVersion was raised —
// not after. Both modules reviewed and bumped to supportedMajorVersion
// "4": calm-generator needed the new mapping row (now present);
// threat-signals needed no change (filters on Evidence.category, which is
// unaffected — 'messaging' already existed in the category union).
export const CONTRACT_VERSION = '4.0.0';

export interface TypedFacts {
  contractVersion: string; // this TypedFacts SHAPE's version — see CONTRACT_VERSION
  runVersion: string; // pins the signal-catalogue.yml version used for this run
  generatedAt: string;
  packageRoots: string[];
  units: TypedUnit[];
  relationships: TypedRelationship[];
  ignoredItems: IgnoredItem[];
}
