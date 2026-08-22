/**
 * @name Command-bus dispatch join
 * @description Generic mechanism-class join (never a hardcoded class or
 *              annotation name — OOS-sample-repo-detectors): a real
 *              registration site (any class annotated with a custom,
 *              non-java.* annotation type declaring 2+ String-typed
 *              elements, bound to compile-time-constant literal values at
 *              the use site) joined to a real lookup/dispatch site (any
 *              named method, never a constructor or compiler-synthesized
 *              initializer, assigning 2+ compile-time-constant String
 *              values to fields) whose literal key set is a SUBSET of the
 *              lookup site's own key set — and then ONE MORE real hop to
 *              the lookup method's own real CALL SITE, since the lookup
 *              method itself is typically a fluent builder utility
 *              (`CommandWrapperBuilder.createCharge()`), not the true
 *              architectural dispatcher. Registration and the real call
 *              site are required to be in different files.
 *
 *              Reconstructed from `E1-codeql-engine-evaluation.md`'s
 *              precise mechanism description — the original query
 *              (`generic_string_dispatch_join.ql`) never left gitignored
 *              `soln/`, the same real gap `di_resolution.ql` once had.
 *              **First reconstruction attempt (2026-08-22) stopped one hop
 *              too early** — it selected the lookup method's own declaring
 *              class (`CommandWrapperBuilder`) as `dispatcherClass`, not
 *              its real caller. Mechanically real (408 bindings, whole
 *              `fineract-provider` tree, a genuine second real convention
 *              `InteropWrapperBuilder` found unprompted) but wired into a
 *              live pipeline pass, EVERY row was refused: `CommandWrapperBuilder`
 *              is a plain, unannotated builder utility with zero framework
 *              signal, never independently recognized as a unit, so the
 *              `dispatcherUnit`-must-exist gate (mirroring `codeql-di-pass.ts`'s
 *              own, deliberately) silently refused all of them. This is
 *              the actual, root-cause fix, not a polish pass: added the
 *              real-call-site hop, re-verified against the same live
 *              Fineract build — the flagship chain
 *              `ChargesApiResource.createCharge() -> CreateChargeDefinitionCommandHandler`
 *              (the exact relationship `OOS-command-bus`'s own revisit
 *              trigger and this whole capability exist to resolve — see
 *              `OOS_Registry.md`) now reproduces exactly, and every
 *              dispatcher is now a real, independently-recognized REST
 *              resource class (`LoanTransactionsApiResource`,
 *              `ClientsApiResource`, etc.), not an internal utility.
 * @kind table
 * @id weaver/command-dispatch-join
 */

import java

/** A real annotation TYPE with 2+ String-typed elements — the shape @CommandType has, never named directly. */
class StringKeyedAnnotationType extends AnnotationType {
  StringKeyedAnnotationType() {
    not this.getPackage().getName().matches("java.%") and
    count(AnnotationElement e | e = this.getAnAnnotationElement() and e.getType() instanceof TypeString) >= 2
  }
}

/** A real use of a StringKeyedAnnotationType, with its String-typed elements bound to compile-time-constant literal values. */
class RegistrationSite extends Annotation {
  RegistrationSite() { this.getType() instanceof StringKeyedAnnotationType }

  string getALiteralKey() {
    exists(AnnotationElement e |
      e = this.getType().(StringKeyedAnnotationType).getAnAnnotationElement() and
      e.getType() instanceof TypeString and
      result = this.getValue(e.getName()).(CompileTimeConstantExpr).getStringValue()
    )
  }

  int getKeyCount() { result = count(this.getALiteralKey()) }
}

/**
 * A real, named method — never a constructor or compiler-synthesized
 * initializer (excludes e.g. a plain POJO's field-default-value
 * initializers, which lower to assignments inside an implicit
 * `<obinit>`/`<clinit>` and would otherwise structurally collide with this
 * same shape — a real false-positive class found and fixed in the original
 * E1 evaluation) — assigning 2+ compile-time-constant String values to
 * fields.
 */
class LookupSite extends Method {
  LookupSite() {
    not this.getName().matches("<%>") and
    count(AssignExpr ae | ae.getEnclosingCallable() = this and ae.getDest() instanceof FieldWrite and ae.getRhs() instanceof CompileTimeConstantExpr) >= 2
  }

  string getALiteralKey() {
    exists(AssignExpr ae |
      ae.getEnclosingCallable() = this and
      ae.getDest() instanceof FieldWrite and
      result = ae.getRhs().(CompileTimeConstantExpr).getStringValue()
    )
  }
}

/** A real call site that invokes a LookupSite method — the true architectural dispatcher, never the builder method's own declaring class. */
class RealDispatchCall extends MethodCall {
  RealDispatchCall() { this.getMethod() instanceof LookupSite }
}

from RegistrationSite reg, LookupSite lookup, RealDispatchCall call
where
  call.getMethod() = lookup and
  reg.getKeyCount() >= 2 and
  // Subset match, not exact-set-equality — a real dispatch call commonly
  // sets more keys than just the registration's own (e.g. a non-constant
  // `href` built from a runtime id); exact-equality silently dropped real
  // rows in the original E1 evaluation.
  forex(string key | key = reg.getALiteralKey() | key = lookup.getALiteralKey()) and
  reg.getAnnotatedElement().(RefType).getCompilationUnit() != call.getCompilationUnit()
select call.getEnclosingCallable().getDeclaringType().getName() as dispatcherClass, lookup.getName() as dispatchMethod, reg.getAnnotatedElement().(RefType).getName() as handlerClass,
  call.getCompilationUnit().getFile().getRelativePath() as dispatcherFile, reg.getAnnotatedElement().(RefType).getCompilationUnit().getFile().getRelativePath() as handlerFile
