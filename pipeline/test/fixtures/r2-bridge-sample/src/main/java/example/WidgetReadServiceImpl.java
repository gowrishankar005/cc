package example;

import javax.persistence.Entity;
import javax.persistence.Table;

/**
 * Sole implementer of WidgetReadService. Carries real persistence evidence
 * via the already-proven JPA @Entity decorator path (signal-catalogue.yml's
 * jpa-entity rule) — deliberately NOT the Graphify driver-import path
 * (persistence-detection-catalogue.yml's org.postgresql row), which is a
 * separate, pre-existing, unrelated gap: Graphify normalizes a Java
 * `import org.postgresql.Driver;` to the imported SYMBOL's name ("driver"),
 * not the qualified package ("org.postgresql"), so that catalogue row has
 * never actually been exercised end-to-end via Graphify for Java (still
 * `evidenceLevel: unverified` there, same as before this fixture). Using
 * @Entity here isolates THIS fixture's actual purpose — proving the R2
 * bridge-detector traversal itself works when the terminal unit is real —
 * from that separate, already-honestly-disclosed limitation. (An interface
 * implementation also being a JPA entity is architecturally unusual; this
 * fixture is a synthetic isolation test, not a realistic code sample.)
 */
@Entity
@Table(name = "widgets")
public class WidgetReadServiceImpl implements WidgetReadService {

    @Override
    public String retrieveAll() {
        return "widgets";
    }
}
