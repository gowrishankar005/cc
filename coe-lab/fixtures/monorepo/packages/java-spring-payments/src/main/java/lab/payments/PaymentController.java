package lab.payments;

import org.springframework.retry.annotation.Retryable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lab fixture — Spring MVC-style payments API (Fidelity Java REST pattern).
 * T-LM-2 (Lens Modules lane) — get() carries a real Spring Retry
 * `@Retryable` (a realistic shape: retrying a flaky downstream lookup),
 * paired with this package's new src/main/resources/application.yml
 * resilience4j timeout-duration config, for resilience-lens gold.
 */
@RestController
@RequestMapping("/payments")
public class PaymentController {

    @GetMapping
    public String list() {
        return "[]";
    }

    @GetMapping("/{id}")
    @Retryable
    public String get(@PathVariable String id) {
        return "{}";
    }

    @PostMapping
    public String create() {
        return "{}";
    }
}
