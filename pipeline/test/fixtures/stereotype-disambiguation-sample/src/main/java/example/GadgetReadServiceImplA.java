package example;

import javax.persistence.Entity;
import org.springframework.stereotype.Service;

/** First of TWO real, both-stereotype-carrying implementers — genuinely ambiguous, must refuse. */
@Service
@Entity
public class GadgetReadServiceImplA implements GadgetReadService {

    @Override
    public String retrieveAll() {
        return "gadgets-a";
    }
}
