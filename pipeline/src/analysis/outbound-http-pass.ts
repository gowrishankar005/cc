import { AnalysisContext, AnalysisPass, pushAll } from './pass-registry';
import { detectOutboundHttpClients } from './cross_package/outbound-http-detector';

/** Reuses ctx.crossPackageRun (no second Graphify invocation), same convention as detectMessagingPass. No-op when Graphify didn't run. */
export const outboundHttpPass: AnalysisPass = {
  name: 'outboundHttp',
  run(ctx: AnalysisContext) {
    if (!ctx.crossPackageRun) return;
    const ignoredItems = detectOutboundHttpClients(ctx.crossPackageRun);
    if (ignoredItems.length > 0) {
      console.log(`[run-slice] ${ignoredItems.length} unresolved outbound-HTTP-target ignored-item(s) (import-only evidence)`);
      pushAll(ctx.allIgnoredItems, ignoredItems);
    }
  },
};
