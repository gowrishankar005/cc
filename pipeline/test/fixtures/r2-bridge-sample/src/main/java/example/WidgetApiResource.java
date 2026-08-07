package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

/**
 * Synthetic fixture for AREC Wave 3 T-C1 (R2 multi-hop bridge detector).
 * Mirrors the real Fineract shape found in docs/solution/AREC_R2_MultiHop_Strategy.md
 * §1 (ChargesApiResource -> ChargeReadPlatformService interface -> impl):
 * this resource references a bridge interface (WidgetReadService) with no
 * evidence of its own; the interface's sole implementer (WidgetReadServiceImpl)
 * carries real persistence evidence. Real Fineract could not close this
 * exact shape (its implementer lives in a third, unscanned module and has no
 * catalogue-recognized persistence import) — this fixture proves the
 * mechanism itself works when the shape IS fully resolvable within scanned
 * roots, since no real fixture does yet.
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
