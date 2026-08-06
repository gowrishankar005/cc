package lab.charges;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;

/**
 * Lab fixture — JPA Charge entity (Fineract-shaped).
 */
@Entity
@Table(name = "m_charge")
public class Charge {
    @Id
    private Long id;

    @Column(name = "name")
    private String name;

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }
}
