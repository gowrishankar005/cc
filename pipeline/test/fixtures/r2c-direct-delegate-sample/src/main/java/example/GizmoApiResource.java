package example;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

/**
 * T-LR-2 (direct-delegate) positive path. Distinct from r2-bridge-sample
 * (Phase 1) and r2b-implementer-hop-sample (R2b): GizmoService has no
 * interface layer at all — GizmoApiResource references the concrete class
 * directly. GizmoService itself imports exactly one real entity. The real
 * shape found in Waltz (a reference Java governance platform):
 * SettingsEndpoint -> SettingsDao, no interface, confirmed via the real
 * repo before this synthetic fixture was written.
 */
@Path("/gizmos")
@Produces(MediaType.APPLICATION_JSON)
public class GizmoApiResource {

    private final GizmoService service;

    public GizmoApiResource(GizmoService service) {
        this.service = service;
    }

    @GET
    public String retrieveAllGizmos() {
        return service.retrieveAll();
    }
}
