import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

export interface CatalogueRule {
  id: string;
  language: string;
  framework: string;
  matchSignal: string; // literal or | -separated alternatives, matched case-sensitively against raw signal name
  // 'call' added AREC Wave 3 T-D1 — call-site security signals (e.g. Java's
  // `context.authenticatedUser().validateHasReadPermission(...)`, Python's
  // `jwt.decode(...)`) matched from CodeGraph's extractFromSource()
  // `referenceKind: 'calls'` entries, the exact same mechanism family as
  // 'decorator' (referenceKind: 'decorates'), just a different reference kind.
  // 'field-type' added AREC Wave 3 T-E1 — a field/variable's declared TYPE
  // (referenceKind: 'references'), e.g. a KafkaTemplate-typed field as
  // producer-capability evidence.
  // 'extends' added AREC Wave 3 T-E3 — a class/interface's supertype
  // (referenceKind: 'extends'), e.g. `extends JpaRepository<Charge, Long>`.
  matchSource: 'native-route' | 'decorator' | 'call' | 'field-type' | 'extends';
  // 'resilience' added T-LM-2 (CONTRACT_VERSION 12.0.0) — retry-annotation
  // rows (Spring Retry `@Retryable`, Resilience4j `@Retry`).
  category: 'http-entry-point' | 'framework-bootstrap' | 'persistence' | 'messaging' | 'folder-convention' | 'security-control' | 'resilience';
  weight: number;
  calmNodeType: 'service' | 'database' | 'topic'; // 'topic' added T-X7-2, for messaging-consumer decorator rules (@KafkaListener/@JmsListener) — same CONTRACT_VERSION 4.0.0 bump as TypedUnit.kind's own 'topic' addition
  // T-LR-3 — OPTIONAL, defaults to false/absent. Marks a row as usable by
  // multi-hop-bridge-detector.ts's stereotype-disambiguation branch (a
  // bridge with 2+ real `implements` candidates resolves when exactly one
  // carries one of these signals). Read directly off the SAME row that
  // already defines the signal name (spring-service-stereotype) rather than
  // duplicating the name into a second catalogue — the one prior precedent
  // for this class of fix (T-LR-1's `wiring-annotation-catalogue.yml`)
  // needed a separate catalogue because no signal-catalogue.yml row already
  // existed for `@Configuration`; here one already does, so a second literal
  // copy of "Service" would itself be the drift risk this pattern exists to
  // avoid.
  bridgeStereotype?: boolean;
}

export interface SignalCatalogue {
  version: string;
  rules: CatalogueRule[];
}

/** Loads the checked-in, human-approved rule table. Never touches proposed-updates.json. */
export function loadSignalCatalogue(catalogueDir: string = __dirname): SignalCatalogue {
  const filePath = path.join(catalogueDir, 'signal-catalogue.yml');
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = parseYaml(raw) as SignalCatalogue;
  if (!doc.version || !Array.isArray(doc.rules)) {
    throw new Error(`signal-catalogue.yml at ${filePath} is malformed: missing version or rules array`);
  }
  return doc;
}

/**
 * Finds a matching rule for a raw signal. matchSignal may be a `|`-separated
 * alternation (e.g. "get|post|put"); comparison is case-insensitive since
 * decorator/route names vary in casing across frameworks.
 *
 * Matches on WORD BOUNDARIES, not raw substring — a real bug, not a
 * theoretical one, found by actually running this against real a reference Java/JAX-RS banking platform
 * source (not assumed from reading the code): plain `.includes()` matched
 * Lombok's `@Getter` annotation against the JAX-RS composed-route rule's
 * "GET" alternative (`"getter".includes("get")` is true), mis-typing a JPA
 * entity's fields as 6+ bogus HTTP-entry-point interfaces. `\bget\b` doesn't
 * match "getter" (no boundary after "get" — "tter" continues the word) but
 * does match a composed route like "GET /v1/charges/{chargeId}" (space is a
 * real boundary) — verified against the same 3 real a reference Java/JAX-RS banking platform files plus the
 * the reference Python app/NestJS regression fixtures, all still matching identically.
 *
 * `language`, when given, disambiguates when more than one rule's
 * matchSignal alternation matches the same raw signal shape — a second real
 * case: a JAX-RS composed route and NestJS's bare "Get" decorator both match
 * "get" at a word boundary (composed route: "get" followed by a space;
 * NestJS: "get" is the whole string). Without this, `.find()`'s
 * first-match-wins order would silently attribute a Java signal to the
 * NestJS rule (same category/weight today, so no visible bug yet — but wrong
 * provenance, and a real bug the moment the two rules' weights or categories
 * ever diverge).
 *
 * T-P0-5 (E4, catalogue-as-data stress test) — a THIRD real case, found
 * adding NestJS GraphQL resolver rows (`nestjs-graphql-field-decorator`,
 * matchSignal "Query|Mutation"): Spring Data JPA's real `@Query(...)`
 * annotation (a Java call-site fact, `ChargeRepository.java`) bare-word
 * matches the same alternation. Unlike the JAX-RS/NestJS "get" case above,
 * NO Java-language candidate exists for "Query" at all — the only match is
 * the TypeScript-scoped GraphQL rule. The old fallback-to-`candidates[0]`
 * behavior silently attributed this real Java persistence signal to a
 * TypeScript web-framework rule (http-entry-point, calmNodeType: service),
 * flipping `ChargeRepository`'s node type from `database` to `service` — a
 * real corruption on real a reference Java/JAX-RS banking platform source, not synthetic. The
 * fix: when `language` is given and NO candidate matches it, there is no
 * correct rule to fall back to (every candidate is provably a different
 * ecosystem's rule matching the same bare word by coincidence) — return
 * undefined so the caller's own unknown-signal handling takes over, exactly
 * as if `matchSignal` had matched nothing at all. Only changes behavior when
 * a caller passes a `language` that matches zero candidates; every existing
 * single-candidate and same-language-match case is unaffected.
 */
export function findRule(
  catalogue: SignalCatalogue,
  rawSignal: string,
  matchSource: 'native-route' | 'decorator' | 'call' | 'field-type' | 'extends',
  language?: string
): CatalogueRule | undefined {
  const candidates = catalogue.rules.filter((rule) => {
    if (rule.matchSource !== matchSource) return false;
    const alternatives = rule.matchSignal.split('|');
    return alternatives.some((alt) => new RegExp(`\\b${escapeRegExp(alt)}\\b`, 'i').test(rawSignal));
  });
  if (candidates.length === 0) return undefined;
  if (language) {
    const languageMatch = candidates.find((r) => r.language.toLowerCase() === language.toLowerCase());
    return languageMatch; // undefined when no candidate matches this fact's own language — never fall back to a different ecosystem's rule
  }
  return candidates[0];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * T-LR-3 — every raw signal name usable for multi-hop-bridge-detector.ts's
 * stereotype-disambiguation branch, read directly from signal-catalogue.yml's
 * `bridgeStereotype: true` rows (catalogue-driven, never a hardcoded name in
 * the detector itself — same discipline `wiringAnnotationNames`
 * (wiring-annotation-schema.ts) already established for T-LR-1). A row's
 * `matchSignal` may itself be a `|`-separated alternation (rule-schema.ts's
 * own convention), so this splits and flattens rather than assuming one
 * name per row.
 */
export function bridgeStereotypeSignals(catalogue: SignalCatalogue): string[] {
  return catalogue.rules.filter((r) => r.bridgeStereotype === true).flatMap((r) => r.matchSignal.split('|'));
}
