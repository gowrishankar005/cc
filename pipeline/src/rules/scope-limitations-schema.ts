import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

export interface ScopeLimitation {
  id: string;
  text: string;
  permanent?: boolean;
}

export interface ScopeLimitationsCatalogue {
  version: string;
  limitations: ScopeLimitation[];
}

/** T-X0-3 — loader for the single scope-limitations source. See scope-limitations.yml's own header for why this replaced a hardcoded array in metadata-builder.ts. */
export function loadScopeLimitations(catalogueDir: string = __dirname): ScopeLimitationsCatalogue {
  const filePath = path.join(catalogueDir, 'scope-limitations.yml');
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = parseYaml(raw) as ScopeLimitationsCatalogue;
  if (!doc.version || !Array.isArray(doc.limitations)) {
    throw new Error(`scope-limitations.yml at ${filePath} is malformed: missing version or limitations array`);
  }
  return doc;
}
