import { NativeRouteFact } from './codegraph-provider';

/**
 * Native routes are already typed by CodeGraph's framework resolvers
 * (Flask/FastAPI/NestJS all registered — requirements v0.6 §3). This module
 * just re-exports the type extracted in codegraph-provider.ts; kept separate
 * per the plan's file layout so route-specific post-processing has a home
 * without growing codegraph-provider.ts into a catch-all.
 */
export type { NativeRouteFact };

export function summarizeRoutes(routes: NativeRouteFact[]): { count: number; byFile: Record<string, number> } {
  const byFile: Record<string, number> = {};
  for (const r of routes) {
    byFile[r.filePath] = (byFile[r.filePath] ?? 0) + 1;
  }
  return { count: routes.length, byFile };
}
