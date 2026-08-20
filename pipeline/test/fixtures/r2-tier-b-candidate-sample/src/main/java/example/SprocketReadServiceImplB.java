package example;

import javax.persistence.Entity;
import javax.persistence.Table;

/** Second of two genuinely ambiguous real store implementers. */
@Entity
@Table(name = "sprockets_b")
public class SprocketReadServiceImplB implements SprocketReadService {

    @Override
    public String retrieveAll() {
        return "sprockets-b";
    }
}
