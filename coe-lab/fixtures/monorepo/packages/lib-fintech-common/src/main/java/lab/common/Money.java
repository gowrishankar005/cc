package lab.common;

/**
 * Lab TRAP — shared utility. Must NOT be classified as a deployable service.
 */
public final class Money {
    private final long cents;

    public Money(long cents) {
        this.cents = cents;
    }

    public long getCents() {
        return cents;
    }

    public Money plus(Money other) {
        return new Money(this.cents + other.cents);
    }
}
