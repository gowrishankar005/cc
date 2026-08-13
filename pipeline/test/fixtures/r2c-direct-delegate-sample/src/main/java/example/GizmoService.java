package example;

/**
 * Deliberately a PLAIN class, no interface, no @Entity, no driver import,
 * no catalogue evidence of its own — a common Spring idiom (service
 * injected and called directly, no interface abstraction). Imports exactly
 * ONE real entity directly — the T-LR-2 shape.
 */
public class GizmoService {

    private final GizmoEntity entity;

    public GizmoService(GizmoEntity entity) {
        this.entity = entity;
    }

    public String retrieveAll() {
        return entity.toString();
    }
}
