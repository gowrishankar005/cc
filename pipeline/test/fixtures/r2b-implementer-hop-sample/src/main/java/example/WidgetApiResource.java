package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

/**
 * AREC R2b (docs/solution/AREC_R2b_Implementer_Store_Hop.md §4) — positive
 * path. Distinct from r2-bridge-sample (Phase 1: the implementer itself is
 * @Entity): here WidgetReadServiceImpl is a PLAIN class with no persistence
 * evidence of its own, but imports the real entity directly — the realistic
 * layered shape real Fineract fineract-core's BusinessDateApiResource ->
 * BusinessDateReadPlatformService -> BusinessDateReadPlatformServiceImpl ->
 * BusinessDateRepository turned out to be (confirmed real, not synthetic,
 * via the regression suite's fineract-core test) once R2b shipped.
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
