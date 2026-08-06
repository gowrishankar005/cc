import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

export interface CatalogueRule {
  id: string;
  language: string;
  framework: string;
  matchSignal: string; // literal or | -separated alternatives, matched case-sensitively against raw signal name
  matchSource: 'native-route' | 'decorator';
  category: 'http-entry-point' | 'framework-bootstrap' | 'persistence' | 'messaging' | 'folder-convention';
  weight: number;
  calmNodeType: 'service' | 'database';
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
 * theoretical one, found by actually running this against real Fineract
 * source (not assumed from reading the code): plain `.includes()` matched
 * Lombok's `@Getter` annotation against the JAX-RS composed-route rule's
 * "GET" alternative (`"getter".includes("get")` is true), mis-typing a JPA
 * entity's fields as 6+ bogus HTTP-entry-point interfaces. `\bget\b` doesn't
 * match "getter" (no boundary after "get" — "tter" continues the word) but
 * does match a composed route like "GET /v1/charges/{chargeId}" (space is a
 * real boundary) — verified against the same 3 real Fineract files plus the
 * BoA/NestJS regression fixtures, all still matching identically.
 *
 * `language`, when given, disambiguates when more than one rule's
 * matchSignal alternation matches the same raw signal shape — a second real
 * case: a JAX-RS composed route and NestJS's bare "Get" decorator both match
 * "get" at a word boundary (composed route: "get" followed by a space;
 * NestJS: "get" is the whole string). Without this, `.find()`'s
 * first-match-wins order would silently attribute a Java signal to the
 * NestJS rule (same category/weight today, so no visible bug yet — but wrong
 * provenance, and a real bug the moment the two rules' weights or categories
 * ever diverge). Falls back to the first match if no candidate's `language`
 * matches, so this doesn't change existing single-match cases.
 */
export function findRule(
  catalogue: SignalCatalogue,
  rawSignal: string,
  matchSource: 'native-route' | 'decorator',
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
    if (languageMatch) return languageMatch;
  }
  return candidates[0];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
