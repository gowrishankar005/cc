package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;

/**
 * T-PC1-8 (B-spring-config) — the fixture's sole real `service` unit, so
 * spring-config-pass.ts's server.port attachment has exactly one
 * unambiguous candidate to attach to (its own "never guess with 2+
 * candidates" rule needs a real single-service case to prove the positive
 * path, not just the ambiguous/skip path).
 */
@Path("/orders")
public class OrderApiResource {

    @GET
    public String listOrders() {
        return "[]";
    }
}
