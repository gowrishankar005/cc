package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import org.springframework.retry.annotation.Retryable;

/**
 * T-LM-2 (Lens Modules lane) — a real JAX-RS resource whose read method is
 * ALSO retry-annotated (a realistic shape: retrying a flaky downstream call
 * behind an HTTP endpoint), same fixture idea as spring-config-sample's
 * OrderApiResource (this project's own convention for these fixtures) — the
 * sole real `service` unit in this root, so both server-side detections
 * being exercised here (retry-annotation evidence, resilience4j timeout
 * config) have exactly one unambiguous unit to attach to.
 */
@Path("/orders")
public class OrderApiResource {

    @GET
    @Retryable
    public String listOrders() {
        return "[]";
    }
}
