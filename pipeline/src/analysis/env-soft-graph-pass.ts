import { AnalysisContext, AnalysisPass, pushAll } from './pass-registry';
import { discoverDeployments, discoverConfigMapKeys } from '../scanner/k8s-manifest-provider';
import { detectEnvSoftGraphRelationships } from './cross_package/env-soft-graph-detector';
import { loadEnvRelationshipAllowlist } from '../rules/env-relationship-schema';
import * as path from 'path';

/**
 * OFF BY DEFAULT (ctx.enableEnvSoftGraph must be explicitly true,
 * set by run-slice.ts's --enable-env-soft-graph flag) AND requires
 * --k8s-manifests, same opt-in convention as k8sTrustPass. MUST run after
 * reconcilePass (which overwrites ctx.relationships, not appends) — same
 * ordering requirement as k8sTrustPass, placed alongside it.
 */
export const envSoftGraphPass: AnalysisPass = {
  name: 'envSoftGraph',
  run(ctx: AnalysisContext) {
    if (!ctx.enableEnvSoftGraph || !ctx.k8sManifestsDir) return;

    const deployments = discoverDeployments(ctx.k8sManifestsDir);
    const configMaps = discoverConfigMapKeys(ctx.k8sManifestsDir);
    const allowlist = loadEnvRelationshipAllowlist(path.join(__dirname, '..', 'rules'));

    const { relationships, ignoredItems } = detectEnvSoftGraphRelationships(deployments, configMaps, ctx.allUnits, allowlist);
    pushAll(ctx.relationships, relationships);
    pushAll(ctx.allIgnoredItems, ignoredItems);

    console.log(`[env-soft-graph] ${relationships.length} low-confidence relationship(s), ${ignoredItems.length} unresolved (opt-in, --enable-env-soft-graph)`);
  },
};
