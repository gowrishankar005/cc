import { AnalysisContext, AnalysisPass } from './pass-registry';
import { detectOutboundHttpClients } from './cross_package/outbound-http-detector';

/** T-X8-3 — reuses ctx.graphifyRun (no second Graphify invocation), same convention as detectMessagingPass. No-op when Graphify didn't run. */
export const outboundHttpPass: AnalysisPass = {
  name: 'outboundHttp',
  run(ctx: AnalysisContext) {
    if (!ctx.graphifyRun) return;
    const ignoredItems = detectOutboundHttpClients(ctx.graphifyRun);
    if (ignoredItems.length > 0) {
      console.log(`[run-slice] ${ignoredItems.length} unresolved outbound-HTTP-target ignored-item(s) (import-only evidence, T-X8-3)`);
      ctx.allIgnoredItems.push(...ignoredItems);
    }
  },
};
