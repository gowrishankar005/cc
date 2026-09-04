import * as fs from 'fs';
import * as path from 'path';
import { parseAllDocuments } from 'yaml';

/**
 * Flat/pre-rendered Kubernetes manifest discovery + parse. Deliberately
 * scoped to already-rendered YAML on disk (confirmed real shape against a
 * reference Python microservices banking app's repo-root, pre-rendered
 * manifests — not the per-package `k8s/base/` Kustomize sources, which
 * differ and are NOT resolved here). Kustomize/Helm template resolution is
 * explicit backlog, not silently assumed to work against a templated source.
 *
 * `Deployment` and `StatefulSet` objects are both read (same
 * `spec.template.spec` Pod-template shape — a StatefulSet is not a special
 * case, it's the same real k8s convention, just a different top-level
 * `kind`). Real gap found scoping §5.7a (k8s-evidenced database node
 * synthesis, Architecture_as_Code_Solution_Design_v2.md): a reference Java
 * microservices banking sample's own real Postgres database manifests
 * (`ledger-db`/`accounts-db`) are `kind: StatefulSet`, not `Deployment` —
 * a real, common pattern for stateful workloads needing stable storage
 * identity. Excluding it meant this provider silently never saw the exact
 * database manifests §5.7a's own database-image-recognition fallback was
 * built to reach. `DeploymentManifest`/`discoverDeployments` keep their
 * existing names (avoiding a wider rename across every consumer file that
 * already imports them) — they now mean "workload manifest," not literally
 * "Deployment-kind-only."
 * Names only for Secret references — this file never reads a real
 * `Secret` object's `data`/`stringData`, only which OTHER object's
 * `metadata.name` a Deployment/StatefulSet references by name. No secret
 * VALUE is ever on a code path this provider touches.
 *
 * ConfigMap references were originally "names only" too; a narrow,
 * deliberate exception now exists (`ConfigMapKeys.keyHosts`,
 * `extractHostFromConfigValue`) — see that interface's own docstring for
 * the real evidence and the exact safety boundary (bare host only, never
 * the raw value, scheme, userinfo, port, or path; never anywhere outside
 * this file).
 */
const SKIP_DIRS = new Set(['node_modules', '.git']);

export interface SecretMount {
  secretName: string;
  itemKeys: string[]; // the `items[].key` names actually mounted — the only signal allowed for issuer/verifier inference
}

export interface DeploymentManifest {
  name: string;
  namespace: string;
  image?: string;
  // Additive. Real gap found scoping §5.7a: a team's own custom-built
  // database image commonly has NO literal engine name anywhere in its
  // registry path (e.g. a reference Java microservices banking sample's
  // real `ledger-db`/`accounts-db` StatefulSets both publish under their
  // own app-registry path, not "postgres") — but the container is
  // conventionally still NAMED after its role (`name: postgres` in the
  // real manifest), a second, independent real signal `image` alone
  // misses entirely. First container's own `name` field, not derived from
  // `image` in any way.
  containerName?: string;
  configMapNames: string[];
  secretMounts: SecretMount[];
  sourceFile: string;
}

/**
 * A ConfigMap's `data` KEY NAMES only, plus (additive, §7.x value-based
 * correlation) an EXTRACTED HOST for a key whose value is shaped like a
 * `host:port` pair or a `scheme://[user:pass@]host[:port]/...` URI —
 * never the raw value itself. `extractHostFromConfigValue` strips
 * scheme/userinfo/port/path immediately, in this same file, before the
 * result ever leaves this function — no code path outside this file (env-
 * soft-graph-detector.ts included) ever sees a raw ConfigMap value or any
 * embedded credential. Real risk this guards against, found live: a
 * reference Java/Python microservices banking sample's own real
 * `accounts-db-config` ConfigMap (not a Secret) has `ACCOUNTS_DB_URI:
 * postgresql://accounts-admin:accounts-pwd@accounts-db:5432/accounts-db` —
 * a real username+password sitting in a ConfigMap value, exactly the shape
 * this file's original "names only" boundary was protecting against
 * before this narrow, deliberate exception. Keys whose value doesn't parse
 * as either shape (a port number, a boolean-ish flag, a plain username —
 * `883745000`, `True`, `testuser`, all real values found in the same
 * manifest set) never appear in `keyHosts` at all.
 */
export interface ConfigMapKeys {
  name: string;
  keyNames: string[];
  keyHosts?: Record<string, string>;
  sourceFile: string;
}

/**
 * Returns ONLY a bare host — never the scheme, userinfo (username/password),
 * port, path, or query string, and never the original `value` itself.
 * Tries the URI shape first (searches for "://" anywhere, so a nested
 * scheme like `jdbc:postgresql://host:port/db` — a real shape found live —
 * still resolves via its real `postgresql://` segment without needing to
 * recognize `jdbc:` as a scheme itself), then the plain `host:port` shape.
 * Returns undefined for anything else — never guesses.
 */
export function extractHostFromConfigValue(value: string): string | undefined {
  const uriMatch = value.match(/:\/\/(?:[^@/]*@)?([^:/?#]+)/);
  if (uriMatch) return uriMatch[1] || undefined;
  const hostPortMatch = value.match(/^([a-zA-Z0-9.-]+):(\d+)$/);
  if (hostPortMatch) return hostPortMatch[1];
  return undefined;
}

function findManifestFiles(manifestsDir: string): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
        results.push(full);
      }
    }
  };
  if (fs.existsSync(manifestsDir)) walk(manifestsDir);
  return results;
}

function extractDeployment(doc: any, sourceFile: string): DeploymentManifest | undefined {
  if (doc?.kind !== 'Deployment' && doc?.kind !== 'StatefulSet') return undefined;

  const name: string | undefined = doc?.metadata?.name;
  if (!name) return undefined;
  const namespace: string = doc?.metadata?.namespace ?? 'default';

  const containers: any[] = doc?.spec?.template?.spec?.containers ?? [];
  const image: string | undefined = containers[0]?.image;
  const containerName: string | undefined = containers[0]?.name;

  const configMapNames = new Set<string>();
  for (const c of containers) {
    for (const envFromEntry of c.envFrom ?? []) {
      if (envFromEntry?.configMapRef?.name) configMapNames.add(envFromEntry.configMapRef.name);
    }
    for (const envEntry of c.env ?? []) {
      if (envEntry?.valueFrom?.configMapKeyRef?.name) configMapNames.add(envEntry.valueFrom.configMapKeyRef.name);
    }
  }

  const secretMounts: SecretMount[] = [];
  const volumes: any[] = doc?.spec?.template?.spec?.volumes ?? [];
  for (const v of volumes) {
    if (v?.secret?.secretName) {
      const itemKeys: string[] = (v.secret.items ?? []).map((item: any) => item.key).filter(Boolean);
      secretMounts.push({ secretName: v.secret.secretName, itemKeys });
    }
  }

  return { name, namespace, image, containerName, configMapNames: [...configMapNames], secretMounts, sourceFile };
}

function extractConfigMapKeys(doc: any, sourceFile: string): ConfigMapKeys | undefined {
  if (doc?.kind !== 'ConfigMap') return undefined;
  const name: string | undefined = doc?.metadata?.name;
  if (!name) return undefined;
  const data: Record<string, unknown> = doc?.data ?? {};
  const keyNames = Object.keys(data);
  // The only place a raw ConfigMap value is ever read in this whole
  // pipeline — extracted to a bare host immediately, in this same
  // expression, never assigned to a variable or returned as-is.
  const keyHosts: Record<string, string> = {};
  for (const key of keyNames) {
    const raw = data[key];
    if (typeof raw !== 'string') continue;
    const host = extractHostFromConfigValue(raw);
    if (host) keyHosts[key] = host;
  }
  return { name, keyNames, keyHosts: Object.keys(keyHosts).length > 0 ? keyHosts : undefined, sourceFile };
}

/** Empty array (not an error) when the directory doesn't exist or has no manifests — "run without it ok", same convention as discoverOpenApiDocuments. */
export function discoverDeployments(manifestsDir: string): DeploymentManifest[] {
  const deployments: DeploymentManifest[] = [];
  for (const filePath of findManifestFiles(manifestsDir)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const doc of parseAllDocuments(raw)) {
      const parsed = doc.toJS();
      const deployment = extractDeployment(parsed, path.relative(manifestsDir, filePath));
      if (deployment) deployments.push(deployment);
    }
  }
  return deployments;
}

/** Same discovery walk as discoverDeployments, filtered to `kind: ConfigMap` and key names only. */
export function discoverConfigMapKeys(manifestsDir: string): ConfigMapKeys[] {
  const configMaps: ConfigMapKeys[] = [];
  for (const filePath of findManifestFiles(manifestsDir)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const doc of parseAllDocuments(raw)) {
      const parsed = doc.toJS();
      const configMap = extractConfigMapKeys(parsed, path.relative(manifestsDir, filePath));
      if (configMap) configMaps.push(configMap);
    }
  }
  return configMaps;
}
