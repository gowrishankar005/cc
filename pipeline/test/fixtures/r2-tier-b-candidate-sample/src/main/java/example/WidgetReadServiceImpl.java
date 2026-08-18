package example;

import javax.persistence.Entity;
import javax.persistence.Table;

/**
 * The REAL store implementer — same isolation-test convention as
 * r2-bridge-sample's own WidgetReadServiceImpl (an interface implementation
 * that is also a JPA @Entity is architecturally unusual; this is a
 * synthetic isolation test, not a realistic code sample). The tier-b
 * mechanism must find exactly this one candidate among the two syntactic
 * implementers of WidgetReadService.
 */
@Entity
@Table(name = "widgets")
public class WidgetReadServiceImpl implements WidgetReadService {

    @Override
    public String retrieveAll() {
        return "widgets";
    }
}
