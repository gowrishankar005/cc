package example;

/**
 * A second, real implementer of WidgetReadService that carries NO
 * persistence/messaging/HTTP/security-control evidence of its own — the
 * syntactic noise this fixture's tier-b mechanism must see through. Never
 * becomes a TypedUnit at all (no evidence to hang one on), which is exactly
 * why a raw implementer count alone (2) would previously have looked
 * identical to genuine ambiguity.
 */
public class WidgetReadServiceMock implements WidgetReadService {

    @Override
    public String retrieveAll() {
        return "mock-widgets";
    }
}
