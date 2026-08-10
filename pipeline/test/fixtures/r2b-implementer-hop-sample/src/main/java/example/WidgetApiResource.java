package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

/**
 * Second-hop positive path. Distinct from r2-bridge-sample (Phase 1: the
 * implementer itself is @Entity): here WidgetReadServiceImpl is a PLAIN
 * class with no persistence evidence of its own, but imports the real
 * entity directly — the realistic layered shape a reference Java/JAX-RS
 * banking platform's BusinessDateApiResource -> BusinessDateReadPlatformService
 * -> BusinessDateReadPlatformServiceImpl -> BusinessDateRepository turned
 * out to be (confirmed real, not synthetic, via the regression suite's
 * fineract-core test) once this mechanism shipped.
 */
@Path("/widgets")
@Produces(MediaType.APPLICATION_JSON)
public class WidgetApiResource {

    private final WidgetReadService readService;

    public WidgetApiResource(WidgetReadService readService) {
        this.readService = readService;
    }

    @GET
    public String retrieveAllWidgets() {
        return readService.retrieveAll();
    }
}
