package lab.rbac;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lab fixture — HTTP API with method-level RBAC (control + route on same unit).
 */
@RestController
@RequestMapping("/accounts")
public class AccountReadController {

    @GetMapping
    @PreAuthorize("hasAuthority('ACCOUNT_READ')")
    public String list() {
        return "[]";
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ACCOUNT_READ')")
    public String get() {
        return "{}";
    }
}
