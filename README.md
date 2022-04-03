# ![typescript-rtti](logo-long.svg)
[![Version](https://img.shields.io/npm/v/typescript-rtti.svg)](https://www.npmjs.com/package/typescript-rtti)
[![CircleCI](https://circleci.com/gh/typescript-rtti/typescript-rtti/tree/main.svg?style=shield)](https://circleci.com/gh/typescript-rtti/typescript-rtti/tree/main)

[Try it now](https://typescript-rtti.org) |
[NPM](https://npmjs.com/package/typescript-rtti) |
[Github](https://github.com/typescript-rtti/typescript-rtti)

> **Status:**
> This software is _release candidate_ quality
> - Transformer: Expect **all** codebases to build and operate the same as when the transformer is not present. **Please** file a bug if you cannot build your codebase with the transformer enabled. All types are supported and emitted (except for mapped types).
> - Reflection API: Stable, expect only rare breaking changes on the way to major-stable semver.

A Typescript transformer to implement comprehensive runtime type information (RTTI).

- **Comprehensive**: supports emission for a large amount of Typescript concepts
- **Well tested**: [70% coverage total](https://311-344946834-gh.circle-artifacts.com/0/coverage/lcov-report/index.html) (59% on `reflect`, 86% on transformer). Test suite includes multiple complex
  codebases to ensure correct compilation
- **Modern**: supports both ES modules and CommonJS (ES5 - ES2020)
- **Isomorphic**: works in the browser, Node.js and other runtimes (Deno?)
- **Compatible** with existing `design:*` metadata

# Projects using typescript-rtti
Send a pull request to feature your project!
- [phantomdi](https://github.com/rezonant/phantomdi) -- A dependency injector using runtime type information
  with advanced features like dynamic alterations of injectables

# Examples

Classes

```typescript
class User {
    id : number;
    username? : string;
    protected favoriteColor? : number | string;
    doIt() { return 123; }
}

reflect(User)
    .getProperty('favoriteColor')
    .type.is('union');
    // => true

reflect(User)
    .getMethod('doIt')
    .type.isClass(Number);
    // => true
```

Interfaces

```typescript
interface User {
    id : number;
    username? : string;
    protected favoriteColor? : number | string;
    doIt() { return 123; }
}

reflect<User>().as('interface')
    .reflectedInterface
    .getProperty('username')
    .isOptional
    // => true
```

Functions

```typescript
function foo(id : number, username : string, protected favoriteColor? : number | string) {
    return id;
}

reflect(foo)
    .getParameter('username')
    .type.isClass(String)
    // => true

reflect(foo)
    .getParameter('favoriteColor')
    .type.is('union')
    // => true
```

Call sites

```typescript
import { CallSite } from 'typescript-rtti';
function foo<T>(num : number, callSite? : CallSite) {
    reflect(callSite)
        .typeParameters[0]
        .isClass(Boolean)
        // => true

    reflect(callSite)
        .parameters[0]
        .isClass(Number)
        // => true

    reflect(callSite)
        .parameters[0]
        .is('literal')
        // => true

    reflect(callSite)
        .parameters[0].as('literal')
        .value
        // => 123
}

// The call-site type information is automatically serialized

foo<Boolean>(123);
```

More examples:

```typescript
import { reflect } from 'typescript-rtti';

class A {
    constructor(
        readonly someValue : Number,
        private someOtherValue : string
    ) {
    }
}

class B {
    private foo : A;
    bar = 123;
    baz(): A {
        return this.foo;
    }
}

let aClass = ;
reflect(A).parameterNames                        // => ["someValue", "someOtherValue"]
reflect(A).parameters[0].name                    // => "someValue"
reflect(A).getParameter('someValue').type        // => Number
reflect(A).getParameter('someOtherValue').type   // => String

let bClass = reflect(B);
reflect(B).propertyNames                         // => ["foo", "bar"]
reflect(B).getProperty('foo').type               // => A
reflect(B).getProperty('foo').visibility         // => "private"
reflect(B).getProperty('bar').type               // => Number
reflect(B).methodNames                           // => [baz]
reflect(B).getMethod('baz').returnType           // => A

// ...These are just a few of the facts you can introspect at runtime
```

# Setup

Prerequisites
- Typescript 4.5.5 or newer (supports Typescript 4.6!)
- Node.js v14 or newer (when using Node.js)

Installation

```
npm install typescript-rtti reflect-metadata
npm install ttypescript -D
```

Setting up `tsconfig.json`
```jsonc
// tsconfig.json
"compilerOptions": {
    "plugins": [{ "transform": "typescript-rtti/dist/transformer" }]
}
```

In order for the transformer to run during your build process, you must use `ttsc` instead of `tsc` (or use one of the case specific solutions below).

```jsonc
// package.json
{
    "scripts": {
        "build": "ttsc -b"
    }
}
```

The type information is emitted using `reflect-metadata`. You'll need to import it as early in your application as
possible and ensure that it is imported only once.

```typescript
import "reflect-metadata";
````

## **ts-node**
You can also use ts-node, just pass `-C ttypescript` to make sure ts-node uses typescript compiler which respects compiler transforms.

## **Webpack**
See [awesome-typescript-loader](https://github.com/s-panferov/awesome-typescript-loader)

## **Parcel**

Unfortunately, because Parcel processes each Typescript file individually, it is currently not possible to use RTTI for
projects that are transpiled directly by Parcel, even if you use a Parcel transformer that supports Typescript transformers.
We are actively investigating improvements to this situation, but it will likely require writing a new Parcel transformer
which builds your Typescript files as a complete compilation unit, and it is not yet clear if that is feasible given the
design decisions that Parcel has made.

In the mean time, you may be able to work around this by [first compiling using `ttsc` and then feeding the result into
Parcel](https://github.com/parcel-bundler/parcel/issues/3645#issuecomment-542309714).

## **Rollup**

Unlike Parcel, Rollup builds your Typescript files as a combined unit, so type checking, cross-file features, and
typescript-rtti work just fine when using the official Typescript plugin. Using the `sucrase` plugin is not supported.

## **Jest**
See https://github.com/rezonant/typescript-rtti-jest for a sample repo with jest setup.

# Features

- Emits metadata for the most useful elements (classes, interfaces, methods, properties, function declarations, function expressions, arrow functions) parsed by Typescript
- Emits metadata for abstract classes / methods
- Ability to evaluate parameter initializers (ie to obtain default values)
- Call-site reflection allows you to receive type information from the caller from within a function.
- Enables obtaining stable tokens for interfaces for dependency injection
- Concise and terse metadata format saves space
- Metadata format uses forward referencing via type resolvers to eliminate declaration ordering / circular reference
  issues as there is with `emitDecoratorMetadata`
- Supports reflecting on intrinsic inferred return types (ie Number, String, etc) in addition to directly specified
  types
- Supports reflecting on literal types (ie `null`, `true`, `false`, `undefined`, and literal expression types like
  `123` or `'foobar'`)
- Supports introspection of union and intersection types
- Supports array and tuple types
- Supports visibility (public, private), abstract, readonly, optional and more

# Using `reflect` API

The `reflect()` API is the entry point to all types of reflection offered by `typescript-rtti`.
- Use `reflect(ClassConstructor)` to obtain a `ReflectedClass`
- Use `reflect<Type>()` to obtain a `ReflectedTypeRef`
- Use `reflect(myFunction)` to obtain a `ReflectedFunction`
- Use `reflect(callSite)` to obtain a `ReflectedCallSite`

## Reflecting on Interfaces

`reflect<Type>()` returns a _type reference_, which could be a union type, intersection type, a class, a literal type, the
null type, or indeed, an interface type. You can narrow the returned `ReflectedTypeRef` using `is()` or `as()`.
The `is()` function is a type guard, and `as()` returns the value casted to the appropriate type as well as performing
a runtime assertion that the cast is correct.

If you want to reflect upon the properties and methods of an interface, you'll want to obtain the `reflectedInterface`:

```typescript
interface Foo {
    foo : string;
}

let reflectedInterface = reflect<Foo>().as('interface').reflectedInterface;

expect(reflectedInterface.getProperty('foo').type.isClass(String))
    .to.be.true;
```

You can encapsulate this away from users of your library using call site reflection.

# Call site Reflection

Many users are interested in passing type information in the form of a generic parameter. This is supported via
"call site reflection". The "call site" is the function call which executed the current invocation of a function.
Call site reflection allows you to reflect on both the generic and parameter types of a given function _call_ as
opposed to those defined on a function _declaration_.

This type of reflection carries a cost, not only of the serialization of the types themselves but also for the
performance of the function that accepts the call-site information. It may cause the Javascript engine to mark such
a function as megamorphic and thus ineligible for optimization. It is therefore important to ensure that functions
which wish to receive call-site information must opt in so that function calls in general retain the same performance
characteristics as when the transformer isn't used to compile a codebase.

Accepting a function parameter marked with the `CallSite` type is how `typescript-rtti` knows that call site information
should be passed to the function. When making calls from one call-site enabled function to another, `typescript-rtti`
automatically passes generic types along. Thus the following example works as expected:

```typescript
function foo<T>(call? : CallSite) {
    expect(reflect(call).typeParameters[0].isClass(String)).to.be.true;
}

function bar<T>(call? : CallSite) {
    foo<T>();
}

bar<String>();
```

# Checking the type of a value at runtime

A common use case of runtime type information is to validate that a value matches a specific Typescript type at runtime.
This functionality is built in via the `matchesValue()` API:

```typescript
interface A {
    foo: string;
    bar: number;
    baz?: string;
}

reflect<A>().matchesValue({ foo: 'hello' }) // false
reflect<A>().matchesValue({ foo: 'hello', bar: 123 }) // true
reflect<A>().matchesValue({ foo: 'hello', bar: 123, baz: 'world' }) // true
reflect<A>().matchesValue({ foo: 123, bar: 'hello' }) // false
reflect<A>().matchesValue({ }) // false
```

This works for all types that `typescript-rtti` can reflect, including unions, intersections, interfaces, classes,
object literals, intrinsics (true/false/null/undefined), literals (string/number) etc.

# Regarding `design:*`

> This library supports `emitDecoratorMetadata` but does not require it.

When you use this transformer, Typescript's own emitting of the `design:*` metadata is automatically disabled so that
this transformer can handle it instead. Note that there are limitations with this metadata format
([it has problems with forward references](https://github.com/microsoft/TypeScript/issues/27519) for one) and if/when
the Typescript team decides to further advance runtime metadata, it is likely to be changed.

Enabling `emitDecoratorMetadata` causes `typescript-rtti` to emit both the `design:*` style of metadata as well as its
own `rt:*` format. Disabling it causes only `rt:*` metadata to be emitted.

# Unsupported Scenarios

Some Typescript options are incompatible with `typescript-rtti`:

- `noLib` -- While this will work for most cases, specifically there is currently an incompatibility when dealing with
  array types because Typescript cannot look up the appropriate symbol (`Array` from `lib.d.ts`). You can work around
  this by using `Array<T>` instead of `T[]`.
- `transpileOnly` -- For build solutions which provide it note that `transpileOnly` will not work correctly as
  `typescript-rtti` relies on Typescript's semantic analysis which is not performed when performing a direct
  transpilation.

# Backward Compatibility

The library is in beta, so currently no backward compatibility is guaranteed but we are tracking back-compat breakage
in CHANGELOG.md as we approach a release with proper adherence to semver.

We do not consider a change which causes the transformer to emit a more specific type where it used to emit `Object` as
breaking backwards compatibility, but we do consider changes to other emitted types as breaking backward compatibility.

# Format

The metadata emitted has a terse but intuitive structure. Note that you are not intended to access this metadata
directly, instead you should use the built-in Reflection API (`ReflectedClass` et al).

## Class Sample

```typescript

//input

export class B {
    constructor(
        readonly a : A
    ) {
    }
}

// output

const __RΦ = {
    m: (k, v) => Reflect.metadata(k, v)
};
//...
B = __decorate([
    __RΦ.m("rt:P", ["a"]),
    __RΦ.m("rt:p", [{ n: "a", t: () => A, f: "R" }]),
    __RΦ.m("rt:f", "C$")
], B);
```

## Method Sample

```typescript

//input

export class A {
    takeShape(shape? : Shape): Shape {
        return null;
    }

    haveAnArray(myArray : string[]) {
        return 123;
    }

    naturalTypes(blank, aString : string, aNumber : number, aBool : boolean, aFunc : Function) {
        return 'hello';
    }
}

// output

//...
__decorate([
    __RΦ.m("rt:p", [{ n: "shape", t: () => ShapeΦ, f: "?" }]),
    __RΦ.m("rt:f", "M$"),
    __RΦ.m("rt:t", () => ShapeΦ)
], A.prototype, "takeShape", null);
__decorate([
    __RΦ.m("rt:p", [{ n: "myArray", t: () => [String] }]),
    __RΦ.m("rt:f", "M$"),
    __RΦ.m("rt:t", () => Number)
], A.prototype, "haveAnArray", null);
__decorate([
    __RΦ.m("rt:p", [{ n: "blank", t: () => void 0 }, { n: "aString", t: () => String }, { n: "aNumber", t: () => Number }, { n: "aBool", t: () => Boolean }, { n: "aFunc", t: () => Function }]),
    __RΦ.m("rt:f", "M$"),
    __RΦ.m("rt:t", () => String)
], A.prototype, "naturalTypes", null);
A = __decorate([
    __RΦ.m("rt:m", ["takeShape", "haveAnArray", "naturalTypes"]),
    __RΦ.m("rt:f", "C$")
], A);
```

# Why the symbols / Why not use Symbols?

The phi symbol is used on generated identifiers to prevent collisions and add a bit of difficulty for users trying to
use the metadata directly. Due to the way metadata generation works it cannot be done using private Symbols, but the
metadata generated should (to the end developer) be considered private.

# Troubleshooting / FAQ

## Q: Looks like it doesn't emit `number | null` as expected, I'm getting `Number`!
Typescript's `strictNullChecks` setting is the cause. When you have it disabled (default), `number | null`
automatically collapses to `number`. When you have it enabled, `number | null` is emitted correctly when using
`typescript-rtti`. We are [investigating](https://github.com/typescript-rtti/typescript-rtti/issues/19) how to enable
observing `number | null` without requiring `strictNullChecks` to be available, but the current behavior matches
what _Typescript_ sees.

## Q: I receive `RTTI: Failed to build source file: Cannot read properties of undefined (reading 'flags')`

There are several potential causes of this and certainly one of those potential causes is that you've discovered a bug
in the transformer. However, there are a few cases where this is known to occur in the current version:

- When you are using Parcel (see notes above)
- When you are using `noLib` (see notes above)
- When you are using `transpileOnly` (see notes above)

Ideally `typescript-rtti` should fail gracefully under these conditions, but for now it will help avoid duplicate issue
reports as the above are all already tracked in existing issues.

# Related/Similar Projects

- [https://github.com/Hookyns/tst-reflect](Hookyns/tst-reflect)
- [https://github.com/gfx/typescript-rtti](gfx/typescript-rtti) (No relation to this codebase)