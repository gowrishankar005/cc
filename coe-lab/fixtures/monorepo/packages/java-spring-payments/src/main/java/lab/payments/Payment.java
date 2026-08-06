package lab.payments;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;

/**
 * Lab fixture — JPA payment entity.
 */
@Entity
@Table(name = "payments")
public class Payment {
    @Id
    private String id;
    private long amountCents;

    public String getId() {
        return id;
    }

    public long getAmountCents() {
        return amountCents;
    }
}
