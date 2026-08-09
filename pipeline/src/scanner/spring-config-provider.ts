import * as fs from 'fs';
import * as path from 'path';
import { parseAllDocuments } from 'yaml';

/**
 * T-PC1-1/T-PC1-2 (B-spring-config) — deterministic `application.yml`/
 * `application-*.yml`/`application.properties` discovery + flat-key parse.
 * Real root cause this closes (`coe-lab/docs/reference/spring-config-blind-spot-root-cause-and-fix.md`):
 * CodeGraph never attempts YAML/properties at all (excluded from its
 * `GrammarLanguage` list); Graphify classifies `.yml` as a document type
 * only reachable through its LLM semantic-extraction path, which this
 * project's `--code-only` flag deliberately and correctly skips to avoid an
 * LLM dependency; `.properties` isn't classified by Graphify at all, in any
 * mode. Same mechanism class as `k8s-manifest-provider.ts`/
 * `openapi-provider.ts` — a 4th instance of the proven "structured
 * non-code file provider" pattern, not a new mechanism. Scanner provider
 * only: file discovery + structural parse, no TypedFacts construction here
 * (that's `analysis/spring-config-pass.ts`).
 */
const SKIP_DIRS = new Set(['node_modules', '.git', '.codegraph', '.graphify-cache', 'graphify-out']);
const YAML_RE = /^application(-[\w.]+)?\.ya?ml$/;
const PROPS_RE = /^application(-[\w.]+)?\.properties$/;
const PROFILE_RE = /^application-([\w.]+)\.(?:ya?ml|properties)$/;

export interface SpringConfigFile {
  filePath: string; // relative to packageRoot
  profile?: string; // undefined for the base application.yml/.properties; the "-<profile>" segment otherwise
  /**
   * Review finding (2026-08-09) — a real, confirmed bug: multi-document
   * `application.yml` files scoped via Spring's own
   * `spring.config.activate.on-profile` were previously flattened and
   * MERGED into one map regardless of profile, silently presenting a
   * profile-gated value (e.g. a real prod datasource URL) as if it were
   * the file's unconditional default. Fixed: a document carrying an
   * `on-profile` key becomes its OWN separate `SpringConfigFile` entry,
   * never merged with the unconditional/base document — this field names
   * which profile that entry came from (distinct from the file-NAME-derived
   * `profile` above, since a single un-suffixed `application.yml` can still
   * contain profile-scoped documents inside it).
   */
  docProfile?: string;
  properties: Map<string, string>; // flattened dot-notation key -> string value, e.g. "spring.datasource.url" -> "jdbc:postgresql://host:5432/db"
}

const ON_PROFILE_KEY = 'spring.config.activate.on-profile';

function findSpringConfigFiles(packageRoot: string): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (YAML_RE.test(entry.name) || PROPS_RE.test(entry.name)) {
        results.push(full);
      }
    }
  };
  if (fs.existsSync(packageRoot)) walk(packageRoot);
  return results;
}

function flattenYaml(obj: unknown, prefix: string, out: Map<string, string>): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    if (prefix) out.set(prefix, String(obj));
    return;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    flattenYaml(value, prefix ? `${prefix}.${key}` : key, out);
  }
}

/** ~20-line flat key=value reader (T-SC-2) — no new dependency, `.properties` has no nesting/anchors/multi-doc concerns YAML has. */
function parsePropertiesFile(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const eqIdx = line.search(/[:=]/);
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    if (key) out.set(key, value);
  }
  return out;
}

/**
 * Empty array (not an error) when no Spring config files exist under
 * packageRoot — "run without it ok", same convention as
 * discoverOpenApiDocuments/discoverDeployments.
 *
 * T-VM-2's decided profile-merge policy (spring-config-property-vocabulary.md
 * §3): each file's properties are kept SEPARATE, never merged across files
 * here. A base `application.yml` and a sibling `application-prod.yml` both
 * setting `spring.datasource.url` are two distinct facts with two distinct
 * provenance refs — analysis/spring-config-pass.ts (the consumer) decides
 * what to do with both, this provider never silently picks one or merges.
 */
export function discoverSpringConfigFiles(packageRoot: string): SpringConfigFile[] {
  const results: SpringConfigFile[] = [];
  for (const absPath of findSpringConfigFiles(packageRoot)) {
    const filename = path.basename(absPath);
    const relativeFilePath = path.relative(packageRoot, absPath);
    const raw = fs.readFileSync(absPath, 'utf8');
    const fileProfile = PROFILE_RE.exec(filename)?.[1];

    if (!YAML_RE.test(filename)) {
      results.push({ filePath: relativeFilePath, profile: fileProfile, properties: parsePropertiesFile(raw) });
      continue;
    }

    // Spring's own multi-document application.yml convention (documents
    // separated by `---`): a document with NO spring.config.activate.on-profile
    // key is unconditional and merges into this file's own base map
    // (last-unconditional-document-wins, matching Spring's own behavior for
    // a single file's own unconditional document sequence). A document WITH
    // an on-profile key is profile-conditional — it is NEVER merged into the
    // unconditional facts (that would silently misattribute a profile-gated
    // value as always-active, a real bug found on review); it becomes its
    // own separate SpringConfigFile entry instead, carrying only its own
    // document's data.
    const unconditional = new Map<string, string>();
    const profiledEntries: { docProfile: string; properties: Map<string, string> }[] = [];
    for (const doc of parseAllDocuments(raw)) {
      const flat = new Map<string, string>();
      flattenYaml(doc.toJS(), '', flat);
      const onProfile = flat.get(ON_PROFILE_KEY);
      if (onProfile) {
        profiledEntries.push({ docProfile: onProfile, properties: flat });
      } else {
        for (const [k, v] of flat) unconditional.set(k, v);
      }
    }

    results.push({ filePath: relativeFilePath, profile: fileProfile, properties: unconditional });
    for (const entry of profiledEntries) {
      results.push({ filePath: relativeFilePath, profile: fileProfile, docProfile: entry.docProfile, properties: entry.properties });
    }
  }
  return results;
}
