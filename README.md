# typescript-rtti

> **NOTE**
> This software is _alpha quality_. There is no guarantee it will successfully compile your code just yet.

A Typescript transformer to implement comprehensive runtime type information (RTTI).

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