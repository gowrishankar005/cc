package example;

/** Bare bridge interface, deliberately no HTTP/persistence/messaging/security-control evidence of its own. */
public interface WidgetReadService {
    String retrieveAll();
}
