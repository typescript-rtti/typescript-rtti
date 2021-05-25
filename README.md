# typescript-rtti
[![Version](https://img.shields.io/npm/v/typescript-rtti.svg)](https://www.npmjs.com/package/typescript-rtti)
[![CircleCI](https://circleci.com/gh/rezonant/typescript-rtti/tree/main.svg?style=shield)](https://circleci.com/gh/rezonant/typescript-rtti/tree/main)

> **NOTE**
> This software is _alpha quality_. There is no guarantee it will successfully compile your code just yet.

A Typescript transformer to implement comprehensive runtime type information (RTTI).

```
npm install typescript-rtti
```

# Usage

The easiest way to use this transformer is via [ttypescript](https://github.com/cevek/ttypescript).
Webpack users may also be interested in [awesome-typescript-loader](https://github.com/s-panferov/awesome-typescript-loader).

```
npm install ttypescript
```

Edit your `tsconfig.json` to add:

```json
"compilerOptions": {
    // ...
    "plugins": [
        { "transform": "typescript-rtti/dist/transformer" }
    ]
}
```

Note that you do not need `emitDecoratorMetadata` turned on unless you have code that relies on Typescript's own (flawed)
`design:*` metadata. If you do not need those, we recommend turning off `emitDecoratorMetadata`.

After your project is compiled, you can then use the built-in reflection API:

```typescript
import { ReflectedClass } from 'typescript-rtti';

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

let aClass = new ReflectedClass(A);
console.log(aClass.parameterNames); // ["someValue", "someOtherValue"]
console.log(aClass.parameters[0].name); // "someValue"
console.log(aClass.getParameter('someValue').type); // Number
console.log(aClass.getParameter('someOtherValue').type); // String

let bClass = new ReflectedClass(B);
console.log(bClass.propertyNames) // ["foo", "bar"]
console.log(bClass.getProperty('foo').type) // A
console.log(bClass.getProperty('foo').visibility) // "private"
console.log(bClass.getProperty('bar').type) // Number
console.log(bClass.methodNames) // [baz]
console.log(bClass.getMethod('baz').returnType) // A

// ...These are just a few of the facts you can introspect at runtime
```

# Features

- Emits metadata for all syntactic elements (classes, methods, properties, functions) parsed by Typescript
- Concise and terse metadata format saves space
- Metadata format supports forward referencing via type resolvers
- Supports reflecting on intrinsic inferred return types (ie Number, String, etc) in addition to directly specified 
  types
- Supports introspection of union and intersection types
- Supports array and tuple types
- Supports visibility (public, private), abstract, readonly, optional and more
- Comprehensive and well tested implementation
- Supports all targets (ES5 through ES2020)
- Supports both ES modules and CommonJS
- Works in the browser, Node.js and other runtimes (Deno?)
- Provides compatibility with existing `design:*` metadata as emitted by Typescript itself (only emitted when 
  emitDecoratorMetadata is turned on)

# Regarding `design:*`

When you use this transformer, it will disable Typescript's own emitting of the `design:*` metadata so that this 
transformer can handle it instead. Note that there are limitations with this metadata format ([it has problems with forward references](https://github.com/microsoft/TypeScript/issues/27519) for one) and if/when the Typescript
team decides to further advance runtime metadata, it is likely to be changed.

Enabling `emitDecoratorMetadata` causes `typescript-rtti` to emit both the `design:*` style of metadata as well as its own `rt:*` format. Disabling it causes only `rt:*` metadata to be emitted.

# Types without a value (Interfaces, Transformations, etc)

This package will output a runtime type of `Object` for any type which is not a class, a constructor, or intrinsic 
(primitive). While there is support for simple features like unions, intersections, array types and tuple types, there is currently no support for representing interfaces, transformation types, and other 
Typescript types which have no value at runtime (they will be emitted as `Object` at runtime). Adding representations for these types is not outside the scope of this 
project, but emitting metadata for such types is extremely difficult to do correctly while avoiding ballooning the size of the 
emitted output. If you are interested in adding support for these types, please open an issue to discuss how we might go about 
adding support.

# Format

The metadata emitted has a terse but intuitive structure. Note that you are not intended to access this metadata directly, instead you should use the built-in Reflection API (`ReflectedClass` et al).

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

