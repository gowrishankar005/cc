package lab.charges;

import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

/**
 * Lab fixture — JAX-RS charges API (Fineract-shaped).
 */
@Path("/v1/charges")
@Produces(MediaType.APPLICATION_JSON)
public class ChargesApiResource {

    @GET
    public String list() {
        return "[]";
    }

    @GET
    @Path("{chargeId}")
    public String get(@PathParam("chargeId") String chargeId) {
        return "{}";
    }

    @POST
    public String create() {
        return "{}";
    }
}
