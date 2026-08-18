package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

/**
 * The refusal counterpart to WidgetApiResource in this fixture: both real
 * implementers of GadgetReadService carry a `@Service` stereotype, so
 * stereotype presence alone cannot disambiguate them — this must still
 * refuse to guess, same "never guess" discipline as every other R2 branch.
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
