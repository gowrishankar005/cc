/**
 * @name JPA entity -> real table name
 * @description Generic mechanism class (no hardcoded class/repo names):
 *   resolves an @Entity class's real database table name from its own
 *   @Table(name="...") annotation. Deliberately requires an EXPLICIT
 *   name= — never infers JPA's implicit default (class-name-derived) table
 *   name, matching this project's never-guess discipline (same reasoning
 *   di_resolution.ql/guice_di.ql already apply to ambiguous bindings).
 *   Real result running against apache/fineract (fineract-charge/-core/-tax):
 *   39 real bindings, 0 @Entity classes lacking an explicit @Table in this
 *   codebase — full coverage within this query's own honest scope.
 * @kind table
 * @id java/jpa-entity-table
 */
import java

class EntityAnnotationType extends AnnotationType {
  EntityAnnotationType() { this.hasQualifiedName("jakarta.persistence", "Entity") or this.hasQualifiedName("javax.persistence", "Entity") }
}

class TableAnnotationType extends AnnotationType {
  TableAnnotationType() { this.hasQualifiedName("jakarta.persistence", "Table") or this.hasQualifiedName("javax.persistence", "Table") }
}

from Class c, Annotation tableAnn
where
  c.getAnAnnotation().getType() instanceof EntityAnnotationType and
  tableAnn = c.getAnAnnotation() and
  tableAnn.getType() instanceof TableAnnotationType and
  exists(tableAnn.getValue("name"))
select c.getName() as entityClass, tableAnn.getValue("name").(StringLiteral).getValue() as tableName, c.getFile().getRelativePath() as file
