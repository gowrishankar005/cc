package example;

import javax.persistence.Entity;
import org.springframework.stereotype.Service;

/** Second of TWO real, both-stereotype-carrying implementers — genuinely ambiguous, must refuse. */
@Service
@Entity
public class GadgetReadServiceImplB implements GadgetReadService {

    @Override
    public String retrieveAll() {
        return "gadgets-b";
    }
}
