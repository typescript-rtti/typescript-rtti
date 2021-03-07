# v0.0.13

**Features**
- support union and intersection types. In place of a Function type you get `{ kind: 'union', types: [...] }` or `{ kind: 'intersection', types: [...] }`.

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