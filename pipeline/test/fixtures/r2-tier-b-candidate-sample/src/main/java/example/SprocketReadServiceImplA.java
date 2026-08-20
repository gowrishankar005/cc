package example;

import javax.persistence.Entity;
import javax.persistence.Table;

/** First of two genuinely ambiguous real store implementers. */
@Entity
@Table(name = "sprockets_a")
public class SprocketReadServiceImplA implements SprocketReadService {

    @Override
    public String retrieveAll() {
        return "sprockets-a";
    }
}
