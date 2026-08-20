package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

/**
 * Synthetic fixture for T-LR-3 (BACKLOG.md "Plain-interface bridge
 * detection"). Mirrors the real shape named in
 * Architect_Pilot_Feedback_Notes.md Entry 13: this resource references a
 * bridge interface (WidgetReadService) with no evidence of its own, and the
 * interface has TWO real implementers within scanned roots — previously
 * always refused as ambiguous. Only WidgetReadServiceImpl carries a real
 * `@Service` stereotype; WidgetReadServiceLegacyImpl carries none, the
 * shape a leftover/manual/non-Spring-managed alternate implementation
 * produces in a real codebase.
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
