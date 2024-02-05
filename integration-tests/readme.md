Tests, for which the code has type information transformed in. This way, it's much easier to write mass tests for the validator.
i.e.
````typescript
class A { // This class will be enhanced with type info
    foo() { return true ? 123 : 'foo'; }
}
expect( reflect(A).getMethod('foo').returnType.isUnion() ).to.be.true
````
