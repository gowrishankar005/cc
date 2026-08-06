package lab.common;

/** Lab TRAP — pure helper utilities. */
public final class StringUtils {
    private StringUtils() {}

    public static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
