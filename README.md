# ![typescript-rtti](logo-long.svg)
[![Version](https://img.shields.io/npm/v/typescript-rtti.svg)](https://www.npmjs.com/package/typescript-rtti)
[![CircleCI](https://circleci.com/gh/typescript-rtti/typescript-rtti/tree/main.svg?style=shield)](https://circleci.com/gh/typescript-rtti/typescript-rtti/tree/main)

[Try it now](https://typescript-rtti.org) |
[NPM](https://npmjs.com/package/typescript-rtti) |
[Github](https://github.com/typescript-rtti/typescript-rtti)

> **NOTE**
> This software is _beta quality_, semver 0.0.x. Transformer: Expect all codebases to build and operate the same as when the transformer is not present. Reflection API:  API is stable, expect only rare breaking changes on the way to major-stable semver.

A Typescript transformer to implement comprehensive runtime type information (RTTI).

- **Comprehensive**: supports emission for a large amount of Typescript concepts
- **Well tested**: [70% coverage total](https://311-344946834-gh.circle-artifacts.com/0/coverage/lcov-report/index.html) (59% on `reflect`, 86% on transformer). Test suite includes multiple complex 
  codebases to ensure correct compilation
- **Modern**: supports both ES modules and CommonJS (ES5 - ES2020)
- **Isomorphic**: works in the browser, Node.js and other runtimes (Deno?)
- **Compatible** with existing `design:*` metadata

# Requirements

- Typescript 4.5.5 or newer
- Node.js v14 or newer (when using Node.js)

# Introduction

```typescript

// Comprehensive support for classes

class User {
    id : number;
    username? : string;
    protected favoriteColor? : number | string;
    doIt() { return 123; }
}

expect(reflect(User).getProperty('favoriteColor').type.is('union')).to.be.true;
expect(reflect(User).getMethod('doIt').type.isClass(Number)).to.be.true;

// Interfaces

interface User {
    id : number;
    username? : string;
    protected favoriteColor? : number | string;
    doIt() { return 123; }
}

let reflectedInterface = reflect<User>().as('interface').reflectedInterface;
expect(reflectedInterface.getProperty('username').isOptional).to.be.true;

// Function declarations/expressions/arrow functions

function foo(id : number, username : string, protected favoriteColor? : number | string) {
    return id;
}

expect(reflect(foo).getParameter('username').type.isClass(String)).to.be.true;
expect(reflect(foo).getParameter('favoriteColor').type.is('union')).to.be.true;

// Call-site reflection

import { CallSite } from 'typescript-rtti';
function foo<T>(num : number, callSite? : CallSite) {
    expect(reflect(callSite).typeParameters[0].isClass(Boolean)).to.be.true;
    expect(reflect(callSite).parameters[0].isClass(Number)).to.be.true;
    expect(reflect(callSite).parameters[0].is('literal')).to.be.true;
    expect(reflect(callSite).parameters[0].as('literal').value).to.equal(123);
}

// The call-site type information is automatically serialized
foo<Boolean>(123);


```

More examples:

```typescript
// your code
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

let aClass = reflect(A);
console.log(aClass.parameterNames); // ["someValue", "someOtherValue"]
console.log(aClass.parameters[0].name); // "someValue"
console.log(aClass.getParameter('someValue').type); // Number
console.log(aClass.getParameter('someOtherValue').type); // String

let bClass = reflect(B);
console.log(bClass.propertyNames) // ["foo", "bar"]
console.log(bClass.getProperty('foo').type) // A
console.log(bClass.getProperty('foo').visibility) // "private"
console.log(bClass.getProperty('bar').type) // Number
console.log(bClass.methodNames) // [baz]
console.log(bClass.getMethod('baz').returnType) // A

// ...These are just a few of the facts you can introspect at runtime
```

# Set up
```
npm install typescript-rtti
npm install ttypescript -D
```

```jsonc
// tsconfig.json
"compilerOptions": {
    "plugins": [{ "transform": "typescript-rtti/dist/transformer" }]
}
```
This is all that's needed to configure rtti in a typescript project. 

# Usage

## ttypescript

```jsonc
// package.json
{
    "scripts": {
        "build": "ttsc -b"
    }
}
```

## **ts-node**
You can use ts-node, just pass `-C ttypescript` to make sure ts-node uses typescript compiler which respects compiler transforms.

## **Webpack**  
 See [awesome-typescript-loader](https://github.com/s-panferov/awesome-typescript-loader)

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

# Regarding `design:*`

> This library supports `emitDecoratorMetadata` but does not require it.

When you use this transformer, Typescript's own emitting of the `design:*` metadata is automatically disabled so that 
this transformer can handle it instead. Note that there are limitations with this metadata format 
([it has problems with forward references](https://github.com/microsoft/TypeScript/issues/27519) for one) and if/when 
the Typescript team decides to further advance runtime metadata, it is likely to be changed.

Enabling `emitDecoratorMetadata` causes `typescript-rtti` to emit both the `design:*` style of metadata as well as its 
own `rt:*` format. Disabling it causes only `rt:*` metadata to be emitted.

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
