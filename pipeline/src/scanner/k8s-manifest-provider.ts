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
 * Names only for Secret/ConfigMap references — this file never reads a
 * real `Secret`/`ConfigMap` object's `data`/`stringData`, only which OTHER
 * object's `metadata.name` a Deployment/StatefulSet references by name. No
 * secret VALUE is ever on a code path this provider touches.
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
 * A ConfigMap's `data` KEY NAMES only, never `data`'s values.
 * Extending the existing "names only" boundary this file already holds for
 * Deployments (never reads Secret data) to ConfigMap objects too — reading
 * `Object.keys(data)` and discarding the values immediately, not "reading
 * then redacting."
 */
export interface ConfigMapKeys {
  name: string;
  keyNames: string[];
  sourceFile: string;
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
  const keyNames = Object.keys(doc?.data ?? {}); // NEVER doc.data's values
  return { name, keyNames, sourceFile };
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
