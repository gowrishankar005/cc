import { AnalysisContext, AnalysisPass } from './pass-registry';
import { discoverDeployments } from '../scanner/k8s-manifest-provider';
import { detectK8sTrustRelationships } from './cross_package/k8s-trust-detector';

/**
 * T-X5-1 — opt-in: only runs when --k8s-manifests <dir> was passed
 * (ctx.k8sManifestsDir set by run-slice.ts's CLI parsing). Runs AFTER
 * mapSignalsPass/openApiPass so ctx.allUnits is populated to correlate
 * deployment names against. Deliberately NOT emitting decorators/metadata
 * (image, namespace) this round — the actual named gap (G-L1-03) is the
 * trust RELATIONSHIP; decorators were explicitly lower-priority in the
 * task's own wording and are left honestly absent, not stubbed.
 */
export const k8sTrustPass: AnalysisPass = {
  name: 'k8sTrust',
  run(ctx: AnalysisContext) {
    if (!ctx.k8sManifestsDir) return;

    const deployments = discoverDeployments(ctx.k8sManifestsDir);
    const { relationships, ignoredItems } = detectK8sTrustRelationships(deployments, ctx.allUnits);

    ctx.relationships.push(...relationships);
    ctx.allIgnoredItems.push(...ignoredItems);

    console.log(`[k8s-trust] ${deployments.length} deployment(s) read, ${relationships.length} trust relationship(s), ${ignoredItems.length} unresolved`);
  },
};
