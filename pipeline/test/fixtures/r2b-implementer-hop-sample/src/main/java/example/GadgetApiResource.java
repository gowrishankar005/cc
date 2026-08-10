package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

/**
 * Second-hop ambiguity path ("zero or 2+ candidates -> never guess").
 * GadgetReadServiceImpl imports TWO real stores directly — this mechanism
 * must refuse to pick one, same "never guess" discipline as Phase 1's own
 * 0-or-2+-implementers case.
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
