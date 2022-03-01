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
- **Breaking**: `reflect<T>()` now returns `ReflectedTypeRef`. This enables the generic `T` parameter to be any reflectable
  type, for instance `reflect<string | number>()` or `reflect<123>()`.

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
- Revised emit to create a `__RΦ` object containing the metadata and function annotation helpers instead of `__RtΦ` and `__RfΦ` respectively
- **Enabled emitting of recursive types**  
  This was done by revising emit to use the `__RΦ` object as a central store of type information for the current file, with the element-level metadata accessing this metadata as needed. 
  NOTE: **This change is backwards compatible**  
  - As a side effect of this change, the total byte size of emitted metadata should be heavily reduced, with files containing many identical type references seeing the largest benefits.

# v0.1.3
- Fixes an additional case where `null` was used instead of `undefined` when generating typescript AST elements

# v0.1.2
- Fixes an issue where `null` was used instead of `undefined` on the forward reference arrow functions. This could cause
  problems when using typescript-rtti in concert with other transformers (for instance, when using `ts-jest`)

# v0.1.0
- Minimum Typescript version is now 4.5.5
- Minimum Node.js version is now v14
- The test suite now builds `razmin`, `@astronautlabs/bitstream`, and `typescript-rtti` (itself) using its own transformer and the test suites of those libraries successfully pass (corpus testing). Additional libraries are on the roadmap for being included in the test corpus including `@alterior-mvc/alterior` and `@astronautlabs/jwt`. Accepting PRs for additional libraries to include in the test suite.
- Found and fixed as part of corpus testing: 
    - Removed emitting of `design:*` metadata where Typescript does not emit it to better match semantics and fix compilation issues
    - forward references in interface methods caused build failures with emitDecoratorMetadata compatibility
    - numerous corner case build issues discovered through corpus testing
    - metadata was not emitted for elements within function expressions and arrow functions
    - emitDecoratorMetadata compatibility producing different results from the standard implementation
    - metadata definition statements were emitted as expressions (ie without semicolons) leading to incorrect JS output
- Transformer is now considered stable for build with any codebase. Please file an issue if you receive a compilation failure.

# v0.0.23
- Arrow functions and function expressions are now supported
- Reflected flags are now used to determine what kind of value is being passed to `reflect(value)`. This enables 
  differentiating between functions and classes according to their flags. For functions without RTTI, reflect() returns
  `ReflectedClass` (instead of `ReflectedFunction`) because there is no way to determine at runtime (without RTTI)
  whether a `function` expression is a plain function or a constructor. Use `ReflectedFunction.for(value)` instead if 
  you know the value is intended to be a regular function, as opposed to a constructor. Note that arrow functions do 
  not have this issue as they are not constructable, and thus they have no prototype.
- `reflect(value)` now has better typed overrides to clarify what kind of value you will get back depending on what value
  you pass in
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
- [Breaking] The public flag (`F_PUBLIC`, `$`) is no longer emitted if the method or property is not explicitly marked public.
- `ReflectedMember#isPublic` now returns true if no visibility flags are present (ie default visibility).
- Added `ReflectedMember#isMarkedPublic` to check if a member is specifically marked public.
- Added support for parameter initializers (ie default values). Note that care should be taken when evaluating initializers
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
  instances of ReflectedClass are now [sealed](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/seal)
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

- Fix: do not crash when property has no type (https://github.com/rezonant/typescript-rtti/commit/474eddf15160457e57a786f0c67918e99a11d8c2)

# v0.0.15

**Features**
- Added support for serializing generic types including their type arguments. This means you can now obtain the type of a `Promise` for instance (provided that the referenced type has a value at runtime). Additionally, cases where the type references an interface, and that interface has type parameters will now emit a generic type which exposes the types of the parameters, even if the interface itself does not have a runtime value. For instance `InterfaceA<InterfaceB>` would emit a generic type with base type `Object` and one parameter type of `Object`.

**Breaking**
- Made the structure of the `RtTypeRef` family of interfaces internal along with creation of `ReflectedTypeRef` and its `ref` property.
  Technically this is a breaking change, but these interfaces have only been exposed since v0.0.14

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
- changes API (ie `ReflectedClass`) to properly expose type references (such as union, intersection, arrays, tuples, etc), not just function references

**Features**
- support for tuple types, `[ str : string, num : number ]` emits `{ TΦ: T_TUPLE, e: [ { n: 'str', t: String }, { n: 'num', t: Number } ] }`

# v0.0.13

**Features**
- support union and intersection types. In place of a Function type you get `{ kind: 'union', types: [...] }` or `{ kind: 'intersection', types: [...] }`.
- support reading design:* metadata via ReflectedClass, ReflectedProperty, ReflectedMethod
- support for static methods/properties
# v0.0.11

**Fixes**
- emitDecoratorMetadata reverts to false on multi-file projects causing most `design:*` metadata not to be emitted
- prepending require() on a property access expression did not work in all cases
- crash when an unsupported type reference is encountered (emit `Object` instead and print a warning)
- runtime crash when an interface is returned (emit `Object` instead of a reference to a non-runtime identifier)
- runtime crash when a type paramter is returned (emit `Object` instead of a reference to a non-runtime identifier)
- now uses TypeReferenceSerializationKind to determine if a type has a value. Unfortunately this is a TS internal feature
  which means it may change out from under us on future TS versions

**Features**
- support `any` (emit `Object`)
- support `Function` (emit `Function`)
- improve failure handling: print the file which caused an error to help the project author tell us what we need to fix

**Tests**
- tests now include TS libraries for ensuring we handle builtin types correctly
- using the `trace: true` option of `runSimple` now outputs typescript diagnostics for better debugging
- more tests for primitive types and `unknown`