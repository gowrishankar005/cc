package example.domain;

import javax.persistence.Entity;

/** A real, unrelated JPA entity in the SAME package as OrderService below — genuinely referenced by it, no import needed. */
@Entity
public class Helper {
    private String id;
}
