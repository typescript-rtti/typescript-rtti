
import { expect } from 'chai';
import { describe, it } from '@jest/globals';
import ts from 'typescript';
import {
    InterfaceToken, RtObjectMember, RtObjectType, RtFunctionType,
    RtParameter, RtArrayType, RtMappedType
} from '../../common/format';
import { runSimple } from '../../runner.test-harness';
import { WORKAROUND_TYPESCRIPT_49794 } from '../workarounds';

describe('rt:h', () => {
    it('is emitted directly on a method', async () => {
        await runSimple({
            code: `
                export class B {
                    foo() { }
                }
            `,
            checks: exports => {
                let fooHost = Reflect.getMetadata('rt:h', exports.B.prototype.foo);
                expect(fooHost()).to.equal(exports.B);
            }
        });
    });
    it('is emitted directly on a method of a class expression', async () => {
        await runSimple({
            code: `
                export const B = class {
                    foo() { }
                }
            `,
            checks: exports => {
                let fooHost = Reflect.getMetadata('rt:h', exports.B.prototype.foo);
                expect(fooHost()).to.equal(exports.B);
            }
        });
    });
});
describe('Central Libraries', () => {
    it('works correctly for class declarations within functions', async () => {
        await runSimple({
            code: `
                function foo() {
                    class A {
                        foo : string;
                    }

                    class B {
                        a : A;
                    }

                    return { A, B };
                }

                export const classes = foo();
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:t', exports.classes.A.prototype, 'foo')()).to.equal(String);
                expect(Reflect.getMetadata('rt:t', exports.classes.B.prototype, 'a')()).to.equal(exports.classes.A);
            }
        });
    });
    it('emits for an enum type defined in a function', async () => {
        await runSimple({
            code: `
                export let MyEnum;

                function func() {
                    enum MyEnum2 {
                        Foo = 'FOO',
                        Bar = 'BAR'
                    }

                    MyEnum = MyEnum2;
                    return class {
                        thing: MyEnum2;
                    }
                }

                export const MyClass = func();
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.MyClass.prototype, 'thing');
                let type = typeResolver();

                expect(type.TΦ).to.equal('e');
                expect(type.e).to.equal(exports.MyEnum);
            }
        });
    });
    it('works correctly for interface declarations within functions', async () => {
        await runSimple({
            code: `
                function foo() {
                    interface A {
                        foo : string;
                    }

                    class B {
                        a : A;
                    }

                    return { B };
                }

                export const classes = foo();
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:t', exports.classes.B.prototype, 'a')().name).to.equal('A');
            }
        });
    });
});
describe('rt:f', () => {
    it('identify classes', async () => {
        await runSimple({
            code: `
                export class A { }
            `,
            checks: exports => {
                let aFlags = Reflect.getMetadata('rt:f', exports.A);
                expect(aFlags).to.contain('C');
                expect(aFlags).not.to.contain('I');
            }
        });
    });
    it('identify class expressions', async () => {
        await runSimple({
            code: `
                export let A = class { }
            `,
            checks: exports => {
                let aFlags = Reflect.getMetadata('rt:f', exports.A);
                expect(aFlags).to.contain('C');
                expect(aFlags).not.to.contain('I');
            }
        });
    });
    it('identifies return-type inference', async () => {
        await runSimple({
            code: `
                export class A {
                    foo() { return 123; }
                    bar() : number { return 123; }
                }
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:f', exports.A.prototype, 'foo')).to.contain('.');
                expect(Reflect.getMetadata('rt:f', exports.A.prototype, 'bar')).not.to.contain('.');
            }
        });
    });
    it('identify interfaces', async () => {
        await runSimple({
            code: `
                export interface A { }
            `,
            checks: exports => {
                let aFlags = Reflect.getMetadata('rt:f', exports.IΦA);
                expect(aFlags).to.contain('I');
                expect(aFlags).not.to.contain('C');
            }
        });
    });
    it('identifies exported classes', async () => {
        await runSimple({
            code: `
                class A { }
                export class B { }
                export const A2 = A;
            `,
            checks: exports => {
                let aFlags = Reflect.getMetadata('rt:f', exports.A2);
                let bFlags = Reflect.getMetadata('rt:f', exports.B);
                expect(aFlags).not.to.contain('e');
                expect(bFlags).to.contain('e');
            }
        });
    });
    it('identifies abstract classes', async () => {
        await runSimple({
            code: `
                export class A { }
                export abstract class B { }
            `,
            checks: exports => {
                let aFlags = Reflect.getMetadata('rt:f', exports.A);
                let bFlags = Reflect.getMetadata('rt:f', exports.B);
                expect(aFlags).not.to.contain('A');
                expect(bFlags).to.contain('A');
            }
        });
    });
    it('identifies abstract methods', async () => {
        await runSimple({
            code: `
                export abstract class B {
                    foo() { }
                    abstract bar();
                }
            `,
            checks: exports => {
                let fooFlags = Reflect.getMetadata('rt:f', exports.B.prototype, 'foo');
                let barFlags = Reflect.getMetadata('rt:f', exports.B.prototype, 'bar');
                expect(fooFlags).not.to.contain('A');
                expect(barFlags).to.contain('A');
            }
        });
    });
    it('identifies static methods', async () => {
        await runSimple({
            code: `
                export class B {
                    static foo() { }
                    bar() { }
                }
            `,
            checks: exports => {
                let fooFlags = Reflect.getMetadata('rt:f', exports.B, 'foo');
                let barFlags = Reflect.getMetadata('rt:f', exports.B.prototype, 'bar');
                expect(fooFlags).to.contain('S');
                expect(barFlags).not.to.contain('S');
            }
        });
    });
    it('identifies static methods on class expressions', async () => {
        await runSimple({
            code: `
                export const B = class {
                    static foo() { }
                    bar() { }
                }
            `,
            checks: exports => {
                let fooFlags = Reflect.getMetadata('rt:f', exports.B, 'foo');
                let barFlags = Reflect.getMetadata('rt:f', exports.B.prototype, 'bar');
                expect(fooFlags).to.contain('S');
                expect(barFlags).not.to.contain('S');
            }
        });
    });
    it('identifies methods directly', async () => {
        await runSimple({
            code: `
                export class B {
                    foo() { }
                }
            `,
            checks: exports => {
                let fooFlags = Reflect.getMetadata('rt:f', exports.B.prototype.foo);
                expect(fooFlags).to.contain('M');
            }
        });
    });
    it('identifies static methods directly', async () => {
        await runSimple({
            code: `
                export class B {
                    static foo() { }
                    bar() { }
                }
            `,
            checks: exports => {
                let fooFlags = Reflect.getMetadata('rt:f', exports.B.foo);
                let barFlags = Reflect.getMetadata('rt:f', exports.B.prototype.bar);
                expect(fooFlags).to.contain('M');
                expect(fooFlags).to.contain('S');
                expect(barFlags).not.to.contain('S');
            }
        });
    });
    it('identifies functions', async () => {
        await runSimple({
            code: `
                export function a() { }
            `,
            checks: exports => {
                let aFlags = Reflect.getMetadata('rt:f', exports.a);
                expect(aFlags).to.contain('F');
            }
        });
    });
    it('identifies arrow functions', async () => {
        await runSimple({
            code: `
                export let a = () => { }
            `,
            checks: exports => {
                let aFlags = Reflect.getMetadata('rt:f', exports.a);
                expect(aFlags).to.contain('F');
                expect(aFlags).to.contain('>');
                expect(aFlags).not.to.contain('M');
            }
        });
    });
    it('identifies async functions', async () => {
        await runSimple({
            code: `
                export function a() { }
                export async function b() { }
            `,
            checks: exports => {
                let aFlags = Reflect.getMetadata('rt:f', exports.a);
                let bFlags = Reflect.getMetadata('rt:f', exports.b);
                expect(aFlags).not.to.contain('a');
                expect(bFlags).to.contain('a');
            }
        });
    });
    it('identifies readonly properties', async () => {
        await runSimple({
            code: `
                export class A {
                    readonly foo = 123;
                    bar = 321;
                }
            `,
            checks: exports => {
                let fooFlags = Reflect.getMetadata('rt:f', exports.A.prototype, 'foo');
                let barFlags = Reflect.getMetadata('rt:f', exports.A.prototype, 'bar');
                expect(fooFlags).to.contain('R');
                expect(barFlags).not.to.contain('R');
            }
        });
    });
    it('identifies public methods', async () => {
        await runSimple({
            code: `
                export class C {
                    public foo() { }
                    protected bar() { }
                    private baz() { }
                }
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'foo')).to.contain('$');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'bar')).not.to.contain('$');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain('$');
            }
        });
    });
    it('identifies protected methods', async () => {
        await runSimple({
            code: `
                export class C {
                    public foo() { }
                    protected bar() { }
                    private baz() { }
                }
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'foo')).not.to.contain('@');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'bar')).to.contain('@');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain('@');
            }
        });
    });
    it('identifies private methods', async () => {
        await runSimple({
            code: `
                export class C {
                    public foo() { }
                    protected bar() { }
                    private baz() { }
                }
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'foo')).not.to.contain('#');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'bar')).not.to.contain('#');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).to.contain('#');
            }
        });
    });
    it('identifies bare methods', async () => {
        await runSimple({
            code: `
                export class C {
                    baz() { }
                }
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain('$');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain('@');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain('#');
            }
        });
    });


    it('identifies public properties', async () => {
        await runSimple({
            code: `
                export class C {
                    public foo;
                    protected bar;
                    private baz;
                }
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'foo')).to.contain('$');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'bar')).not.to.contain('$');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain('$');
            }
        });
    });
    it('identifies protected properties', async () => {
        await runSimple({
            code: `
                export class C {
                    public foo;
                    protected bar;
                    private baz;
                }
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'foo')).not.to.contain('@');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'bar')).to.contain('@');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain('@');
            }
        });
    });
    it('identifies private properties', async () => {
        await runSimple({
            code: `
                export class C {
                    public foo;
                    protected bar;
                    private baz;
                }
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'foo')).not.to.contain('#');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'bar')).not.to.contain('#');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).to.contain('#');
            }
        });
    });
    it('identifies bare properties', async () => {
        await runSimple({
            code: `
                export class C {
                    baz;
                }
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain('$');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain('@');
                expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain('#');
            }
        });
    });
});
describe('rt:P', () => {
    it('properly refers to symbols', async () => {
        await runSimple({
            code: `
                let sym = Symbol();
                export class A {
                    constructor(readonly bar = 'abc') {
                    };

                    [sym]: number = 123;

                    foo(faz : number) {
                        return 'works';
                    }
                }

                export const SYM = sym;
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:P', exports.A)).to.include.all.members([exports.SYM, 'bar']);
            }
        });
    });
    it('properly refers to exported symbols', async () => {
        await runSimple({
            code: `
                export let sym = Symbol();
                export class A {
                    constructor(readonly bar = 'abc') {
                    };

                    [sym] : number = 123;

                    foo(faz : number) {
                        return 'works';
                    }
                }
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:P', exports.A)).to.include.all.members([exports.sym, 'bar']);
            }
        });
    });
    it('is emitted for classes with no properties', async () => {
        await runSimple({
            code: `
                export class A {}
            `,
            checks: exports => {
                let rtm = Reflect.getMetadata('rt:P', exports.A);
                expect(rtm).to.exist;
                expect(rtm.length).to.equal(0);
            }
        });
    });
});
describe('rt:SP', () => {
    it('is emitted for classes with no static properties', async () => {
        await runSimple({
            code: `
                export class A {}
            `,
            checks: exports => {
                let rtm = Reflect.getMetadata('rt:SP', exports.A);
                expect(rtm).to.exist;
                expect(rtm.length).to.equal(0);
            }
        });
    });
})
describe('rt:Sm', () => {
    it('is emitted for classes with no static methods', async () => {
        await runSimple({
            code: `
                export class A {}
            `,
            checks: exports => {
                let rtm = Reflect.getMetadata('rt:Sm', exports.A);
                expect(rtm).to.exist;
                expect(rtm.length).to.equal(0);
            }
        });
    });
})
describe('rt:m', () => {
    it('properly refers to symbols', async () => {
        await runSimple({
            code: `
                let sym = Symbol();
                export class A {
                    constructor(readonly bar = 'abc') {
                    };

                    [sym]() {
                        return 123;
                    }

                    foo(faz : number) {
                        return 'works';
                    }
                }

                export const SYM = sym;
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:m', exports.A)).to.include.all.members([exports.SYM, 'foo']);
            }
        });
    });
    it('is emitted for classes with no methods', async () => {
        await runSimple({
            code: `
                export class A {}
            `,
            checks: exports => {
                let rtm = Reflect.getMetadata('rt:m', exports.A);
                expect(rtm).to.exist;
                expect(rtm.length).to.equal(0);
            }
        });
    });
    it('properly refers to exported symbols', async () => {
        await runSimple({
            code: `
                export let sym = Symbol();

                export class A {
                    constructor(readonly bar = 'abc') {
                    };

                    [sym]() {
                        return 123;
                    }

                    foo(faz : number) {
                        return 'works';
                    }
                }
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:m', exports.A)).to.include.all.members([exports.sym, 'foo']);
            }
        });
    });
});
describe('rt:p', () => {
    it('emits for ctor params', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B {
                    constructor(hello : A) { }
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.B);
                expect(params[0].t()).to.equal(exports.A);
                expect(params[0].n).to.equal('hello');
            }
        });
    });
    it('emits for ctor params on class expression', async () => {
        await runSimple({
            code: `
                export class A { }
                export const B = class {
                    constructor(hello : A) { }
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.B);
                expect(params[0].t()).to.equal(exports.A);
                expect(params[0].n).to.equal('hello');
            }
        });
    });
    it('emits for inferred ctor params', async () => {
        await runSimple({
            code: `
                export class B { constructor(readonly bar = 321) { } };
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.B);
                expect(params[0].t()).to.eql(321);
            }
        });
    });

    it('supports ctor param default value', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B {
                    constructor(hello : A = new A()) { }
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.B);
                expect(params[0].v()).to.be.instanceOf(exports.A);
            }
        });
    });
    it('emits F_PUBLIC for ctor param', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(public hello : A) { }
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.C);
                expect(params[0].f).to.contain('$');
            }
        });
    });

    it('emits F_PROTECTED for ctor param', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(protected hello : A) { }
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.C);
                expect(params[0].f).to.contain('@');
            }
        });
    });
    it('emits F_PRIVATE for ctor param', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(private hello : A) { }
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.C);
                expect(params[0].f).to.contain('#');
            }
        });
    });
    it('emits F_READONLY for ctor param', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(readonly hello : A) { }
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.C);
                expect(params[0].f).to.contain('R');
            }
        });
    });
    it('emits F_OPTIONAL for optional ctor param', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(hello? : A) { }
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.C);
                expect(params[0].f).to.contain('?');
            }
        });
    });
    it('emits F_REST for rest ctor param', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(...hello : A[]) { }
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.C);
                expect(params[0].f).to.contain('3');
            }
        });
    });
    it('emits F_REST for rest method', async () => {
        await runSimple({
            code: `
                export class C {
                    test(a,...rest){}
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.C.prototype,"test");
                expect(params[0].f).to.be.undefined;
                expect(params[1].f).to.contain('3');
            }
        });
    });
    it('emits F_REST for functions', async () => {
        await runSimple({
            code: `
            export function test(a,...rest){}
            export function test2(...b){}
            export const test3 = (a,...c)=>{}
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.test);
                expect(params[0].f).to.be.undefined;
                expect(params[1].f).to.contain('3');

                params = Reflect.getMetadata('rt:p', exports.test2);
                expect(params[0].f).to.contain('3');

                params = Reflect.getMetadata('rt:p', exports.test3);
                expect(params[0].f).to.be.undefined;
                expect(params[1].f).to.contain('3');
            }
        });
    });
    it('emits multiple flags for ctor param', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B {
                    constructor(public hello? : A) { }
                }
                export class C {
                    constructor(readonly hello? : A) { }
                }
            `,
            checks: exports => {
                let bFlags = Reflect.getMetadata('rt:p', exports.B);
                expect(bFlags[0].f).to.contain('$');
                expect(bFlags[0].f).to.contain('?');

                let cFlags = Reflect.getMetadata('rt:p', exports.C);
                expect(cFlags[0].f).to.contain('R');
                expect(cFlags[0].f).to.contain('?');
            }
        });
    });
    it('emits F_OPTIONAL for optional properties', async () => {
        await runSimple({
            code: `
                export class C {
                    foo? : number;
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:f', exports.C.prototype, 'foo');
                expect(params).to.contain('?');
            }
        });
    });
    it('emits F_OPTIONAL for optional methods', async () => {
        await runSimple({
            code: `
                export class C {
                    foo?() { };
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:f', exports.C.prototype, 'foo');
                expect(params).to.contain('?');
            }
        });
    });
    it('emits for method params', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) { }
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.C.prototype, 'method');
                expect(params[0].t()).to.equal(exports.A);
                expect(params[0].n).to.equal('hello');
                expect(params[1].t()).to.equal(exports.B);
                expect(params[1].n).to.equal('world');
            }
        });
    });
    it('emits for method params on a class expression', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export const C = class {
                    method(hello : A, world : B) { }
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.C.prototype, 'method');
                expect(params[0].t()).to.equal(exports.A);
                expect(params[0].n).to.equal('hello');
                expect(params[1].t()).to.equal(exports.B);
                expect(params[1].n).to.equal('world');
            }
        });
    });
    it('supports method param default value', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B {
                    foo(hello : A = new A()) { }
                }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.B.prototype, 'foo');
                expect(params[0].v()).to.be.instanceOf(exports.A);
            }
        });
    });
    it('emits for function params', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export function c(hello : A, world : B): B { return world; }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.c);
                expect(params[0].t()).to.equal(exports.A);
                expect(params[0].n).to.equal('hello');
                expect(params[1].t()).to.equal(exports.B);
                expect(params[1].n).to.equal('world');
            }
        });
    });
    it('emits for arrow function params', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export let c = (hello : A, world : B): B => { return world; }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.c);
                expect(params[0].t()).to.equal(exports.A);
                expect(params[0].n).to.equal('hello');
                expect(params[1].t()).to.equal(exports.B);
                expect(params[1].n).to.equal('world');
            }
        });
    });
    it('supports function param default value', async () => {
        await runSimple({
            code: `
                export class A { }
                export function foo(hello : A = new A()) { }
            `,
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.foo);
                expect(params[0].v()).to.be.instanceOf(exports.A);
            }
        });
    });
    it('emits for array destructuring', async () => {
        await runSimple({
            code: `
                export function foo(foo, [bar, baz]: string[]) { }
            `,
            checks: exports => {
                let params: RtParameter[] = Reflect.getMetadata('rt:p', exports.foo);
                expect(params[0].n).to.equal('foo');
                expect(params[0].f ?? '').not.to.contain('[');
                expect(params[0].f ?? '').not.to.contain('O');
                expect(params[1].f ?? '').to.contain('[');
                expect(params[1].f ?? '').not.to.contain('O');
                expect(params[1].n).not.to.exist;
                expect(params[1].t()).to.eql(<RtArrayType>{ TΦ: '[', e: String });
                expect(Array.isArray(params[1].b)).to.be.true;
                expect(params[1].b.length).to.equal(2);
                expect(params[1].b[0].n).to.equal('bar');
                expect(params[1].b[0].t()).to.equal(String);
                expect(params[1].b[1].n).to.equal('baz');
                expect(params[1].b[1].t()).to.equal(String);
            }
        });
    });
    it('emits for object destructuring', async () => {
        await runSimple({
            code: `
                export function foo(foo, {bar, baz}: { bar: string, baz: number }) { }
            `,
            checks: exports => {
                let params: RtParameter[] = Reflect.getMetadata('rt:p', exports.foo);
                expect(params[0].n).to.equal('foo');
                expect(params[0].f ?? '').not.to.contain('[');
                expect(params[0].f ?? '').not.to.contain('O');
                expect(params[1].f ?? '').not.to.contain('[');
                expect(params[1].f ?? '').to.contain('O');
                expect(params[1].n).not.to.exist;
                expect(params[1].t()).to.eql({ TΦ: "O", m: [{ n: "bar", f: "", t: String }, { n: "baz", f: "", t: Number }], n: undefined });
                expect(Array.isArray(params[1].b)).to.be.true;
                expect(params[1].b.length).to.equal(2);
                expect(params[1].b[0].n).to.equal('bar');
                expect(params[1].b[0].t()).to.equal(String);
                expect(params[1].b[1].n).to.equal('baz');
                expect(params[1].b[1].t()).to.equal(Number);
            }
        });
    });
});
describe('rt:t', () => {
    it('is not emitted when @rtti:skip is present on docblock', async () => {
        await runSimple({
            code: `
                export class A {
                    property: B;
                }

                /**
                 * @rtti:skip
                 */
                export class B {
                    property: B;
                }
            `,
            checks: exports => {
                expect(Reflect.hasMetadata('rt:t', exports.A.prototype, 'property')).to.be.true;
                expect(Reflect.hasMetadata('rt:t', exports.B.prototype, 'property')).to.be.false;
            }
        });
    });
    it('is not emitted when @rtti:skip is present on docblock', async () => {
        await runSimple({
            code: `
                function test(callback) {
                    return callback();
                }

                export const A = test(() => {
                    return class A {
                        property: A;
                    }
                });

                /**
                 * @rtti:skip
                 */
                export const B = test(() => {
                    return class B {
                        property: B;
                    }
                });
            `,
            checks: exports => {
                expect(Reflect.hasMetadata('rt:t', exports.A.prototype, 'property')).to.be.true;
                expect(Reflect.hasMetadata('rt:t', exports.B.prototype, 'property')).to.be.false;
            }
        });
    });
    it('emits for a property of a class expression', async () => {
        await runSimple({
            code: `
                export class B {}
                export let C = class {
                    property: B;
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'property');
                let type = typeResolver();
                expect(type).to.equal(exports.B);
            }
        });
    });
    it('emits for a static property of a class expression', async () => {
        await runSimple({
            code: `
                export class B {}
                export let C = class {
                    static property: B;
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C, 'property');
                let type = typeResolver();
                expect(type).to.equal(exports.B);
            }
        });
    });
    it('emits for a promise type', async () => {
        await runSimple({
            code: `
                export class B {
                    async floatNullable(): Promise<number | null> {
                        return 10
                    }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.B.prototype, 'floatNullable');
                let type = typeResolver();
                expect(type.TΦ).to.equal('g');
            }
        });
    });
    it('emits for an enum type', async () => {
        await runSimple({
            code: `
                export enum A {
                    Zero = 0,
                    One = 1,
                    Two = 2
                }
                export class B {
                    thing(): A {
                        return A.Two;
                    }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.B.prototype, 'thing');
                let type = typeResolver();
                expect(type.TΦ).to.equal('e');
                expect(type.e).to.equal(exports.A);
            }
        });
    });
    it('emits for const enum type', async () => {
        await runSimple({
            code: `
                export const enum ImportKind {
                    Named,
                    Default,
                    Namespace,
                    CommonJS,
                }
                export class B {
                    thing(): ImportKind {
                        return ImportKind.Default;
                    }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.B.prototype, 'thing');
                let type = typeResolver();

                expect(type.TΦ).to.equal('e');
                expect(type.e).to.equal(undefined);
                expect(type.n).to.equal('ImportKind');
                expect(type.v).to.eql({ Named: 0, Default: 1, Namespace: 2, CommonJS: 3 });
            }
        });
    });
    it('emits for an enum type defined in another module', async () => {
        await runSimple({
            modules: {
                './other.ts': `
                    export enum A {
                        Zero = 0,
                        One = 1,
                        Two = 2
                    }
                `
            },
            code: `
                import { A } from './other.js';
                export { A } from './other.js';

                export class B {
                    thing(): A {
                        return A.Two;
                    }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.B.prototype, 'thing');
                let type = typeResolver();

                expect(type.TΦ).to.equal('e');
                expect(type.e).to.equal(exports.A);
            }
        });
    });

    it('emits for a nullable promise type when strictNullChecks is enabled', async () => {
        await runSimple({
            compilerOptions: {
                strictNullChecks: true
            },
            code: `
                export class B {
                    async floatNullable(): Promise<number | null> {
                        return 10
                    }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.B.prototype, 'floatNullable');
                let type = typeResolver();

                expect(type.TΦ).to.equal('g');
                expect(type.p[0].TΦ).to.equal('|');

                let types: any[] = type.p[0].t;
                expect(types.length).to.equal(2);

                let nullT = types.find(x => x.TΦ === 'n');
                let numberT = types.find(x => x === Number);

                expect(nullT).to.exist;
                expect(numberT).to.exist;
            }
        });
    });

    it('emits for a property getter', async () => {
        await runSimple({
            code: `
                export class B {}
                export class C {
                    get property(): B { return null; }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'property');
                let type = typeResolver();

                expect(type).to.equal(exports.B);
            }
        });
    });
    it('emits for a property setter', async () => {
        await runSimple({
            code: `
                export class B {}
                export class C {
                    set property(b : B) { }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'property');
                let type = typeResolver();

                expect(type).to.equal(exports.B);
            }
        });
    });
    it('emits for implicit Date return type', async () => {
        await runSimple({
            code: `
                let d = new Date();
                export class C {
                    method() { return d; }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                let type = typeResolver();

                expect(type).to.equal(Date);
            }
        });
    });
    it('emits for a Function property type', async () => {
        await runSimple({
            code: `
                let d = new Date();
                export class C {
                    foo = () => { return true ? 123 : 'foo'; }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'foo');
                let type: RtFunctionType = typeResolver();
                expect(type).to.eql({ 'TΦ': 'F', r: { 'TΦ': '|', t: [ 123, 'foo' ] }, p: [], f: '' });
            }
        });
    });
    it('emits for a Function property type with parameters', async () => {
        await runSimple({
            code: `
                let d = new Date();
                export class C {
                    foo = (foo: string, bar: number) => { return true ? bar : foo; }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'foo');
                let type: RtFunctionType = typeResolver();
                expect(type.TΦ).to.equal('F');
                expect(type.r).to.eql({ 'TΦ': '|', t: [ String, Number ] });
                expect(type.p.length).to.equal(2);
                expect(type.p[0].n).to.equal('foo');
                expect(type.p[0].t()).to.equal(String);
                expect(type.p[0].v).to.equal(null);
                expect(type.p[1].n).to.equal('bar');
                expect(type.p[1].t()).to.equal(Number);
                expect(type.p[1].v).to.equal(null);
                expect(type.f).to.equal('');
            }
        });
    });
    it('emits for a Function property type node with parameters', async () => {
        await runSimple({
            code: `
                let d = new Date();
                export class C {
                    foo: (foo: string, bar: number) => string | number;
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'foo');
                let type: RtFunctionType = typeResolver();
                expect(type.TΦ).to.equal('F');
                expect(type.r).to.eql({ 'TΦ': '|', t: [ String, Number ] });
                expect(type.p.length).to.equal(2);
                expect(type.p[0].n).to.equal('foo');
                expect(type.p[0].t()).to.equal(String);
                expect(type.p[0].v).to.equal(null);
                expect(type.p[1].n).to.equal('bar');
                expect(type.p[1].t()).to.equal(Number);
                expect(type.p[1].v).to.equal(null);
                expect(type.f).to.equal('');
            }
        });
    });
    it('emits for designed class return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B): B { return world; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(exports.B);
            }
        });
    });
    it('emits for designed class return type on a class expression', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export const C = class {
                    method(hello : A, world : B): B { return world; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(exports.B);
            }
        });
    });
    it('emits for designed function declaration return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export function c(hello : A, world : B): B { return null; }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.c);
                expect(type()).to.equal(exports.B);
            }
        });
    });
    it('emits for inferred function declaration return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export function c(hello : A, world : B) { return world; }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.c);
                expect(type()).to.equal(exports.B);
            }
        });
    });
    it('emits for designed function expression return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export let c = function (hello : A, world : B): B { return world; }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.c);
                expect(type()).to.equal(exports.B);
            }
        });
    });
    it('emits for designed named function expression return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export let c = function foobar(hello : A, world : B): B { return world; }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.c);
                expect(type()).to.equal(exports.B);
            }
        });
    });
    it('emits for inferred named function expression return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export let c = function foobar (hello : A, world : B) { return world; }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.c);
                expect(type()).to.equal(exports.B);
            }
        });
    });
    it('emits for static method return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    static method(hello : A, world : B): B { return world; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C, 'method');
                expect(type()).to.equal(exports.B);
            }
        });
    });
    it('emits for designed interface return type', async () => {
        await runSimple({
            code: `
                export interface I {
                    foo : number;
                }

                export class C {
                    method(): I { return { foo: 123 }; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(exports.IΦI);
            }
        });
    });
    it('emits for unknown return type', async () => {
        await runSimple({
            code: `
                export class C {
                    method(): unknown { return null; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: 'U' });
            }
        });
    });
    it('emits for void return type', async () => {
        await runSimple({
            code: `
                export class C {
                    method(): void { }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: 'V' });
            }
        });
    });
    it('emits for any return type', async () => {
        await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method(): any { return null; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: '~' });
            }
        });
    });
    it('emits for array types', async () => {
        await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method(): string[] { return null; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: '[', e: String });
            }
        });
    });
    it('emits for array types', async () => {
        await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method(): Array<string> { return null; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: '[', e: String });
            }
        });
    });
    it('emits for array types with noLib', async () => {
        await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method(): string[] { return null; }
                }
            `,
            compilerOptions: {
                noLib: true
            },
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: '[', e: String });
            }
        });
    });
    it.skip('emits for array types with noLib without type node', async () => {
        await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method() { return ['foo', 'bar']; }
                }
            `,
            compilerOptions: {
                noLib: true
            },
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: '[', e: String });
            }
        });
    });

    // TODO: Jest uses the `vm` module to modify how imports work, which causes data: URI imports to fail.
    // Even if it did work though, we wouldn't want Jest's magic to interfere with modules under test,
    // so we should change the ESM runner to use a dedicated Node.js process, but that will take some work.
    it.skip('emits for array types with specific tsconfig', async () => {
        await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method(): string[] { return null; }
                }
            `,
            moduleType: 'esm',
            compilerOptions: {
                moduleResolution: ts.ModuleResolutionKind.NodeJs,
                module: ts.ModuleKind.ES2020,
                target: ts.ScriptTarget.ES2020,
                strict: true,
                removeComments: true,
                sourceMap: true,
                experimentalDecorators: true
            },
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: '[', e: String });
            }
        });
    });

    it('emits for double array types', async () => {
        await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method(): string[][] { return null; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: '[', e: { TΦ: '[', e: String } });
            }
        });
    });
    it('emits for tuple types', async () => {
        await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method(): [string, number] { return ['foo', 123]; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: 'T', e: [{ t: String }, { t: Number }] });
            }
        });
    });
    it('emits for tuple types with named elements', async () => {
        await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method(): [str : string, num : number] { return ['foo', 123]; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: 'T', e: [{ n: 'str', t: String }, { n: 'num', t: Number }] });
            }
        });
    });
    it('emits for returned Boolean', async () => {
        await runSimple({
            code: `
                export class C {
                    method<T>(t : T): Boolean { return false; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Boolean);
            }
        });
    });
    it('emits for conditional types', async () => {
        await runSimple({
            code: `
                export class C {
                    method<T>(t : T): T extends Boolean ? boolean : string { return false; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Object);
            }
        });
    });
    it('emits for type predicate types', async () => {
        await runSimple({
            code: `
                export class C {
                    isBlue(): this is D { return false; }
                }

                export class D extends C { }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'isBlue');
                expect(type()).to.equal(Boolean);
            }
        });
    });
    it('emits for this type', async () => {
        await runSimple({
            code: `
                export class C {
                    isBlue(): this { return this; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'isBlue');
                expect(type()).to.eql({ TΦ: 't' });
            }
        });
    });
    it('emits for returned String', async () => {
        await runSimple({
            code: `
                export class C {
                    method<T>(t : T): String { return 'hello'; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(String);
            }
        });
    });
    it('emits for returned Number', async () => {
        await runSimple({
            code: `
                export class C {
                    method<T>(t : T): Number { return 123; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Number);
            }
        });
    });
    it('emits for literal null', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : null {
                        return 123;
                    }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: 'n' });
            }
        });
    });
    it('emits for literal undefined', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : undefined {
                        return 123;
                    }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: 'u' });
            }
        });
    });
    it('emits for literal false', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : false {
                        return false;
                    }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: '0' });
            }
        });
    });
    it('emits for literal true', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : true {
                        return true;
                    }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: '1' });
            }
        });
    });
    it('emits for literal expression', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : 3 {
                        return 3;
                    }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(3);
            }
        });
    });
    it('emits for bigint literal expression', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : 3n {
                        return 3n;
                    }
                }
            `,
            compilerOptions: {
                target: ts.ScriptTarget.ES2020
            },
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(BigInt(3));
            }
        });
    });
    it('emits for unary literal expression', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : -3 {
                        return -3;
                    }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(-3);
            }
        });
    });
    it('emits for returned Function', async () => {
        await runSimple({
            code: `
                export class C {
                    method<T>(t : T): Function { return () => {}; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Function);
            }
        });
    });
    it('emits for returned type parameter', async () => {
        await runSimple({
            code: `
                export class C {
                    method<T>(t : T): T { return t; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Object);
            }
        });
    });
    it('emits for mapped types', async () => {
        await runSimple({
            code: `
                export class A {}
                type Px<T> = {
                    [P in keyof T]?: T[P];
                };
                export class C {
                    method<T>(): Px<A> { return null; }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                let type = typeResolver();

                expect(type.TΦ).to.equal('m');
                expect(type.t).to.equal(Object);
                expect(type.p).to.eql([exports.A]);
            }
        });
    });
    it('emits for mapped types and realizes the resulting type', async () => {
        await runSimple({
            code: `
                export class A {
                    foo: number;
                }
                type Px<T> = {
                    [P in keyof T]?: T[P];
                };
                export class C {
                    method<T>(): Px<A> { return null; }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                let type: RtMappedType = typeResolver();

                expect(type.TΦ).to.equal('m');
                expect(type.t).to.equal(Object);
                expect(type.p).to.eql([exports.A]);
                expect(type.m).to.exist;
                expect(type.m.length).equal(1);
                expect(type.m[0].n).to.equal('foo');
                expect(type.m[0].t).to.equal(Number);
                expect(type.m[0].f).to.include('?');
            }
        });
    });
    it('emits for mapped types from TS lib', async () => {
        await runSimple({
            code: `
                export class A {}
                export class C {
                    method<T>(): Partial<A> { return null; }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                let type = typeResolver();

                expect(type.TΦ).to.equal('m');
                expect(type.p).to.eql([exports.A]);
                expect(type.t).to.equal(Object);
            }
        });
    });
    it('emits for inferred class return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) { return world; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(exports.B);
            }
        });
    });
    it('emits for inferred interface return type', async () => {
        await runSimple({
            code: `
                export interface A {}
                export class C {
                    method(hello : A) { return hello; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(exports.IΦA);
            }
        });
    });
    it('emits for inferred union return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : string, world : number) { if (1) return hello; else return world; }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method'); let type = typeResolver();
                expect(type.TΦ).to.equal('|');
                expect(type.t.length).to.equal(2);
                expect(type.t).to.include.all.members([Number, String]);
            }
        });
    });
    it('emits for object literal return type', async () => {
        await runSimple({
            code: `
                type A = { foo: string, bar: number };
                export class C {
                    method(hello : string, world : number): A { return { foo: 'hello', bar: 123 }; }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method'); let type = typeResolver();
                expect(type.TΦ).to.equal('O');
                expect(type.m.length).to.equal(2);
                let fooT = type.m.find(x => x.n === 'foo');
                let barT = type.m.find(x => x.n === 'bar');

                expect(fooT).to.exist;
                expect(barT).to.exist;

                expect(fooT.t).to.equal(String);
                expect(barT.t).to.equal(Number);
                expect(fooT.f.includes('?')).to.be.false;
                expect(barT.f.includes('?')).to.be.false;
            }
        });
    });
    it('emits optionality for object literal members in return type', async () => {
        await runSimple({
            code: `
                type A = { foo?: string, bar: number };
                export class C {
                    method(hello : string, world : number): A { return { foo: 'hello', bar: 123 }; }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                let type: RtObjectType = typeResolver();
                expect(type.TΦ).to.equal('O');
                expect(type.m.length).to.equal(2);
                let fooT: RtObjectMember = type.m.find(x => x.n === 'foo');
                let barT: RtObjectMember = type.m.find(x => x.n === 'bar');

                expect(fooT).to.exist;
                expect(barT).to.exist;

                expect(fooT.t).to.equal(String);
                expect(fooT.f.includes('?')).to.be.true;
                expect(barT.t).to.equal(Number);
                expect(barT.f.includes('?')).to.be.false;
            }
        });
    });
    it('emits for inferred intersection return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method() { return <A & B><any>hello; }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                let type = typeResolver();
                expect(type.TΦ).to.equal('&');
                expect(type.t.length).to.equal(2);
                expect(type.t).to.include.all.members([exports.B, exports.A]);
            }
        });
    });
    it('emits for inferred any return type (via null)', async () => {
        await runSimple({
            code: `
                export class C {
                    method() { return null; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: '~' });
            }
        });
    });
    it('emits for inferred undefined return type (via undefined)', async () => {
        await runSimple({
            code: `
                export class C {
                    method() { return undefined; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: '~' });
            }
        });
    });
    it('emits for inferred boolean return type (via false)', async () => {
        await runSimple({
            code: `
                export class C {
                    method() { return false; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Boolean);
            }
        });
    });
    it('emits for inferred boolean return type (via true)', async () => {
        await runSimple({
            code: `
                export class C {
                    method() { return true; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Boolean);
            }
        });
    });
    it('emits for inferred intrinsic return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) { return 123; }
                }
            `,
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Number);
            }
        });
    });
    it('does not assume a property will have a TypeRef', async () => {
        await runSimple({
            code: `
                export class TestClass {
                    name = 'foobar'
                }
            `
        });
    });
    it('emits for union return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : string | number {
                        return 123;
                    }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                let type = typeResolver();

                expect(type.TΦ).to.equal('|');
                expect(type.t.length).to.equal(2);
                expect(type.t).to.include.all.members([Number, String]);
            }
        });
    });
    it('emits for intersection return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : A & B {
                        return null;
                    }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                let type = typeResolver();

                expect(type.TΦ).to.equal('&');
                expect(type.t.length).to.equal(2);
                expect(type.t).to.include.all.members([exports.B, exports.A]);
            }
        });
    });
    it('emits for Promise return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : Promise<string> {
                        return 123;
                    }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                let type = typeResolver();

                expect(type.TΦ).to.equal('g');
                expect(type.t).to.equal(Promise);
                expect(type.p).to.eql([String]);
            }
        });
    });
    it('emits for bare inferred Promise return type', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    async method(hello : A, world : B) {
                        return 123;
                    }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                let type = typeResolver();

                expect(type.TΦ).to.equal('g');
                expect(type.t).to.equal(Promise);
                expect(type.p).to.eql([Number]);
            }
        });
    });
    it('emits for union as type parameter', async () => {
        await runSimple({
            code: `
                export class A<T> { }
                export class C {
                    method() : A<number | string> {
                        return 123;
                    }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                let type = typeResolver();

                expect(type.TΦ).to.equal('g');
                expect(type.t).to.equal(exports.A);
                expect(type.p[0].TΦ).to.equal('|');
                expect(type.p[0].t.length).to.equal(2);
                expect(type.p[0].t).to.include.all.members([String, Number]);
            }
        });
    });

    it('emits for infinite generic', async () => {
        await runSimple({
            code: `
                type A = number | B<A>;
                interface B<T> { }
                export class C {
                    foo() {
                        return <A>null;
                    }
                }
            `,
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'foo');
                let type = typeResolver();

                expect(type.TΦ).to.equal('|');

                expect(type.t).to.include.all.members([Number]);
                let generic = type.t.find(x => x.TΦ === 'g');

                expect(generic).to.exist;
                expect(generic.p[0]).to.equal(type);
            }
        });
    });
});
describe('rt:i', () => {
    it('emits for local interfaces implemented by a class', async () => {
        await runSimple({
            code: `
                export interface Something {}
                export interface SomethingElse {}
                export class C implements Something, SomethingElse {}
            `,
            checks: exports => {
                let typeRefs: any[] = Reflect.getMetadata('rt:i', exports.C);

                expect(typeRefs).to.exist;
                expect(typeRefs.length).to.equal(2);
                expect(typeRefs[0]()).to.equal(exports.IΦSomething);
                expect(typeRefs[1]()).to.equal(exports.IΦSomethingElse);
            }
        });
    });
    it('emits for external interfaces implemented by a class', async () => {
        await runSimple({
            modules: {
                other: {
                    IΦSomething: {
                        name: 'Something',
                        prototype: {},
                        identity: Symbol('Something (interface)')
                    },

                    IΦSomethingElse: {
                        name: 'SomethingElse',
                        prototype: {},
                        identity: Symbol('SomethingElse (interface)')
                    }
                },
                '@types/other': `
                    export interface Something {}
                    export interface SomethingElse {}
                `
            },
            code: `
                import { Something, SomethingElse } from 'other';

                export class C implements Something, SomethingElse {}
            `,
            checks: exports => {
                let typeRefs: any[] = Reflect.getMetadata('rt:i', exports.C);

                expect(typeRefs).to.exist;
                expect(typeRefs.length).to.equal(2);
                expect(typeRefs[0]().name).to.equal('Something');
                expect(typeRefs[1]().name).to.equal('SomethingElse');
            }
        });
    });
    it('prefers exported class over exported interface', async () => {
        await runSimple({
            modules: {
                other: {
                    IΦSomething: <InterfaceToken>{
                        name: 'Something/interface',
                        prototype: {},
                        identity: Symbol('Something (interface)')
                    },
                    IΦSomethingElse: <InterfaceToken>{
                        name: 'SomethingElse/interface',
                        prototype: {},
                        identity: Symbol('SomethingElse (interface)')
                    },
                    Something: class { }
                },
                '@types/other': `
                    export interface Something {}
                    export interface SomethingElse {}
                    export class Something {}
                `
            },
            code: `
                import { Something, SomethingElse } from 'other';
                export class C implements Something, SomethingElse {}
            `,
            checks: exports => {
                let typeRefs: any[] = Reflect.getMetadata('rt:i', exports.C);

                expect(typeRefs).to.exist;
                expect(typeRefs.length).to.equal(2);
                expect(typeRefs[0]().name).to.equal('Something');
                expect(typeRefs[1]().name).to.equal('SomethingElse/interface');
            }
        });
    });
    it('should not crash when processing a constructor which was previously transformed', async () => {
        await runSimple({
            modules: {
                'typescript-rtti': {
                    reflect: () => {}
                }
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export class Foo {
                    constructor() {
                        reflect(undefined)
                    }
                }
            `
        });
    })
    it('emits class decorators only once', async () => {
        await runSimple({
            code: `
                export class A {
                    a:string;
                    b:string;
                    c:string;
                    d:string;
                    e:string,
                    f:string;
                    g:string;
                }
            `,
            outputTransformer(filename, code) {
                code = code.replace(/__RΦ\.m\(/g, `((key, value) => ((globalThis.__metadataDecorators = globalThis.__metadataDecorators ?? []).push([key, value]), __RΦ.m(key, value)))(`)
                return code;
            },
            checks: exports => {
                let decorators: ([key: string, value: any ])[] = (globalThis as any).__metadataDecorators;
                let count = decorators.filter(([key, value]) => key === 'rt:t').length;

                expect(count).to.equal(7);
            }
        });
    })
});

if (!WORKAROUND_TYPESCRIPT_49794) {
    describe('decorator order', () => {
        it('should be preserved for classes, methods and properties', async () => {
            await runSimple({
                code: `
                    function dec() {
                        return (target, pk?) => {
                            if ((Reflect as any).getMetadata('rt:f', target, pk) === undefined)
                                throw new Error('Metadata was not available to decorator!');
                        }
                    };

                    @dec()
                    class Foo {
                        @dec() public async bar(baz: number): Promise<void> {}
                        @dec() public baz: boolean;
                    }
                `
            });
        });
        it.skip('should be preserved for parameters', async () => {
            // Test fails, and not sure there's a way to make it pass :-\
            // https://github.com/typescript-rtti/typescript-rtti/issues/76#issuecomment-1169451079
            await runSimple({
                code: `
                    function dec() {
                        return (target, pk?, index?) => {
                            if ((Reflect as any).getMetadata('rt:f', target, pk) === undefined)
                                throw new Error('Metadata was not available to decorator!');
                        }
                    };

                    class Foo {
                        public async bar(@dec() baz: number): Promise<void> {}
                    }
                `
            });
        });
    });
}