package example;

/** No interface, imports TWO real stores directly — the T-LR-2 ambiguity case. */
public class ThingService {

    private final ThingEntityA a;
    private final ThingEntityB b;

    public ThingService(ThingEntityA a, ThingEntityB b) {
        this.a = a;
        this.b = b;
    }

    public String retrieveAll() {
        return a.toString() + b.toString();
    }
}
