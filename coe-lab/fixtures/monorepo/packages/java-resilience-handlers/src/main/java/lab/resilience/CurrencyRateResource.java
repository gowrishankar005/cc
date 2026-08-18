package lab.resilience;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import io.github.resilience4j.retry.annotation.Retry;

/**
 * T-LM-2 (Lens Modules lane), review fix (2026-08-16) — a DEDICATED
 * resilience-lens gold fixture, deliberately separate from
 * java-spring-payments (which already carries its own gold/calm/ +
 * gold/packages/ architecture-level gold this module-level gold must never
 * couple to).
 *
 * The `@Retry(name = ..., fallbackMethod = ...)` shape here is not
 * invented — it's the exact real, independently-found usage confirmed in a
 * reference Java/JAX-RS banking platform's core module (49 files, e.g. its
 * CurrencyUpdateCommandHandler.java line 39: `@Retry(name =
 * "commandCurrencyUpdate", fallbackMethod = "fallback")`), verified via a
 * real run-slice scan of that real module (7 real units detected, see
 * docs/solution/Claim_Register.md's resilience-lens row).
 * This fixture exists only to give the deterministic gold+scorer harness a
 * stable, checked-in target — the detection mechanism itself was validated
 * against real, independently-authored source, not designed from this
 * fixture (CLAUDE.md's CoE Lab isolation table).
 */
@Path("/currency-rates")
public class CurrencyRateResource {

    @GET
    @Retry(name = "currencyRateLookup", fallbackMethod = "fallback")
    public String list() {
        return "[]";
    }

    public String fallback(Throwable t) {
        return "[]";
    }
}
