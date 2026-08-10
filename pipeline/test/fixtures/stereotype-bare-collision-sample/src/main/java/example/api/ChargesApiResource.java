package example.api;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import org.springframework.stereotype.Component;

/**
 * Reproduces the real bug shape: @Component is Spring's generic stereotype
 * annotation (a framework marker), not a reference to any project class.
 * The bug: Graphify resolves the bare identifier "Component" against ANY
 * same-named in-repo class, fabricating a relationship to example.domain.Component
 * below, which has nothing to do with this class.
 */
@Component
@Path("/charges")
public class ChargesApiResource {
    @GET
    public String list() {
        return "[]";
    }
}
