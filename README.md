# typescript-rtti
[![Version](https://img.shields.io/npm/v/typescript-rtti.svg)](https://www.npmjs.com/package/typescript-rtti)
[![CircleCI](https://circleci.com/gh/rezonant/typescript-rtti/tree/main.svg?style=shield)](https://circleci.com/gh/rezonant/typescript-rtti/tree/main)

> **NOTE**
> This software is _beta quality_, semver 0.0.x. Transformer: Expect all codebases to build and operate the same as when the transformer is not present. Reflection API:  API is stable, expect only rare breaking changes on the way to major-stable semver.

A Typescript transformer to implement comprehensive runtime type information (RTTI).

- **Comprehensive**: supports emission for a large amount of Typescript concepts
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

expect(reflect<User>().getProperty('username').isOptional).to.be.true;

// Function declarations

function foo(id : number, username : string, protected favoriteColor? : number | string) {
    return id;
}

expect(reflect(foo).getParameter('username').type.isClass(String)).to.be.true;

// Function expressions

let foo = function (id : number, username : string, protected favoriteColor? : number | string) {
    return id;
}

expect(reflect(foo).getParameter('username').type.isClass(String)).to.be.true;

// Arrow functions

let foo = function (id : number, username : string, protected favoriteColor? : number | string) {
    return id;
}

expect(reflect(foo).getParameter('favoriteColor').type.is('union')).to.be.true;
```


# Usage

> **Using Webpack?**  
> See [awesome-typescript-loader](https://github.com/s-panferov/awesome-typescript-loader)

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

```jsonc
// package.json
{
    "scripts": {
        "build": "ttsc -b"
    }
}
```
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

# Features

- Emits metadata for the most useful elements (classes, interfaces, methods, properties, function declarations, function expressions, arrow functions) parsed by Typescript
- Emits metadata for abstract classes / methods
- Ability to evaluate parameter initializers (ie to obtain default values)
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

const __RtΦ = (k, v) => Reflect.metadata(k, v);
//...
B = __decorate([
    __RtΦ("rt:P", ["a"]),
    __RtΦ("rt:p", [{ n: "a", t: () => A, f: "R" }]),
    __RtΦ("rt:f", "C$")
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
    __RtΦ("rt:p", [{ n: "shape", t: () => ShapeΦ, f: "?" }]),
    __RtΦ("rt:f", "M$"),
    __RtΦ("rt:t", () => ShapeΦ)
], A.prototype, "takeShape", null);
__decorate([
    __RtΦ("rt:p", [{ n: "myArray", t: () => [String] }]),
    __RtΦ("rt:f", "M$"),
    __RtΦ("rt:t", () => Number)
], A.prototype, "haveAnArray", null);
__decorate([
    __RtΦ("rt:p", [{ n: "blank", t: () => void 0 }, { n: "aString", t: () => String }, { n: "aNumber", t: () => Number }, { n: "aBool", t: () => Boolean }, { n: "aFunc", t: () => Function }]),
    __RtΦ("rt:f", "M$"),
    __RtΦ("rt:t", () => String)
], A.prototype, "naturalTypes", null);
A = __decorate([
    __RtΦ("rt:m", ["takeShape", "haveAnArray", "naturalTypes"]),
    __RtΦ("rt:f", "C$")
], A);
```

# Why the symbols / Why not use Symbols?

The phi symbol is used on generated identifiers to prevent collisions and add a bit of difficulty for users trying to 
use the metadata directly. Due to the way metadata generation works it cannot be done using private Symbols, but the 
metadata generated should (to the end developer) be considered private.
