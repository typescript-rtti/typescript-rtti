# v0.9.3 [vNext]
- Fixes an issue with build tools which validate that namespace imports correspond to existing exports within the
  module being imported (for example Angular CLI). This causes an issue when trying to consume ESM libraries
  which were not built with Typescript RTTI.

# v0.9.2
- No changes (Previous release on NPM had a stale build caused by changes to the NPM scripts during the recent
  Jest migration.)

# v0.9.1
- Fixes type references acquired via namespace imports where the type declarations file name does not correspond
  to the Javascript file name.

# v0.9.0
- **BREAKING**: Typescript 4.7 is no longer supported. Please use Typescript 4.8-5.1 instead.
- `matchesValue()` changes
    - `matchesValue()` now accepts an `options` object instead of positional parameters
    - Adds `allowExtraProperties` option to matchesValue() to control whether extra options are allowed
    - **BREAKING**: `matchesValue()` does not allow extra properties by default.
    - Fixes https://github.com/typescript-rtti/typescript-rtti/issues/92
- Expose ambient classes/interfaces as structured types

# v0.8.3
- Updated peer dependencies to acknowledge Typescript 4.7 support
- Support inspecting properties of mapped types, and uses this metadata in matchesValue()
  > Closes https://github.com/typescript-rtti/typescript-rtti/issues/89

# v0.8.2
- Fix duplicate items in `properties`, `methods`, `staticProperties` and `staticMethods` (and the corresponding `*Names`
  properties) when reflecting on a subclass which overrides methods or properties on the superclass. Retains the
  definition ordering. ([#84](https://github.com/typescript-rtti/typescript-rtti/issues/84))

# v0.8.1
- Adds support for array/object binding expressions in function/method parameters (ie destructuring assignment)
- Fixes an issue where `type.isPromise()` returns false for `Promise<T>` (previously returned true only for bare
  `Promise`).
- Adds `isVariadic()` to `ReflectedMethod` to match the call on `ReflectedFunction`
  ([Pull Request](https://github.com/typescript-rtti/typescript-rtti/pull/77))
- Fixes an issue where metadata decorators were added twice for interfaces
  ([#79](https://github.com/typescript-rtti/typescript-rtti/issues/79))
- ~~Fixes issues where outboard decorators (ie outside of `__decorate`) were used when inline (normal) decorators would
  suffice. This makes it easier to access reflection metadata within decorators~~
  ([#76](https://github.com/typescript-rtti/typescript-rtti/issues/76))
    * This work is blocked by https://github.com/microsoft/TypeScript/issues/49794. Until then we cannot correct the
      decorator load order.

# v0.8.0
- Adds support for reflecting "rest" parameters
  ([Pull Request](https://github.com/typescript-rtti/typescript-rtti/pull/72))
- Adds support for reflecting BigInt literals
  ([Pull Request](https://github.com/typescript-rtti/typescript-rtti/pull/73))

# v0.7.4
- Fixes a crash when calling matchesValue() without an initialized `errors` array, despite the API declaration
  indicating this is allowed ([Pull Request #70](https://github.com/typescript-rtti/typescript-rtti/pull/70))
  Thanks to @CristianPi for this enhancement!

# v0.7.3
- Fixes a missed code path for enabling reflection on _declared_ function types (as opposed to only inferred ones)

# v0.7.2
- Adds missing `as('function')` overload to enable accessing `ReflectedFunctionRef`

# v0.7.1
- Fixes an issue where the emitter outputted `RtType` instead of `RtParameter` on the new function type refs added
  in 0.7.0.

# v0.7.0
- Proper support for reflecting into function types. Previously when a function type was encountered in a type position,
  `Function` was emitted similar to the behavior of traditional emitDecoratorMetadata. This new reflection includes
  return type and parameter types, and a flags field which is reserved for future use. Use the new ReflectedFunctionRef
  (`as('function')`) to access. Note that despite the new ReflectedTypeRef kind, explicit support for `isClass(Function)
  ` has been added to ensure backwards compatibility.

# v0.6.1
- Fixes an issue where RTTI assumes that the existence of a `.d.ts` file implies the existence of a corresponding `.js`
  file. Now RTTI will verify the existence of the `.js` file in environments which support such a check (Node.js
  environments). When this situation is encountered, RTTI will refuse to import the module, a type reference of type
  `Object` will be emitted instead, and a warning of the following format will be emitted:
  > RTTI: warning: Cannot import symbol 'OffendingSymbol' from declaration file 'PathToDeclaration' because there is no
  > corresponding Javascript file alongside the declaration file! Refusing to emit type references for this symbol.
- RTTI will now remove `/index.d.ts`, `/index.js` or `/index.ts` from the end of an import path when generating imports
  to obtain references to classes, interface tokens, and enum objects. This fixes issues with referring to packages which
  have `index.d.ts` at the root of the package when the entrypoint for the application is something other than `index.js`
  at the root of the package (for instance the `winston` package). See #61 for details.
- The interfaces which an interface _extends_ are now exposed via the same mechanism that we use to expose the interfaces
  that a class _implements_. You can access these type references via `ReflectedClass#interfaces` when the `ReflectedClass`
  represents an `interface`. See #60 for details.
- Fixes an issue when referring to enums declared within function statements / expressions. See #57 for details.
- Fixes enum support to properly handle const enums.

# v0.6.0
- Adds support for reflecting properly on enums. Previously enums were emitted as unions of the numeric values of the
  enum. See [issue #53](https://github.com/typescript-rtti/typescript-rtti/issues/53)
- Fixes an issue where the annotations for method/property/static method/static property names were not emitted if there
  was no methods/properties/static methods/static properties. This would cause the reflection library to fall back to
  property inference when it was unnecessary, causing unexpected execution of properties with getters. See
  [issue #52](https://github.com/typescript-rtti/typescript-rtti/issues/52)
- Fixes an issue where getters would be invoked while inferring properties and methods on unannotated classes. This may
  mean that some properties you might consider "methods" are listed as properties instead, but executing the getter could
  have unintended side effects, and may also crash if `this` is referenced (which is common).
- Fixes a bug where using `reflect()` or `reify()` within a constructor caused the transformer to crash. See
  [issue #54](https://github.com/typescript-rtti/typescript-rtti/issues/54)
- Adds support for `@rtti:skip` to disable RTTI generation for specific parts of a codebase. This JSDoc can
  be applied to any node that TS supports JSDocs on (which is more than you might think). Can be very useful
  to work around problems or to isolate which part of your codebase is causing a crash in the transformer.
  We use this internally to allow typescript-rtti's test suite to be roundtripped within the "corpus" test
  suite.

# v0.5.6
- Fixes a bug when referring to interfaces that do not have tokens (because they were not compiled with the transformer)
  This bug exhibits as: `Cannot read properties of undefined (reading 'RΦ')`. See #48

# v0.5.5
- Adds support for object literal type references

# v0.5.4
- Fixes issues where synthetic imports are hoisted to the top of the file,
  which particularly can cause problems when `reflect-metadata` or other
  "must import first" imports are present in the file

# v0.5.3
- Adds `ReflectedTypeRef#equals()` (and the supporting protected `ReflectedTypeRef#matches()` family of functions) for
  comparing type references for equivalence.

# v0.5.2
- Fixes some failures where array types are used with `noLib` enabled
- Ensures that `Object` will be emitted when encountering types with missing symbols
- Provide better DX for cases where `noLib` causes problems
- Fixes numerous issues with `design:*` metadata and how RTTI handles importing classes
  for those
- RTTI's global detection is now much more reliable, preventing issues where RTTI tries to
  import a symbol from a declaration-only location when it is not required (for instance `Buffer`
  in Node.js).

# v0.5.1
- Fix for bug when accessing a type reference for a default-exported interface

# v0.5.0
- Fixes for intrinsic type checks (isNull(), isUndefined(), isTrue(), isFalse())
- Tighten type assertions in the reflection API to reduce
  easy mistakes

# v0.4.19
- Fix for the new `@rtti:callsite 1` JSDoc optin

# v0.4.18
- Fix for using `require()` for Node-specific imports breaks webpack builds though they are properly guarded (so that
  the transformer can work properly in the browser)

# v0.4.17
- Add support for `@rtti:callsite` JSDoc tag as a way to opt in to receiving call-site reflection data
  without directly referencing `typescript-rtti` types (useful for third parties to opt in and introspect on
  typescript-rtti's metadata). This will be important for the new `@typescript-rtti/reflect` library.
- Overhauls handling of classes/interfaces defined external to the file being processed. This fixes a number of cases
  which were previously broken, such as those noted by #27 and #28. The transformer is now aware of `node_modules` in a
  much better way which can analyze `package.json` to simplify imports in cases where the best import found is the
  entrypoint of the library you are using (for instance import from `graphql` instead of `graphql/index`). These changes
  are important to ensure that typescript-rtti does not cause dependencies on private details (ie filesystem layout) of
  packages, as those may change version-to-version without a semver major bump.
- Fixes issues where typescript-rtti tries to import interface tokens (`IΦ*`) from the Typescript standard library in the
  vain hope that they exist.

# v0.4.16
- Do not emit for `declare class`
- Fixes issues where legacy metadata (`design:*`) was output without generating a suitable import, leading to `TypeError`
  at runtime

# v0.4.15
- Fix for compile-time crash when mapped type has no `aliasTypeArguments`
- Fix for properties which use a string literal name
- Add missing support for class expressions
- Add missing support for private identifiers (`#foo`)

# v0.4.14
- Support for metadata on properties with computed names (including symbols)

# v0.4.13
- Added `reflect-metadata` as a peer dependency. It has always been required for the correct operation of
  the transformer, but the peer dependency was missing until this version.

# v0.4.12
- Additional checks for bad `design:paramtypes` emit

# v0.4.11
- Guard at runtime for bad `design:paramtypes` emit and ensure `parameters` always returns
  an array even if no metadata sources are available.

# v0.4.10
- Support for reflecting on primitive values (number, boolean, string, etc)

# v0.4.9
- Fixes a bug where initializers did not work correctly

# v0.4.8
- Fixes a bug where constructor parameters did not emit type information when inferred (instead of defined explicitly)

# v0.4.7
- Fixes a bug where ReflectedMethod.for(function) failed to resolve the `rt:h` type resolver, producing
  incorrect results.

# v0.4.6
- Reflected parameters now have an `index` property for convenience.
- Reflected parameters now have appropriate `parent` properties
- Reflected parameters involving a class (constructor/method parameters) now have `class` properties.

# v0.4.5
- Fixes issues where external interfaces were imported using absolute file paths
  which produced builds that could not be moved
- Fixes issues where classes/interfaces defined within functions would not be properly accessible via reflection
  due to the per-file type store changes.

# v0.4.4

- Allow `ReflectedTypeRef#isInterface()` without passing an interface token
- Added `metadata()` convenience function to `ReflectedClass`, `ReflectedMember` and `ReflectedFunction`. This method
  allows you to get or create a metadata key on the reflected target.
- Modified `defineMetadata()` on `ReflectedMember`, `ReflectedFunction` to return the value of the new metadata item
  for consistency with the corresponding method on `ReflectedClass`. Previously these methods returned nothing.

# v0.4.3
- Fixes an issue where matchesValue() behavior for union/intersection was swapped
- Fixes an issue where the isOptional flag was not emitted properly for properties/methods
- Fixes an issue where interfaces did not wrap metadata declarations in ExpressionStatement leading to
  automatic semicolon insertion (ASI) bugs. This was previously fixed but only for classes.

# v0.4.2
- Fixes a bug where reflect(ClassConstructor) becomes confused due to injected callSite object

# v0.4.1
- Fixes a bug where nested calls were not checked for call-site reflection.

# v0.4.0
- **Breaking**: `reflect<T>()` now returns `ReflectedTypeRef`. This enables the generic `T` parameter to be any
  reflectable type, for instance `reflect<string | number>()` or `reflect<123>()`.

# v0.3.0
- Added call-site reflection: Reflect on the type information at the location where your function is called

# v0.2.1
- Fixes an issue where `RtAnyRef#kind` reported `unknown` instead of `any`
- Add ability to detect whether a return type is inferred or explicit (#16)

# v0.2.0
- Fixes an issue where the value of `emitDecoratorMetadata` was lost and reset to `false` when run within `ts-jest`
- Properly emits for inferred async return types
- Fix: the name of function expressions assigned to property and variable declarations are now retained when they are
  annotated.
- Fixed handling of inferred generic types
- Added missing handling for property get/set accessors
- String-like and number-like return types (enums mainly) now emit the appropriate type for `design:returntype`
- Fixed an issue where `this` parameters were included in parameter lists unintentionally, including in
  `design:paramtypes`
- Revised emit to create a `__RΦ` object containing the metadata and function annotation helpers instead of `__RtΦ` and
  `__RfΦ` respectively
- **Enabled emitting of recursive types**
  This was done by revising emit to use the `__RΦ` object as a central store of type information for the current file,
  with the element-level metadata accessing this metadata as needed.
  NOTE: **This change is backwards compatible**
  - As a side effect of this change, the total byte size of emitted metadata should be heavily reduced, with files
    containing many identical type references seeing the largest benefits.

# v0.1.3
- Fixes an additional case where `null` was used instead of `undefined` when generating typescript AST elements

# v0.1.2
- Fixes an issue where `null` was used instead of `undefined` on the forward reference arrow functions. This could cause
  problems when using typescript-rtti in concert with other transformers (for instance, when using `ts-jest`)

# v0.1.0
- Minimum Typescript version is now 4.5.5
- Minimum Node.js version is now v14
- The test suite now builds `razmin`, `@astronautlabs/bitstream`, and `typescript-rtti` (itself) using its own
  transformer and the test suites of those libraries successfully pass (corpus testing). Additional libraries are on
  the roadmap for being included in the test corpus including `@alterior-mvc/alterior` and `@astronautlabs/jwt`.
  Accepting PRs for additional libraries to include in the test suite.
- Found and fixed as part of corpus testing:
    - Removed emitting of `design:*` metadata where Typescript does not emit it to better match semantics and fix
      compilation issues
    - forward references in interface methods caused build failures with emitDecoratorMetadata compatibility
    - numerous corner case build issues discovered through corpus testing
    - metadata was not emitted for elements within function expressions and arrow functions
    - emitDecoratorMetadata compatibility producing different results from the standard implementation
    - metadata definition statements were emitted as expressions (ie without semicolons) leading to incorrect JS output
- Transformer is now considered stable for build with any codebase. Please file an issue if you receive a compilation
  failure.

# v0.0.23
- Arrow functions and function expressions are now supported
- Reflected flags are now used to determine what kind of value is being passed to `reflect(value)`. This enables
  differentiating between functions and classes according to their flags. For functions without RTTI, reflect() returns
  `ReflectedClass` (instead of `ReflectedFunction`) because there is no way to determine at runtime (without RTTI)
  whether a `function` expression is a plain function or a constructor. Use `ReflectedFunction.for(value)` instead if
  you know the value is intended to be a regular function, as opposed to a constructor. Note that arrow functions do
  not have this issue as they are not constructable, and thus they have no prototype.
- `reflect(value)` now has better typed overrides to clarify what kind of value you will get back depending on what
  value you pass in
- You can now obtain `ReflectedMethod` directly from a method function, even without knowing what class it belongs to.
  For instance:
  ```typescript
  class A {
    foo() { }
  }

  expect(reflect(A.foo)).to.be.instanceOf(ReflectedMethod)
  expect(reflect(A.foo).class).to.equal(reflect(A))
  ```
- Fixes a failure when no return type inference is available on a function declaration

# v0.0.22

- [Breaking] `ReflectedFunction#rawParameterMetadata` and `ReflectedProperty#rawParameterMetadata` are now marked
  `@internal`. `RawParameterMetadata` is no longer exported. Use `parameterNames` and `parameterTypes` instead and
  avoid relying on the underlying RTTI metadata.
- [Breaking] `isPrivate`, `isPublic` and `isProtected` accessors on `ReflectedClass` are removed. These were always
  false.
- Adds support for emitting static method/property lists (rt:SP and rt:Sm)
- Improved documentation
- [Breaking] The public flag (`F_PUBLIC`, `$`) is no longer emitted if the method or property is not explicitly marked
  public.
- `ReflectedMember#isPublic` now returns true if no visibility flags are present (ie default visibility).
- Added `ReflectedMember#isMarkedPublic` to check if a member is specifically marked public.
- Added support for parameter initializers (ie default values). Note that care should be taken when evaluating
  initializers
  because they may depend on `this`. `evaluateInitializer(thisObject)` is provided to make this simpler.

# v0.0.21
- Support more inferred types (class/interface/union/intersection)
- Support function return type / parameter types
- Support reflecting on abstract methods
- Support the abstract flag on methods
- Support async flag on methods and functions
- Emit the interface flag on interfaces

# v0.0.20

- Added support for `void` type
- Breaking: You must now use ReflectedClass.for(MyClass) instead of new ReflectedClass(MyClass)
- Instances of ReflectedClass are now cached and shared. As a result all
  instances of ReflectedClass are now
  [sealed](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/seal)
- Breaking: `ReflectedMethod#parameterTypes` now has type `ReflectedTypeRef[]`
  which allows them to express the full range of types possible. Previously the raw type refs (for instance type
  resolvers such as `() => String`) was returned here which inappropriately exposed the underlying metadata format.
- Added support for is() type predicates and as() casting to `ReflectedTypeRef`
  for ease of use
- Added several more variants of `ReflectedTypeRef` to match how the
  capabilities of the library have evolved
- `ReflectedMethod#parameterTypes` can now source metadata from `design:paramtypes`
- Support for interfaces, use `reify<MyInterface>()` to obtain interface tokens
- Added `reflect<MyInterface>()`, `reflect(MyClass)`, `reflect(myInstance)` shortcuts for obtaining
  `ReflectedClass` instances

# v0.0.19

- Added better handling for literal types to `ReflectedClass`.
    * You can now expect `isClass(Boolean)` to be true for types `true` and `false`, `isClass(Object)` to be true for
      `null`, `isClass(Number)` to be true for numeric literals and `isClass(String)` to be true for string literals.
    * Added `isLiteral(value)` to check for a literal value
- Fixed a bug where all unknown types were reported as `Boolean`
- Added support for `undefined` type
- Added a number of helpers for checking for literal types to `ReflectedTypeRef`

# v0.0.18

- Added support for type literal types, ie `foo(bar : false, baz : null, foobar : 123)`

# v0.0.17

- Fix: do not crash when property has no type
  (https://github.com/rezonant/typescript-rtti/commit/474eddf15160457e57a786f0c67918e99a11d8c2)

# v0.0.15

**Features**
- Added support for serializing generic types including their type arguments. This means you can now obtain the type of
  a `Promise` for instance (provided that the referenced type has a value at runtime). Additionally, cases where the
  type references an interface, and that interface has type parameters will now emit a generic type which exposes the
  types of the parameters, even if the interface itself does not have a runtime value. For instance
  `InterfaceA<InterfaceB>` would emit a generic type with base type `Object` and one parameter type of `Object`.

**Breaking**
- Made the structure of the `RtTypeRef` family of interfaces internal along with creation of `ReflectedTypeRef` and its
  `ref` property. Technically this is a breaking change, but these interfaces have only been exposed since v0.0.14

# v0.0.14

**Breaking**
- changes emission of union, intersection
  * sample input: `string | number`
  * before: `{ kind: 'union', types: [String, Number] }`
  * after: `{ TΦ: T_UNION, t: [String, Number] }`
- changes array emission to match.
  * sample input: `string[]`
  * before: `[ String ]`
  * after: `{ TΦ: T_ARRAY, e: String }`
- changes API (ie `ReflectedClass`) to properly expose type references (such as union, intersection, arrays, tuples,
  etc), not just function references

**Features**
- support for tuple types, `[ str : string, num : number ]` emits
  `{ TΦ: T_TUPLE, e: [ { n: 'str', t: String }, { n: 'num', t: Number } ] }`

# v0.0.13

**Features**
- support union and intersection types. In place of a Function type you get `{ kind: 'union', types: [...] }` or
  `{ kind: 'intersection', types: [...] }`.
- support reading design:* metadata via ReflectedClass, ReflectedProperty, ReflectedMethod
- support for static methods/properties
# v0.0.11

**Fixes**
- emitDecoratorMetadata reverts to false on multi-file projects causing most `design:*` metadata not to be emitted
- prepending require() on a property access expression did not work in all cases
- crash when an unsupported type reference is encountered (emit `Object` instead and print a warning)
- runtime crash when an interface is returned (emit `Object` instead of a reference to a non-runtime identifier)
- runtime crash when a type paramter is returned (emit `Object` instead of a reference to a non-runtime identifier)
- now uses TypeReferenceSerializationKind to determine if a type has a value. Unfortunately this is a TS internal
  feature which means it may change out from under us on future TS versions

**Features**
- support `any` (emit `Object`)
- support `Function` (emit `Function`)
- improve failure handling: print the file which caused an error to help the project author tell us what we need to fix

**Tests**
- tests now include TS libraries for ensuring we handle builtin types correctly
- using the `trace: true` option of `runSimple` now outputs typescript diagnostics for better debugging
- more tests for primitive types and `unknown`