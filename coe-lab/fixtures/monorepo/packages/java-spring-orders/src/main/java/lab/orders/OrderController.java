package lab.orders;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lab fixture — Spring MVC controller that calls into a real service layer
 * (OrderService), a shape java-spring-payments doesn't cover (its
 * PaymentController has no injected collaborator at all). Real call-site
 * evidence for a controller -> service `connects` relationship.
 */
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping("/{id}")
    public String getOrder(@PathVariable String id) {
        return orderService.findOrder(id);
    }

    @PostMapping
    public String createOrder(@RequestBody String order) {
        return orderService.createOrder(order);
    }
}
