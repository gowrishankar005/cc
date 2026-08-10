package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;

/**
 * B-duplicate-relationship-objects — genuinely both REFERENCES (a field of
 * type InventoryService) AND CALLS (a method invocation on that field) the
 * same other unit. Real code shape (importing a class AND calling one of
 * its methods) — must produce exactly ONE relationship in the final CALM
 * output, not two.
 */
@Path("/orders")
public class OrderProcessor {
    private InventoryService inventoryService;

    @GET
    public String list() {
        inventoryService.reserve();
        return "[]";
    }
}
