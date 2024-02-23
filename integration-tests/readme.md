This folder contains tests, for which the code has type information transformed in. This way, it's much easier to write mass tests for the validator.
i.e.
````typescript
class A { // This class will be enhanced with type info
    foo() { return true ? 123 : 'foo'; }
}
expect( reflect(A).getMethod('foo').returnType.isUnion() ).to.be.true
````

## Tests from typia
In addition to the above:
The typia project has already made big efforts to create test structures for all imaginable kinds of typescript types (props to them !!!).
So we "borrow" these [source code files](typia-repo/test/src/structures) by referencing it as a git submodule and ttsc build over them (with our transformer).  
Run the `prepare:typia-repo` script to check out the submodule and install the npm dependencies.

[src/by-typia.test.ts](src/by-typia.test.ts) is our the entry point which iterates though all these structure files.
