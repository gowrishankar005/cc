package example.domain;

import javax.persistence.Entity;

/**
 * A real, legitimate same-package reference — genuinely references Helper
 * (same package, no import statement needed in Java). Proves the
 * bare-name-collision fix does not over-suppress this common, correct case:
 * findJavaImportForBareName finds no import for "Helper" here, so the
 * collision check must leave this edge untouched.
 */
@Entity
public class OrderService {
    private Helper helper;
}
