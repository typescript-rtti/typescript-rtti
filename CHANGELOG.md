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