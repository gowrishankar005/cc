package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;

/**
 * T-TC2-2 (B-jaxrs-composer-class-scoping) — a real, legitimate production
 * shape with 2 distinct resource classes in ONE file, each with its own
 * @Path. Proves the fix resolves EACH method to its OWN class's path, not
 * just that it avoids the original bug (which would have composed BOTH
 * methods to "/orders", the first class's path).
 */
public class MultiResourceFile {

    @Path("/orders")
    public static class OrdersResource {
        @GET
        public String listOrders() {
            return "[]";
        }
    }

    @Path("/products")
    public static class ProductsResource {
        @GET
        public String listProducts() {
            return "[]";
        }
    }
}
