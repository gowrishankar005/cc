/**
 * @name Spring DI resolution: interface field -> real implementation
 * @description Generic mechanism class (not keyed to any sample-repo name):
 *   for every `final` field typed as an interface (the real shape Lombok's
 *   @RequiredArgsConstructor + Spring constructor injection produces, no
 *   @Autowired needed), resolve the interface to its real Spring-registered
 *   implementation via either of two real, distinct wiring conventions:
 *   (a) a class implementing the interface carries a stereotype annotation
 *       (@Service/@Component/@Repository/@Controller);
 *   (b) a @Bean-annotated method inside a @Configuration class declares the
 *       interface as its return type and its body directly returns a `new`
 *       instance of a concrete implementation.
 * @kind table
 * @id java/di-resolution
 */
import java

class StereotypeAnnotationType extends AnnotationType {
  StereotypeAnnotationType() {
    this.hasQualifiedName("org.springframework.stereotype", ["Service", "Component", "Repository", "Controller"])
  }
}

class ConfigurationAnnotationType extends AnnotationType {
  ConfigurationAnnotationType() {
    this.hasQualifiedName("org.springframework.context.annotation", "Configuration")
  }
}

class BeanAnnotationType extends AnnotationType {
  BeanAnnotationType() { this.hasQualifiedName("org.springframework.context.annotation", "Bean") }
}

/** Mechanism (a): interface implemented by a class carrying a real stereotype annotation. */
predicate stereotypeResolution(Interface iface, RefType impl) {
  impl.getASupertype() = iface and
  impl.getAnAnnotation().getType() instanceof StereotypeAnnotationType
}

/** Mechanism (b): interface returned by a @Bean factory method inside a @Configuration class, whose body directly returns a `new` instance. */
predicate beanFactoryResolution(Interface iface, RefType impl) {
  exists(Method beanMethod, ReturnStmt ret, ClassInstanceExpr newExpr |
    beanMethod.getAnAnnotation().getType() instanceof BeanAnnotationType and
    beanMethod.getDeclaringType().getAnAnnotation().getType() instanceof ConfigurationAnnotationType and
    beanMethod.getReturnType() = iface and
    ret.getEnclosingCallable() = beanMethod and
    ret.getResult() = newExpr and
    impl = newExpr.getConstructedType()
  )
}

/**
 * Real finding running this against Fineract: LockingService has TWO real
 * @Bean factory methods in different @Configuration classes
 * (retrieveLoanLockingService() -> LoanLockingServiceImpl,
 * workingCapitalLoanLockingService() -> WorkingCapitalLoanLockingServiceImpl),
 * each guarded by @ConditionalOnMissingBean(name = "...") -- genuinely
 * runtime-conditional bean registration no static query can safely resolve.
 * A naive "exists" join would non-deterministically pick one; this
 * pipeline's own discipline (R2/R2b/R2c) is never guess on real ambiguity
 * -- refuse instead. Same requirement here: an interface with 2+ DIFFERENT
 * bean-factory-resolved implementations must never resolve to either.
 */
predicate ambiguousBeanFactory(Interface iface) {
  count(RefType impl | beanFactoryResolution(iface, impl)) > 1
}

/**
 * Real finding: Tasklet (Spring Batch's generic marker interface, ~10 real
 * unrelated implementers -- each its own named bean, never structurally
 * distinguishable by type alone), ContentStoreService/ExternalEventProducer/
 * NotificationEventPublisher (real @Profile-style runtime-conditional
 * alternates, same shape as the LockingService bean-factory case above),
 * LoanRescheduleRequestDataValidator (2 real stereotype-annotated
 * implementers). Same "never guess" requirement as bean-factory ambiguity.
 */
predicate ambiguousStereotype(Interface iface) {
  count(RefType impl | stereotypeResolution(iface, impl)) > 1
}

from RefType owner, Field f, Interface iface, RefType impl, string mechanism
where
  f.getDeclaringType() = owner and
  f.isFinal() and
  f.getType() = iface and
  (
    stereotypeResolution(iface, impl) and mechanism = "stereotype" and not ambiguousStereotype(iface)
    or
    beanFactoryResolution(iface, impl) and mechanism = "bean-factory" and not ambiguousBeanFactory(iface)
  )
select owner.getName() as injectingClass, f.getName() as fieldName, iface.getName() as interfaceType, impl.getName() as resolvedImpl, mechanism,
  owner.getFile().getRelativePath() as injectingFile, impl.getFile().getRelativePath() as implFile
