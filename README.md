# typescript-rtti

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

After your project is compiled, you can then use the built-in reflection API:

```typescript
import { ReflectedClass } from 'rtti-typescript';

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
- Metadata format supports forward referencing
- Supports visibility (public, private), abstract, readonly, optional and more
- Comprehensive and well tested implementation
- Supports all targets (ES5 through ES2020)
- Supports both ES modules and CommonJS
- Works in the browser, Node.js and other runtimes (Deno?)
- Provides compatibility with existing `design:*` metadata as emitted by Typescript itself

# Regarding `design:*`

When you use this transformer, it will disable Typescript's own emitting of the `design:*` metadata so that this 
transformer can handle it instead. Note that there are limitations with this metadata format and if/when the Typescript
team decides to further advance runtime metadata, it is likely to be changed. 

For one thing, [it has problems with forward references](https://github.com/microsoft/TypeScript/issues/27519).