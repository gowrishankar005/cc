package example;

/**
 * Sole implementer of WidgetReadService — deliberately a PLAIN class, no
 * @Entity, no driver import, no catalogue evidence of its own (unlike
 * r2-bridge-sample's WidgetReadServiceImpl, which IS @Entity). This is the
 * R2b shape: the implementer only IMPORTS the real store directly.
 */
public class WidgetReadServiceImpl implements WidgetReadService {

    private final WidgetEntity entity;

    public WidgetReadServiceImpl(WidgetEntity entity) {
        this.entity = entity;
    }

    @Override
    public String retrieveAll() {
        return entity.toString();
    }
}
