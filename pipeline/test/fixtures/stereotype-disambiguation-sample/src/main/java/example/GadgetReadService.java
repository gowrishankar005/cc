package example;

/** Bare interface, deliberately no HTTP/persistence/messaging/security-control evidence of its own — the R2 bridge candidate shape. */
public interface GadgetReadService {
    String retrieveAll();
}
