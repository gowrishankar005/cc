import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import { expandWithGraphifyRefTargets } from './graphify-import-target';

export interface MessagingLibraryEntry {
  name: string;
  language: string;
  evidenceLevel: 'verified' | 'unverified';
}

export interface MessagingStrategy {
  id: string;
  description: string;
  status: 'dispatched' | 'implemented-elsewhere' | 'not-implemented';
  libraries?: MessagingLibraryEntry[];
  mechanism?: string;
}

export interface MessagingDetectionCatalogue {
  version: string;
  strategies: MessagingStrategy[];
}

/** Mirrors persistence-detection-schema.ts's loader exactly (T-X7-2). */
export function loadMessagingDetectionCatalogue(catalogueDir: string = __dirname): MessagingDetectionCatalogue {
  const filePath = path.join(catalogueDir, 'messaging-detection-catalogue.yml');
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = parseYaml(raw) as MessagingDetectionCatalogue;
  if (!doc.version || !Array.isArray(doc.strategies)) {
    throw new Error(`messaging-detection-catalogue.yml at ${filePath} is malformed: missing version or strategies array`);
  }
  return doc;
}

/** The one strategy messaging-detector.ts actually dispatches — its library set, as a lookup Set. Expanded with each library's Graphify `ref_`-transformed form (graphify-import-target.ts) — see persistence-detection-schema.ts's driverImportLibraries for the real evidence this was found from. */
export function importOnlyMessagingLibraries(catalogue: MessagingDetectionCatalogue): Set<string> {
  const strategy = catalogue.strategies.find((s) => s.id === 'import-only-cloud-client');
  return expandWithGraphifyRefTargets(new Set((strategy?.libraries ?? []).map((lib) => lib.name)));
}
