package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

/**
 * AREC R2b ambiguity path (docs/solution/AREC_R2b_Implementer_Store_Hop.md
 * §2, "zero or 2+ candidates -> never guess"). GadgetReadServiceImpl imports
 * TWO real stores directly — R2b must refuse to pick one, same "never guess"
 * discipline as Phase 1's own 0-or-2+-implementers case.
 */
@Path("/gadgets")
@Produces(MediaType.APPLICATION_JSON)
public class GadgetApiResource {

    private final GadgetReadService readService;

    public GadgetApiResource(GadgetReadService readService) {
        this.readService = readService;
    }

    @GET
    public String retrieveAllGadgets() {
        return readService.retrieveAll();
    }
}
