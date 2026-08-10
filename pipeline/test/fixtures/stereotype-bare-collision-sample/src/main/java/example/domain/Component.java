package example.domain;

import javax.persistence.Entity;

/**
 * A real, unrelated JPA entity that happens to share its bare name with
 * Spring's @Component annotation — matches the real evidenced shape
 * (spm/domain/Component.java, a real @Entity in the Fineract scan). Never
 * imported, referenced, or called by ChargesApiResource in any real way —
 * a relationship to this class is a false positive.
 */
@Entity
public class Component {
    private String id;
}
