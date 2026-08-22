/**
 * @name Sisu/JSR-330 DI resolution: interface/collection field -> real implementation(s)
 * @description Generic mechanism class (no hardcoded class/repo names): resolves
 *   three real, structurally distinct Eclipse Sisu wiring conventions found running
 *   this query against apache/maven-doxia, none of them Spring-shaped:
 *   (a) a single, unambiguous implementer of an @Inject-typed interface field,
 *       the implementer itself carrying @Named (Sisu's implicit single-binding rule);
 *   (b) a Map<String, Interface> "role-hint" field — every real implementer
 *       carrying a non-empty @Named("qualifier") becomes its own keyed binding;
 *   (c) a Collection<Interface> field — every real implementer carrying @Named
 *       (any qualifier or none) becomes its own unordered binding.
 * @kind table
 * @id java/sisu-di-resolution
 */
import java

class InjectAnnotationType extends AnnotationType {
  InjectAnnotationType() { this.hasQualifiedName("javax.inject", "Inject") }
}

class NamedAnnotationType extends AnnotationType {
  NamedAnnotationType() { this.hasQualifiedName("javax.inject", "Named") }
}

/** The real @Named qualifier string on a class, "" for a bare unqualified @Named. */
string namedQualifier(RefType t) {
  exists(Annotation a | a = t.getAnAnnotation() and a.getType() instanceof NamedAnnotationType |
    if exists(a.getValue("value")) then result = a.getValue("value").(StringLiteral).getValue() else result = ""
  )
}

/**
 * `getAnAncestor()` (transitive), not `getASupertype()` (direct only) —
 * real finding running this against maven-doxia: `XdocParser implements
 * Parser` only transitively, through several levels of abstract-class
 * inheritance (`XdocParser extends Xhtml1BaseParser extends ... extends
 * AbstractParser implements Parser`), the real, common shape for a
 * format-specific parser plugin. Direct-supertype-only silently missed
 * every real map-role-hint binding in this codebase on the first pass.
 */
predicate isNamedImplementer(Interface iface, RefType impl) {
  impl.getAnAncestor() = iface and
  impl.getAnAnnotation().getType() instanceof NamedAnnotationType
}

/** Mechanism (a): single-implementer implicit binding — refuse if genuinely ambiguous (2+ named implementers), same discipline as di_resolution.ql's stereotype/bean-factory refusal. */
predicate singleImplementerResolution(Interface iface, RefType impl) {
  isNamedImplementer(iface, impl) and
  count(RefType i | isNamedImplementer(iface, i)) = 1
}

/** The real element type of a Map<String,X>/Collection<X> field — the LAST type argument covers both shapes uniformly (Map's value, Collection's sole element). */
Interface collectionElementInterface(Field f) {
  exists(ParameterizedType pt | pt = f.getType() and result = pt.getTypeArgument(pt.getNumberOfTypeArguments() - 1))
}

from RefType owner, Field f, Interface iface, RefType impl, string mechanism, string qualifier
where
  f.getDeclaringType() = owner and
  f.getAnAnnotation().getType() instanceof InjectAnnotationType and
  (
    f.getType() = iface and singleImplementerResolution(iface, impl) and mechanism = "single-implementer" and qualifier = namedQualifier(impl)
    or
    iface = collectionElementInterface(f) and
    isNamedImplementer(iface, impl) and
    (
      (f.getType().(ParameterizedType).getSourceDeclaration().hasQualifiedName("java.util", "Map") and mechanism = "map-role-hint" and qualifier = namedQualifier(impl) and qualifier != "")
      or
      (f.getType().(ParameterizedType).getSourceDeclaration().hasQualifiedName("java.util", "Collection") and mechanism = "collection-multibind" and qualifier = namedQualifier(impl))
    )
  )
select owner.getName() as injectingClass, f.getName() as fieldName, iface.getName() as interfaceType, impl.getName() as resolvedImpl,
  mechanism, qualifier, owner.getFile().getRelativePath() as injectingFile, impl.getFile().getRelativePath() as implFile
