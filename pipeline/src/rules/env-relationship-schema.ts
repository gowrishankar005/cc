import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

export interface EnvRelationshipAllowlist {
  version: string;
  suffixes: string[];
}

export function loadEnvRelationshipAllowlist(catalogueDir: string = __dirname): EnvRelationshipAllowlist {
  const filePath = path.join(catalogueDir, 'env-relationship-allowlist.yml');
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = parseYaml(raw) as EnvRelationshipAllowlist;
  if (!doc.version || !Array.isArray(doc.suffixes)) {
    throw new Error(`env-relationship-allowlist.yml at ${filePath} is malformed: missing version or suffixes array`);
  }
  return doc;
}

/** Returns the candidate service basename (key name minus the matched suffix) if allowlisted, else undefined. NAME-ONLY — never touches a value. */
export function allowlistedBasename(keyName: string, allowlist: EnvRelationshipAllowlist): string | undefined {
  const upper = keyName.toUpperCase();
  for (const suffix of allowlist.suffixes) {
    if (upper.endsWith(suffix.toUpperCase())) {
      return keyName.slice(0, keyName.length - suffix.length);
    }
  }
  return undefined;
}
