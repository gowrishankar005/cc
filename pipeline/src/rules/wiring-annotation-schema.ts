import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

export interface WiringAnnotationEntry {
  name: string;
  language: string;
  ecosystem: string;
  evidenceLevel: 'verified' | 'unverified';
  evidence?: string;
}

export interface WiringAnnotationCatalogue {
  version: string;
  annotations: WiringAnnotationEntry[];
}

export function loadWiringAnnotationCatalogue(catalogueDir: string = __dirname): WiringAnnotationCatalogue {
  const filePath = path.join(catalogueDir, 'wiring-annotation-catalogue.yml');
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = parseYaml(raw) as WiringAnnotationCatalogue;
  if (!doc.version || !Array.isArray(doc.annotations)) {
    throw new Error(`wiring-annotation-catalogue.yml at ${filePath} is malformed: missing version or annotations array`);
  }
  return doc;
}

export function wiringAnnotationNames(catalogue: WiringAnnotationCatalogue): string[] {
  return catalogue.annotations.map((a) => a.name);
}
