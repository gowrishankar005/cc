package lab.payments;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lab fixture — Spring MVC-style payments API (target-customer Java REST pattern).
 */
@RestController
@RequestMapping("/payments")
public class PaymentController {

    @GetMapping
    public String list() {
        return "[]";
    }

    @GetMapping("/{id}")
    public String get(@PathVariable String id) {
        return "{}";
    }

    @PostMapping
    public String create() {
        return "{}";
    }
}
