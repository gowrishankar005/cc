package example;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * T-onboarding-1a/1b — real Spring MVC controller shape (checked-in
 * fixture, isolates the shape; not found-in-the-wild). @RestController is
 * a class-level framework-bootstrap marker (signal-catalogue.yml's
 * spring-mvc-controller-decorator); @GetMapping/@PostMapping are the
 * method-level route decorators CodeGraph's native `route` resolver
 * already types into NativeRouteFacts. Before T-onboarding-1a/1b, a fully
 * correct scan of this exact shape reported all three annotation names as
 * "unmapped" despite being fully, correctly detected via native typing.
 */
@RestController
public class WidgetController {

    @GetMapping("/widgets/{id}")
    public String getWidget(@PathVariable String id) {
        return "{}";
    }

    @PostMapping("/widgets")
    public String createWidget() {
        return "{}";
    }
}
