package example;

/** Plain implementer importing TWO real stores directly — the R2b ambiguity case. */
public class GadgetReadServiceImpl implements GadgetReadService {

    private final GadgetEntityA a;
    private final GadgetEntityB b;

    public GadgetReadServiceImpl(GadgetEntityA a, GadgetEntityB b) {
        this.a = a;
        this.b = b;
    }

    @Override
    public String retrieveAll() {
        return a.toString() + b.toString();
    }
}
