import { AnalysisContext, AnalysisPass, pushAll } from './pass-registry';
import { discoverDeployments } from '../scanner/k8s-manifest-provider';
import { detectK8sTrustRelationships } from './cross_package/k8s-trust-detector';
import { detectK8sDeployedInRelationships } from './cross_package/k8s-deployment-detector';

/**
 * Trust (shared secrets) and placement (namespace) — opt-in: only runs when
 * --k8s-manifests <dir> was passed (ctx.k8sManifestsDir set by
 * run-slice.ts's CLI parsing). Runs AFTER mapSignalsPass/openApiPass so
 * ctx.allUnits is populated to correlate deployment names against. Both
 * detectors read the SAME discoverDeployments() result — one manifest walk,
 * two independent facts extracted from it (trust via shared secrets,
 * placement via namespace), same reasoning env-soft-graph-detector.ts's own
 * reuse of findUnitForDeployment already established: shared input, separate
 * mechanisms, not a merged detector. Deliberately NOT emitting
 * image/build-metadata decorators this round — out of scope for both.
 */
export const k8sTrustPass: AnalysisPass = {
  name: 'k8sTrust',
  run(ctx: AnalysisContext) {
    if (!ctx.k8sManifestsDir) return;

    const deployments = discoverDeployments(ctx.k8sManifestsDir);
    const trust = detectK8sTrustRelationships(deployments, ctx.allUnits);
    const deployedIn = detectK8sDeployedInRelationships(deployments, ctx.allUnits);

    pushAll(ctx.relationships, trust.relationships);
    pushAll(ctx.relationships, deployedIn.relationships);
    pushAll(ctx.allIgnoredItems, trust.ignoredItems);
    pushAll(ctx.allIgnoredItems, deployedIn.ignoredItems);

    console.log(
      `[k8s-trust] ${deployments.length} deployment(s) read, ${trust.relationships.length} trust relationship(s), ${deployedIn.relationships.length} deployed-in relationship(s), ${trust.ignoredItems.length + deployedIn.ignoredItems.length} unresolved`
    );
  },
};
