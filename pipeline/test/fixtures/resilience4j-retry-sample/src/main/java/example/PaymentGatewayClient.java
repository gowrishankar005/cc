package example;

import io.github.resilience4j.retry.annotation.Retry;

/**
 * T-LM-2 (Lens Modules lane) — second-instance verification for the
 * retry-annotation catalogue rows (Catalogue_Intake.md's requirement: a bug
 * fix or new detection must be checked against a second, different real
 * instance, not just the case that motivated it). Spring Retry's
 * `@Retryable` is exercised by resilience-lens-sample; this fixture
 * exercises the second, independently-published library's own real
 * annotation (`@Retry`, Resilience4j) — a different package, different
 * framework, same decorator-extraction mechanism. No HTTP route on this
 * class at all: proves the resilience-only-evidence-falls-through-to-service
 * default path (same DatatableWriteService precedent C-dec already proved
 * for security-control-only evidence).
 */
public class PaymentGatewayClient {

    @Retry
    public String charge(String accountId, long amountCents) {
        return "ok";
    }
}
