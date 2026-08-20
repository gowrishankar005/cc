package lab.orders;

import org.springframework.stereotype.Service;
import javax.persistence.EntityManager;

/**
 * Lab fixture — a service that owns persistence via a raw injected
 * `EntityManager`, never an `@Entity`-annotated class of its own. Real,
 * currently-uncataloged shape (see scope-limitations.yml): the persistence
 * detection catalogue dispatches driver-import and `@Entity` ownership
 * strategies, but a bare `EntityManager` field is not itself a catalogued
 * driver-import library — this class is expected to surface as a plain
 * `service` unit, not `database`, until that catalogue gap is closed.
 */
@Service
public class OrderService {

    private final EntityManager entityManager;

    public OrderService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public String findOrder(String id) {
        return entityManager.find(Object.class, id).toString();
    }

    public String createOrder(String order) {
        entityManager.persist(order);
        return order;
    }
}
