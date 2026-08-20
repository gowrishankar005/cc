package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

/**
 * T-FS-1 (Tier-B residual class, BACKLOG.md "Tier-B residual detection").
 * WidgetReadService (the bridge interface) is implemented by TWO classes:
 * WidgetReadServiceImpl (a real @Entity store) and WidgetReadServiceMock (a
 * plain class with no persistence/messaging evidence of its own — the
 * common real Java pattern of a production implementation plus a decoy/
 * mock/legacy alternative). Syntactically this is 2 candidate implementers
 * (the same shape the pre-existing "genuinely ambiguous, never guess"
 * refusal already handled identically to a real 2-store case) — but
 * semantically only ONE of them is itself a real store. This fixture
 * proves the mechanism now tells the two shapes apart: a single
 * high-confidence candidate obscured by syntactic noise (this file) versus
 * genuine multi-candidate ambiguity (see SprocketApiResource.java in this
 * same fixture, which must still refuse identically to before).
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
