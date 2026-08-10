package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;

/**
 * The exact real bug shape, minimized: a
 * JUnit test file with multiple nested JAX-RS-annotated test-fixture
 * classes (mirrors the real `OperationIdReaderTest.java` finding from a
 * reference Java/JAX-RS banking platform). Must produce ZERO service units
 * — excluded as test code before decorator extraction ever runs, not
 * filtered out after the fact.
 */
public class MultiResourceFileTest {

    @Path("/test-orders")
    public static class FakeOrdersResource {
        @GET
        public String listOrders() {
            return "[]";
        }
    }

    @Path("/test-products")
    public static class FakeProductsResource {
        @GET
        public String listProducts() {
            return "[]";
        }
    }
}
