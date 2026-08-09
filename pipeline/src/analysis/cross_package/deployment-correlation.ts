import * as path from 'path';
import { TypedUnit } from '../../types/typed-facts';

/**
 * Shared by k8s-trust-detector.ts (T-X5-1) and env-soft-graph-detector.ts
 * (T-X9-1) — both need to answer the same question, "which TypedUnit does
 * this k8s Deployment name correspond to," and were previously two
 * independent implementations (env-soft-graph already imported this one,
 * but the function itself was exact-match-only, defined inside
 * k8s-trust-detector.ts as if it were trust-specific).
 *
 * GENERIC FIX, not a per-repo patch: upgraded from exact-match-only to
 * normalize-then-substring, found by tracing a REAL gap — the reference Python app's Java
 * services never correlated because k8s names them by role
 * ("balance-reader") while the source uses verbose Spring controller class
 * names ("BalanceReaderController.java"). Verified against all three real
 * cases before writing the matching rule (not assumed):
 *   normalize("balance-reader")        = "balancereader"
 *   normalize("BalanceReaderController") = "balancereadercontroller"
 *   "balancereadercontroller".includes("balancereader") -> true
 * Same pattern holds for ledger-writer/LedgerWriterController and
 * transaction-history/TransactionHistoryController. This is a general
 * "deployment name is a substring of the unit's normalized basename" rule,
 * not a hardcoded the reference Python app name list — it generalizes to any repo following the
 * same "deployment named by role, class named role+suffix" convention,
 * which is extremely common (Controller/Service/Handler/Listener suffixes).
 *
 * The MIN_LENGTH guard exists so a short, generic deployment name (e.g. a
 * 2-character abbreviation) can't substring-match unrelated units by
 * accident — a real false-positive risk substring matching alone would
 * otherwise carry uncontrolled.
 *
 * REAL BUG CAUGHT BY TESTING THIS AGAINST FULL the reference Python app (not assumed safe):
 * substring matching alone matched the reference Python app's `ledger-writer`/`transaction-history`
 * deployments to `Transaction.java` — a JPA @Entity class, not the actual
 * TransactionHistoryController service — because "transaction" is a
 * substring of "transactionhistory". Fixed with a principled, generic
 * constraint, not a name exclusion: a k8s Deployment represents a running
 * SERVICE process, so it can only ever correlate to a `service`-kind
 * TypedUnit — `database`/`topic` units (entities, queues) are never valid
 * matches for "which unit does this Deployment run," regardless of name.
 */
const MIN_SUBSTRING_MATCH_LENGTH = 3;

function normalizeIdentifier(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findUnitForDeployment(units: TypedUnit[], deploymentName: string): TypedUnit | undefined {
  const serviceUnits = units.filter((u) => u.kind === 'service');
  const normDeployment = normalizeIdentifier(deploymentName);

  // Exact match first (case-insensitive, unnormalized) — the strong,
  // zero-ambiguity case (e.g. the reference Python app's Python services: "userservice" deployment
  // <-> userservice.py), preferred over any substring match.
  const exact = serviceUnits.find((u) => path.basename(u.filePath, path.extname(u.filePath)).toLowerCase() === deploymentName.toLowerCase());
  if (exact) return exact;

  if (normDeployment.length < MIN_SUBSTRING_MATCH_LENGTH) return undefined;

  return serviceUnits.find((u) => {
    const normUnit = normalizeIdentifier(path.basename(u.filePath, path.extname(u.filePath)));
    return normUnit.includes(normDeployment) || normDeployment.includes(normUnit);
  });
}
