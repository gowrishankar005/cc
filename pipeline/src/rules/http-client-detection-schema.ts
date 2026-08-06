import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import { expandWithGraphifyRefTargets } from './graphify-import-target';

export interface HttpClientLibraryEntry {
  name: string;
  language: string;
  evidenceLevel: 'verified' | 'unverified';
}

export interface HttpClientStrategy {
  id: string;
  description: string;
  status: 'dispatched' | 'implemented-elsewhere' | 'not-implemented';
  libraries?: HttpClientLibraryEntry[];
  mechanism?: string;
}

export interface HttpClientDetectionCatalogue {
  version: string;
  strategies: HttpClientStrategy[];
}

/** Mirrors persistence-detection-schema.ts's loader exactly (T-X8-3a). */
export function loadHttpClientDetectionCatalogue(catalogueDir: string = __dirname): HttpClientDetectionCatalogue {
  const filePath = path.join(catalogueDir, 'http-client-detection-catalogue.yml');
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = parseYaml(raw) as HttpClientDetectionCatalogue;
  if (!doc.version || !Array.isArray(doc.strategies)) {
    throw new Error(`http-client-detection-catalogue.yml at ${filePath} is malformed: missing version or strategies array`);
  }
  return doc;
}

/** The one strategy outbound-http-detector.ts actually dispatches — its library set, as a lookup Set. Expanded with each library's Graphify `ref_`-transformed form (graphify-import-target.ts) — see persistence-detection-schema.ts's driverImportLibraries for the real evidence this was found from. */
export function importOnlyHttpClientLibraries(catalogue: HttpClientDetectionCatalogue): Set<string> {
  const strategy = catalogue.strategies.find((s) => s.id === 'import-only-client');
  return expandWithGraphifyRefTargets(new Set((strategy?.libraries ?? []).map((lib) => lib.name)));
}
