package example;

/**
 * A SECOND real implementer of WidgetReadService, deliberately carrying NO
 * stereotype, no persistence evidence, nothing at all — the shape a
 * leftover, manually-instantiated, or non-Spring-managed alternate
 * implementation produces. This is what makes the interface's implementer
 * count 2 (previously always refused as ambiguous) rather than 1.
 */
public class WidgetReadServiceLegacyImpl implements WidgetReadService {

    @Override
    public String retrieveAll() {
        return "legacy-widgets";
    }
}
