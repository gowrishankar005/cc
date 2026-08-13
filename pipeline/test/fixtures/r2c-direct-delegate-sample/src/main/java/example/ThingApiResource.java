package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

/**
 * T-LR-2 ambiguity path ("zero or 2+ candidates -> never guess"), same
 * discipline as r2b-implementer-hop-sample's GadgetApiResource, but for the
 * direct-delegate shape (no interface at all): ThingService imports TWO
 * real stores directly — this mechanism must refuse to pick one.
 */
@Path("/things")
@Produces(MediaType.APPLICATION_JSON)
public class ThingApiResource {

    private final ThingService service;

    public ThingApiResource(ThingService service) {
        this.service = service;
    }

    @GET
    public String retrieveAllThings() {
        return service.retrieveAll();
    }
}
