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