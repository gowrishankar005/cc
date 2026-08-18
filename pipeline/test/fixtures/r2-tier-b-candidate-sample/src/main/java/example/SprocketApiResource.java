package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

/**
 * The negative/second-instance case in this same fixture: SprocketReadService
 * (the bridge interface) is implemented by TWO classes that are BOTH real
 * @Entity stores (SprocketReadServiceImplA / SprocketReadServiceImplB) — a
 * genuinely ambiguous 2-real-candidate case, structurally distinct from
 * WidgetApiResource.java's 1-real/1-noise case above. This must still
 * refuse to guess with the ORIGINAL "unresolved-multi-hop" message, proving
 * the new tier-b path only fires on its own narrower, evidenced shape
 * (exactly 1 store candidate) and does not silently swallow real ambiguity.
 */
@Path("/sprockets")
@Produces(MediaType.APPLICATION_JSON)
public class SprocketApiResource {

    private final SprocketReadService readService;

    public SprocketApiResource(SprocketReadService readService) {
        this.readService = readService;
    }

    @GET
    public String retrieveAllSprockets() {
        return readService.retrieveAll();
    }
}
