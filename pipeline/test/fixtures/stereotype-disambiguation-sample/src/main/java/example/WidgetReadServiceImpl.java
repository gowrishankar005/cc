package example;

import javax.persistence.Entity;
import javax.persistence.Table;
import org.springframework.stereotype.Service;

/**
 * The real, Spring-managed implementer of WidgetReadService — carries the
 * bare `@Service` stereotype this fixture exists to prove resolves
 * (spring-service-stereotype in signal-catalogue.yml), plus @Entity so the
 * terminal check (implementer IS itself a database/topic unit) also passes.
 * (An interface implementation also being a JPA entity is architecturally
 * unusual; this fixture is a synthetic isolation test, not a realistic code
 * sample — same convention as r2-bridge-sample's WidgetReadServiceImpl.)
 */
@Service
@Entity
@Table(name = "widgets")
public class WidgetReadServiceImpl implements WidgetReadService {

    @Override
    public String retrieveAll() {
        return "widgets";
    }
}
