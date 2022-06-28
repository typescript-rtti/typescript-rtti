
import { expect } from 'chai';
import { describe } from 'razmin';
import ts from 'typescript';
import {
    F_REST, F_OPTIONAL, F_PRIVATE, F_PROTECTED, F_PUBLIC, F_READONLY, F_INFERRED, F_ABSTRACT, F_ARROW_FUNCTION,
    F_ASYNC, F_CLASS, F_EXPORTED, F_FUNCTION, F_INTERFACE, F_METHOD, F_STATIC, T_ANY, T_ARRAY, T_FALSE,
    T_GENERIC, T_INTERSECTION, T_MAPPED, T_NULL, T_THIS, T_TRUE, T_TUPLE, T_UNDEFINED, T_UNION, T_UNKNOWN,
    T_OBJECT, T_VOID, T_ENUM, T_FUNCTION, InterfaceToken, RtObjectMember, RtObjectType, RtFunctionType,
    RtUnionType
} from '../../common/format';
import { runSimple } from '../../runner.test';

describe('rt:h', it => {
    it('is emitted directly on a method', async () => {
        let exports = await runSimple({
            code: `
                export class B {
                    foo() { }
                }
            `
        });

        let fooHost = Reflect.getMetadata('rt:h', exports.B.prototype.foo);
        expect(fooHost()).to.equal(exports.B);
    });
    it('is emitted directly on a method of a class expression', async () => {
        let exports = await runSimple({
            code: `
                export const B = class {
                    foo() { }
                }
            `
        });

        let fooHost = Reflect.getMetadata('rt:h', exports.B.prototype.foo);
        expect(fooHost()).to.equal(exports.B);
    });
});
describe('Central Libraries', it => {
    it('works correctly for class declarations within functions', async () => {
        let exports = await runSimple({
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
            `
        });

        expect(Reflect.getMetadata('rt:t', exports.classes.A.prototype, 'foo')()).to.equal(String);
        expect(Reflect.getMetadata('rt:t', exports.classes.B.prototype, 'a')()).to.equal(exports.classes.A);
    });
    it('emits for an enum type defined in a function', async () => {
        let exports = await runSimple({
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
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.MyClass.prototype, 'thing');
        let type = typeResolver();

        expect(type.TΦ).to.equal(T_ENUM);
        expect(type.e).to.equal(exports.MyEnum);
    });
    it('works correctly for interface declarations within functions', async () => {
        let exports = await runSimple({
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
            `
        });

        expect(Reflect.getMetadata('rt:t', exports.classes.B.prototype, 'a')().name).to.equal('A');
    });
});
describe('rt:f', it => {
    it('identify classes', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
            `
        });

        let aFlags = Reflect.getMetadata('rt:f', exports.A);
        expect(aFlags).to.contain(F_CLASS);
        expect(aFlags).not.to.contain(F_INTERFACE);
    });
    it('identify class expressions', async () => {
        let exports = await runSimple({
            code: `
                export let A = class { }
            `
        });

        let aFlags = Reflect.getMetadata('rt:f', exports.A);
        expect(aFlags).to.contain(F_CLASS);
        expect(aFlags).not.to.contain(F_INTERFACE);
    });
    it('identifies return-type inference', async () => {
        let exports = await runSimple({
            code: `
                export class A {
                    foo() { return 123; }
                    bar() : number { return 123; }
                }
            `
        });

        expect(Reflect.getMetadata('rt:f', exports.A.prototype, 'foo')).to.contain(F_INFERRED);
        expect(Reflect.getMetadata('rt:f', exports.A.prototype, 'bar')).not.to.contain(F_INFERRED);
    });
    it('identify interfaces', async () => {
        let exports = await runSimple({
            code: `
                export interface A { }
            `
        });

        let aFlags = Reflect.getMetadata('rt:f', exports.IΦA);
        expect(aFlags).to.contain(F_INTERFACE);
        expect(aFlags).not.to.contain(F_CLASS);
    });
    it('identifies exported classes', async () => {
        let exports = await runSimple({
            code: `
                class A { }
                export class B { }
                export const A2 = A;
            `
        });

        let aFlags = Reflect.getMetadata('rt:f', exports.A2);
        let bFlags = Reflect.getMetadata('rt:f', exports.B);
        expect(aFlags).not.to.contain(F_EXPORTED);
        expect(bFlags).to.contain(F_EXPORTED);
    });
    it('identifies abstract classes', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export abstract class B { }
            `
        });

        let aFlags = Reflect.getMetadata('rt:f', exports.A);
        let bFlags = Reflect.getMetadata('rt:f', exports.B);
        expect(aFlags).not.to.contain(F_ABSTRACT);
        expect(bFlags).to.contain(F_ABSTRACT);
    });
    it('identifies abstract methods', async () => {
        let exports = await runSimple({
            code: `
                export abstract class B {
                    foo() { }
                    abstract bar();
                }
            `
        });

        let fooFlags = Reflect.getMetadata('rt:f', exports.B.prototype, 'foo');
        let barFlags = Reflect.getMetadata('rt:f', exports.B.prototype, 'bar');
        expect(fooFlags).not.to.contain(F_ABSTRACT);
        expect(barFlags).to.contain(F_ABSTRACT);
    });
    it('identifies static methods', async () => {
        let exports = await runSimple({
            code: `
                export class B {
                    static foo() { }
                    bar() { }
                }
            `
        });

        let fooFlags = Reflect.getMetadata('rt:f', exports.B, 'foo');
        let barFlags = Reflect.getMetadata('rt:f', exports.B.prototype, 'bar');
        expect(fooFlags).to.contain(F_STATIC);
        expect(barFlags).not.to.contain(F_STATIC);
    });
    it('identifies static methods on class expressions', async () => {
        let exports = await runSimple({
            code: `
                export const B = class {
                    static foo() { }
                    bar() { }
                }
            `
        });

        let fooFlags = Reflect.getMetadata('rt:f', exports.B, 'foo');
        let barFlags = Reflect.getMetadata('rt:f', exports.B.prototype, 'bar');
        expect(fooFlags).to.contain(F_STATIC);
        expect(barFlags).not.to.contain(F_STATIC);
    });
    it('identifies methods directly', async () => {
        let exports = await runSimple({
            code: `
                export class B {
                    foo() { }
                }
            `
        });

        let fooFlags = Reflect.getMetadata('rt:f', exports.B.prototype.foo);
        expect(fooFlags).to.contain(F_METHOD);
    });
    it('identifies static methods directly', async () => {
        let exports = await runSimple({
            code: `
                export class B {
                    static foo() { }
                    bar() { }
                }
            `
        });

        let fooFlags = Reflect.getMetadata('rt:f', exports.B.foo);
        let barFlags = Reflect.getMetadata('rt:f', exports.B.prototype.bar);
        expect(fooFlags).to.contain(F_METHOD);
        expect(fooFlags).to.contain(F_STATIC);
        expect(barFlags).not.to.contain(F_STATIC);
    });
    it('identifies functions', async () => {
        let exports = await runSimple({
            code: `
                export function a() { }
            `
        });

        let aFlags = Reflect.getMetadata('rt:f', exports.a);
        expect(aFlags).to.contain(F_FUNCTION);
    });
    it('identifies arrow functions', async () => {
        let exports = await runSimple({
            code: `
                export let a = () => { }
            `
        });

        let aFlags = Reflect.getMetadata('rt:f', exports.a);
        expect(aFlags).to.contain(F_FUNCTION);
        expect(aFlags).to.contain(F_ARROW_FUNCTION);
        expect(aFlags).not.to.contain(F_METHOD);
    });
    it('identifies async functions', async () => {
        let exports = await runSimple({
            code: `
                export function a() { }
                export async function b() { }
            `
        });

        let aFlags = Reflect.getMetadata('rt:f', exports.a);
        let bFlags = Reflect.getMetadata('rt:f', exports.b);
        expect(aFlags).not.to.contain(F_ASYNC);
        expect(bFlags).to.contain(F_ASYNC);
    });
    it('identifies readonly properties', async () => {
        let exports = await runSimple({
            code: `
                export class A {
                    readonly foo = 123;
                    bar = 321;
                }
            `
        });

        let fooFlags = Reflect.getMetadata('rt:f', exports.A.prototype, 'foo');
        let barFlags = Reflect.getMetadata('rt:f', exports.A.prototype, 'bar');
        expect(fooFlags).to.contain(F_READONLY);
        expect(barFlags).not.to.contain(F_READONLY);
    });
    it('identifies public methods', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    public foo() { }
                    protected bar() { }
                    private baz() { }
                }
            `
        });

        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'foo')).to.contain(F_PUBLIC);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'bar')).not.to.contain(F_PUBLIC);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain(F_PUBLIC);
    });
    it('identifies protected methods', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    public foo() { }
                    protected bar() { }
                    private baz() { }
                }
            `
        });

        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'foo')).not.to.contain(F_PROTECTED);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'bar')).to.contain(F_PROTECTED);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain(F_PROTECTED);
    });
    it('identifies private methods', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    public foo() { }
                    protected bar() { }
                    private baz() { }
                }
            `
        });

        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'foo')).not.to.contain(F_PRIVATE);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'bar')).not.to.contain(F_PRIVATE);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).to.contain(F_PRIVATE);
    });
    it('identifies bare methods', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    baz() { }
                }
            `
        });

        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain(F_PUBLIC);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain(F_PROTECTED);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain(F_PRIVATE);
    });


    it('identifies public properties', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    public foo;
                    protected bar;
                    private baz;
                }
            `
        });

        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'foo')).to.contain(F_PUBLIC);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'bar')).not.to.contain(F_PUBLIC);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain(F_PUBLIC);
    });
    it('identifies protected properties', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    public foo;
                    protected bar;
                    private baz;
                }
            `
        });

        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'foo')).not.to.contain(F_PROTECTED);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'bar')).to.contain(F_PROTECTED);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain(F_PROTECTED);
    });
    it('identifies private properties', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    public foo;
                    protected bar;
                    private baz;
                }
            `
        });

        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'foo')).not.to.contain(F_PRIVATE);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'bar')).not.to.contain(F_PRIVATE);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).to.contain(F_PRIVATE);
    });
    it('identifies bare properties', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    baz;
                }
            `
        });

        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain(F_PUBLIC);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain(F_PROTECTED);
        expect(Reflect.getMetadata('rt:f', exports.C.prototype, 'baz')).not.to.contain(F_PRIVATE);
    });
});
describe('rt:P', it => {
    it('properly refers to symbols', async () => {
        let exports = await runSimple({
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
            `
        });

        expect(Reflect.getMetadata('rt:P', exports.A)).to.include.all.members([exports.SYM, 'bar']);
    });
    it('properly refers to exported symbols', async () => {
        let exports = await runSimple({
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
            `
        });

        expect(Reflect.getMetadata('rt:P', exports.A)).to.include.all.members([exports.sym, 'bar']);
    });
    it('is emitted for classes with no properties', async () => {
        let exports = await runSimple({
            code: `
                export class A {}
            `
        });

        let rtm = Reflect.getMetadata('rt:P', exports.A);
        expect(rtm).to.exist;
        expect(rtm.length).to.equal(0);
    });
});
describe('rt:SP', it => {
    it('is emitted for classes with no static properties', async () => {
        let exports = await runSimple({
            code: `
                export class A {}
            `
        });

        let rtm = Reflect.getMetadata('rt:SP', exports.A);
        expect(rtm).to.exist;
        expect(rtm.length).to.equal(0);
    });
})
describe('rt:Sm', it => {
    it('is emitted for classes with no static methods', async () => {
        let exports = await runSimple({
            code: `
                export class A {}
            `
        });

        let rtm = Reflect.getMetadata('rt:Sm', exports.A);
        expect(rtm).to.exist;
        expect(rtm.length).to.equal(0);
    });
})
describe('rt:m', it => {
    it('properly refers to symbols', async () => {
        let exports = await runSimple({
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
            `
        });

        expect(Reflect.getMetadata('rt:m', exports.A)).to.include.all.members([exports.SYM, 'foo']);
    });
    it('is emitted for classes with no methods', async () => {
        let exports = await runSimple({
            code: `
                export class A {}
            `
        });

        let rtm = Reflect.getMetadata('rt:m', exports.A);

        expect(rtm).to.exist;
        expect(rtm.length).to.equal(0);
    });
    it('properly refers to exported symbols', async () => {
        let exports = await runSimple({
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
            `
        });

        expect(Reflect.getMetadata('rt:m', exports.A)).to.include.all.members([exports.sym, 'foo']);
    });
});
describe('rt:p', it => {
    it('emits for ctor params', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B {
                    constructor(hello : A) { }
                }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.B);
        expect(params[0].t()).to.equal(exports.A);
        expect(params[0].n).to.equal('hello');
    });
    it('emits for ctor params on class expression', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export const B = class {
                    constructor(hello : A) { }
                }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.B);
        expect(params[0].t()).to.equal(exports.A);
        expect(params[0].n).to.equal('hello');
    });
    it('emits for inferred ctor params', async () => {
        let exports = await runSimple({
            code: `
                export class B { constructor(readonly bar = 321) { } };
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.B);
        expect(params[0].t()).to.eql(321);
    });

    it('supports ctor param default value', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B {
                    constructor(hello : A = new A()) { }
                }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.B);
        expect(params[0].v()).to.be.instanceOf(exports.A);
    });
    it('emits F_PUBLIC for ctor param', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(public hello : A) { }
                }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.C);
        expect(params[0].f).to.contain(F_PUBLIC);
    });

    it('emits F_PROTECTED for ctor param', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(protected hello : A) { }
                }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.C);
        expect(params[0].f).to.contain(F_PROTECTED);
    });
    it('emits F_PRIVATE for ctor param', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(private hello : A) { }
                }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.C);
        expect(params[0].f).to.contain(F_PRIVATE);
    });
    it('emits F_READONLY for ctor param', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(readonly hello : A) { }
                }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.C);
        expect(params[0].f).to.contain(F_READONLY);
    });
    it('emits F_OPTIONAL for optional ctor param', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(hello? : A) { }
                }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.C);
        expect(params[0].f).to.contain(F_OPTIONAL);
    });
    it('emits F_REST for rest ctor param', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(...hello : A[]) { }
                }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.C);
        expect(params[0].f).to.contain(F_REST);
    });
    it('emits F_REST for rest method', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    test(a,...rest){}
                }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.C.prototype,"test");
        expect(params[0].f).to.be.undefined;
        expect(params[1].f).to.contain(F_REST);
    });
    it('emits F_REST for functions', async () => {
        let exports = await runSimple({
            code: `
            export function test(a,...rest){}
            export function test2(...b){}
            export const test3 = (a,...c)=>{}
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.test);
        expect(params[0].f).to.be.undefined;
        expect(params[1].f).to.contain(F_REST);

        params = Reflect.getMetadata('rt:p', exports.test2);
        expect(params[0].f).to.contain(F_REST);

        params = Reflect.getMetadata('rt:p', exports.test3);
        expect(params[0].f).to.be.undefined;
        expect(params[1].f).to.contain(F_REST);
    });
    it('emits multiple flags for ctor param', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B {
                    constructor(public hello? : A) { }
                }
                export class C {
                    constructor(readonly hello? : A) { }
                }
            `
        });

        let bFlags = Reflect.getMetadata('rt:p', exports.B);
        expect(bFlags[0].f).to.contain(F_PUBLIC);
        expect(bFlags[0].f).to.contain(F_OPTIONAL);

        let cFlags = Reflect.getMetadata('rt:p', exports.C);
        expect(cFlags[0].f).to.contain(F_READONLY);
        expect(cFlags[0].f).to.contain(F_OPTIONAL);
    });
    it('emits F_OPTIONAL for optional properties', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    foo? : number;
                }
            `
        });

        let params = Reflect.getMetadata('rt:f', exports.C.prototype, 'foo');
        expect(params).to.contain(F_OPTIONAL);
    });
    it('emits F_OPTIONAL for optional methods', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    foo?() { };
                }
            `
        });

        let params = Reflect.getMetadata('rt:f', exports.C.prototype, 'foo');
        expect(params).to.contain(F_OPTIONAL);
    });
    it('emits for method params', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) { }
                }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.C.prototype, 'method');
        expect(params[0].t()).to.equal(exports.A);
        expect(params[0].n).to.equal('hello');
        expect(params[1].t()).to.equal(exports.B);
        expect(params[1].n).to.equal('world');
    });
    it('emits for method params on a class expression', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export const C = class {
                    method(hello : A, world : B) { }
                }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.C.prototype, 'method');
        expect(params[0].t()).to.equal(exports.A);
        expect(params[0].n).to.equal('hello');
        expect(params[1].t()).to.equal(exports.B);
        expect(params[1].n).to.equal('world');
    });
    it('supports method param default value', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B {
                    foo(hello : A = new A()) { }
                }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.B.prototype, 'foo');
        expect(params[0].v()).to.be.instanceOf(exports.A);
    });
    it('emits for function params', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export function c(hello : A, world : B): B { return world; }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.c);
        expect(params[0].t()).to.equal(exports.A);
        expect(params[0].n).to.equal('hello');
        expect(params[1].t()).to.equal(exports.B);
        expect(params[1].n).to.equal('world');
    });
    it('emits for arrow function params', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export let c = (hello : A, world : B): B => { return world; }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.c);
        expect(params[0].t()).to.equal(exports.A);
        expect(params[0].n).to.equal('hello');
        expect(params[1].t()).to.equal(exports.B);
        expect(params[1].n).to.equal('world');
    });
    it('supports function param default value', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export function foo(hello : A = new A()) { }
            `
        });

        let params = Reflect.getMetadata('rt:p', exports.foo);
        expect(params[0].v()).to.be.instanceOf(exports.A);
    });
});
describe('rt:t', it => {
    it('is not emitted when @rtti:skip is present on docblock', async () => {
        let exports = await runSimple({
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
            `
        });

        expect(Reflect.hasMetadata('rt:t', exports.A.prototype, 'property')).to.be.true;
        expect(Reflect.hasMetadata('rt:t', exports.B.prototype, 'property')).to.be.false;
    });
    it('is not emitted when @rtti:skip is present on docblock', async () => {
        let exports = await runSimple({
            code: `
                function test(callback) {
                    return callback();
                }

                export const A = test(() => {
                    return class A {
                        property: B;
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
            `
        });

        expect(Reflect.hasMetadata('rt:t', exports.A.prototype, 'property')).to.be.true;
        expect(Reflect.hasMetadata('rt:t', exports.B.prototype, 'property')).to.be.false;
    });
    it('emits for a property of a class expression', async () => {
        let exports = await runSimple({
            code: `
                export class B {}
                export let C = class {
                    property: B;
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'property');
        let type = typeResolver();

        expect(type).to.equal(exports.B);
    });
    it('emits for a static property of a class expression', async () => {
        let exports = await runSimple({
            code: `
                export class B {}
                export let C = class {
                    static property: B;
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C, 'property');
        let type = typeResolver();

        expect(type).to.equal(exports.B);
    });
    it('emits for a promise type', async () => {
        let exports = await runSimple({
            code: `
                export class B {
                    async floatNullable(): Promise<number | null> {
                        return 10
                    }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.B.prototype, 'floatNullable');
        let type = typeResolver();

        expect(type.TΦ).to.equal(T_GENERIC);
    });
    it('emits for an enum type', async () => {
        let exports = await runSimple({
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
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.B.prototype, 'thing');
        let type = typeResolver();

        expect(type.TΦ).to.equal(T_ENUM);
        expect(type.e).to.equal(exports.A);
    });
    it('emits for const enum type', async () => {
        let exports = await runSimple({
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
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.B.prototype, 'thing');
        let type = typeResolver();

        expect(type.TΦ).to.equal(T_ENUM);
        expect(type.e).to.equal(undefined);
        expect(type.n).to.equal('ImportKind');
        expect(type.v).to.eql({ Named: 0, Default: 1, Namespace: 2, CommonJS: 3 });
    });
    it('emits for an enum type defined in another module', async () => {
        let exports = await runSimple({
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
                import { A } from './other';
                export { A } from './other';

                export class B {
                    thing(): A {
                        return A.Two;
                    }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.B.prototype, 'thing');
        let type = typeResolver();

        expect(type.TΦ).to.equal(T_ENUM);
        expect(type.e).to.equal(exports.A);
    });

    it('emits for a nullable promise type when strictNullChecks is enabled', async () => {
        let exports = await runSimple({
            compilerOptions: {
                strictNullChecks: true
            },
            code: `
                export class B {
                    async floatNullable(): Promise<number | null> {
                        return 10
                    }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.B.prototype, 'floatNullable');
        let type = typeResolver();

        expect(type.TΦ).to.equal(T_GENERIC);
        expect(type.p[0].TΦ).to.equal(T_UNION);

        let types: any[] = type.p[0].t;
        expect(types.length).to.equal(2);

        let nullT = types.find(x => x.TΦ === T_NULL);
        let numberT = types.find(x => x === Number);

        expect(nullT).to.exist;
        expect(numberT).to.exist;
    });

    it('emits for a property getter', async () => {
        let exports = await runSimple({
            code: `
                export class B {}
                export class C {
                    get property(): B { return null; }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'property');
        let type = typeResolver();

        expect(type).to.equal(exports.B);
    });
    it('emits for a property setter', async () => {
        let exports = await runSimple({
            code: `
                export class B {}
                export class C {
                    set property(b : B) { }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'property');
        let type = typeResolver();

        expect(type).to.equal(exports.B);
    });
    it('emits for implicit Date return type', async () => {
        let exports = await runSimple({
            code: `
                let d = new Date();
                export class C {
                    method() { return d; }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        let type = typeResolver();

        expect(type).to.equal(Date);
    });
    it('emits for a Function property type', async () => {
        let exports = await runSimple({
            code: `
                let d = new Date();
                export class C {
                    foo = () => { return true ? 123 : 'foo'; }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'foo');
        let type: RtFunctionType = typeResolver();
        expect(type).to.eql({ 'TΦ': T_FUNCTION, r: { 'TΦ': T_UNION, t: [ 123, 'foo' ] }, p: [], f: '' });
    });
    it('emits for a Function property type with parameters', async () => {
        let exports = await runSimple({
            code: `
                let d = new Date();
                export class C {
                    foo = (foo: string, bar: number) => { return true ? bar : foo; }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'foo');
        let type: RtFunctionType = typeResolver();
        expect(type.TΦ).to.equal(T_FUNCTION);
        expect(type.r).to.eql({ 'TΦ': T_UNION, t: [ String, Number ] });
        expect(type.p.length).to.equal(2);
        expect(type.p[0].n).to.equal('foo');
        expect(type.p[0].t()).to.equal(String);
        expect(type.p[0].v).to.equal(null);
        expect(type.p[1].n).to.equal('bar');
        expect(type.p[1].t()).to.equal(Number);
        expect(type.p[1].v).to.equal(null);
        expect(type.f).to.equal('');
    });
    it('emits for a Function property type node with parameters', async () => {
        let exports = await runSimple({
            code: `
                let d = new Date();
                export class C {
                    foo: (foo: string, bar: number) => string | number;
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'foo');
        let type: RtFunctionType = typeResolver();
        expect(type.TΦ).to.equal(T_FUNCTION);
        expect(type.r).to.eql({ 'TΦ': T_UNION, t: [ String, Number ] });
        expect(type.p.length).to.equal(2);
        expect(type.p[0].n).to.equal('foo');
        expect(type.p[0].t()).to.equal(String);
        expect(type.p[0].v).to.equal(null);
        expect(type.p[1].n).to.equal('bar');
        expect(type.p[1].t()).to.equal(Number);
        expect(type.p[1].v).to.equal(null);
        expect(type.f).to.equal('');
    });
    it('emits for designed class return type', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B): B { return world; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(exports.B);
    });
    it('emits for designed class return type on a class expression', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export const C = class {
                    method(hello : A, world : B): B { return world; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(exports.B);
    });
    it('emits for designed function declaration return type', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export function c(hello : A, world : B): B { return null; }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.c);
        expect(type()).to.equal(exports.B);
    });
    it('emits for inferred function declaration return type', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export function c(hello : A, world : B) { return world; }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.c);
        expect(type()).to.equal(exports.B);
    });
    it('emits for designed function expression return type', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export let c = function (hello : A, world : B): B { return world; }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.c);
        expect(type()).to.equal(exports.B);
    });
    it('emits for designed named function expression return type', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export let c = function foobar(hello : A, world : B): B { return world; }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.c);
        expect(type()).to.equal(exports.B);
    });
    it('emits for inferred named function expression return type', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export let c = function foobar (hello : A, world : B) { return world; }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.c);
        expect(type()).to.equal(exports.B);
    });
    it('emits for static method return type', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    static method(hello : A, world : B): B { return world; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C, 'method');
        expect(type()).to.equal(exports.B);
    });
    it('emits for designed interface return type', async () => {
        let exports = await runSimple({
            code: `
                export interface I {
                    foo : number;
                }

                export class C {
                    method(): I { return { foo: 123 }; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(exports.IΦI);
    });
    it('emits for unknown return type', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    method(): unknown { return null; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_UNKNOWN });
    });
    it('emits for void return type', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    method(): void { }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_VOID });
    });
    it('emits for any return type', async () => {
        let exports = await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method(): any { return null; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_ANY });
    });
    it('emits for array types', async () => {
        let exports = await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method(): string[] { return null; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_ARRAY, e: String });
    });
    it('emits for array types', async () => {
        let exports = await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method(): Array<string> { return null; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_ARRAY, e: String });
    });
    it('emits for array types with noLib', async () => {
        let exports = await runSimple({
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
            }
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_ARRAY, e: String });
    });
    it.skip('emits for array types with noLib without type node', async () => {
        let exports = await runSimple({
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
            }
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_ARRAY, e: String });
    });

    it('emits for array types with specific tsconfig', async () => {
        let exports = await runSimple({
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
            }
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_ARRAY, e: String });
    });

    it('emits for double array types', async () => {
        let exports = await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method(): string[][] { return null; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_ARRAY, e: { TΦ: T_ARRAY, e: String } });
    });
    it('emits for tuple types', async () => {
        let exports = await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method(): [string, number] { return ['foo', 123]; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_TUPLE, e: [{ t: String }, { t: Number }] });
    });
    it('emits for tuple types with named elements', async () => {
        let exports = await runSimple({
            code: `
                interface I {
                    foo : number;
                }

                export class C {
                    method(): [str : string, num : number] { return ['foo', 123]; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_TUPLE, e: [{ n: 'str', t: String }, { n: 'num', t: Number }] });
    });
    it('emits for returned Boolean', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    method<T>(t : T): Boolean { return false; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(Boolean);
    });
    it('emits for conditional types', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    method<T>(t : T): T extends Boolean ? boolean : string { return false; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(Object);
    });
    it('emits for type predicate types', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    isBlue(): this is D { return false; }
                }

                export class D extends C { }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'isBlue');
        expect(type()).to.equal(Boolean);
    });
    it('emits for this type', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    isBlue(): this { return this; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'isBlue');
        expect(type()).to.eql({ TΦ: T_THIS });
    });
    it('emits for returned String', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    method<T>(t : T): String { return 'hello'; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(String);
    });
    it('emits for returned Number', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    method<T>(t : T): Number { return 123; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(Number);
    });
    it('emits for literal null', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : null {
                        return 123;
                    }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_NULL });
    });
    it('emits for literal undefined', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : undefined {
                        return 123;
                    }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_UNDEFINED });
    });
    it('emits for literal false', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : false {
                        return false;
                    }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_FALSE });
    });
    it('emits for literal true', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : true {
                        return true;
                    }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_TRUE });
    });
    it('emits for literal expression', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : 3 {
                        return 3;
                    }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(3);
    });
    it('emits for unary literal expression', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : -3 {
                        return -3;
                    }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(-3);
    });
    it('emits for returned Function', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    method<T>(t : T): Function { return () => {}; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(Function);
    });
    it('emits for returned type parameter', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    method<T>(t : T): T { return t; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(Object);
    });
    it('emits for mapped types', async () => {
        let exports = await runSimple({
            code: `
                export class A {}
                type Px<T> = {
                    [P in keyof T]?: T[P];
                };
                export class C {
                    method<T>(): Px<A> { return null; }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        let type = typeResolver();

        expect(type.TΦ).to.equal(T_MAPPED);
        expect(type.t).to.equal(Object);
        expect(type.p).to.eql([exports.A]);
    });
    it('emits for mapped types from TS lib', async () => {
        let exports = await runSimple({
            code: `
                export class A {}
                export class C {
                    method<T>(): Partial<A> { return null; }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        let type = typeResolver();

        expect(type.TΦ).to.equal(T_MAPPED);
        expect(type.p).to.eql([exports.A]);
        expect(type.t).to.equal(Object);
    });
    it('emits for inferred class return type', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) { return world; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(exports.B);
    });
    it('emits for inferred interface return type', async () => {
        let exports = await runSimple({
            code: `
                export interface A {}
                export class C {
                    method(hello : A) { return hello; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(exports.IΦA);
    });
    it('emits for inferred union return type', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : string, world : number) { if (1) return hello; else return world; }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method'); let type = typeResolver();
        expect(type.TΦ).to.equal(T_UNION);
        expect(type.t.length).to.equal(2);
        expect(type.t).to.include.all.members([Number, String]);
    });
    it('emits for object literal return type', async () => {
        let exports = await runSimple({
            code: `
                type A = { foo: string, bar: number };
                export class C {
                    method(hello : string, world : number): A { return { foo: 'hello', bar: 123 }; }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method'); let type = typeResolver();
        expect(type.TΦ).to.equal(T_OBJECT);
        expect(type.m.length).to.equal(2);
        let fooT = type.m.find(x => x.n === 'foo');
        let barT = type.m.find(x => x.n === 'bar');

        expect(fooT).to.exist;
        expect(barT).to.exist;

        expect(fooT.t).to.equal(String);
        expect(barT.t).to.equal(Number);
        expect(fooT.f.includes(F_OPTIONAL)).to.be.false;
        expect(barT.f.includes(F_OPTIONAL)).to.be.false;
    });
    it('emits optionality for object literal members in return type', async () => {
        let exports = await runSimple({
            code: `
                type A = { foo?: string, bar: number };
                export class C {
                    method(hello : string, world : number): A { return { foo: 'hello', bar: 123 }; }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        let type: RtObjectType = typeResolver();
        expect(type.TΦ).to.equal(T_OBJECT);
        expect(type.m.length).to.equal(2);
        let fooT: RtObjectMember = type.m.find(x => x.n === 'foo');
        let barT: RtObjectMember = type.m.find(x => x.n === 'bar');

        expect(fooT).to.exist;
        expect(barT).to.exist;

        expect(fooT.t).to.equal(String);
        expect(fooT.f.includes(F_OPTIONAL)).to.be.true;
        expect(barT.t).to.equal(Number);
        expect(barT.f.includes(F_OPTIONAL)).to.be.false;
    });
    it('emits for inferred intersection return type', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method() { return <A & B><any>hello; }
                }
            `
        });
        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        let type = typeResolver();
        expect(type.TΦ).to.equal(T_INTERSECTION);
        expect(type.t.length).to.equal(2);
        expect(type.t).to.include.all.members([exports.B, exports.A]);
    });
    it('emits for inferred any return type (via null)', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    method() { return null; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_ANY });
    });
    it('emits for inferred undefined return type (via undefined)', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    method() { return undefined; }
                }
            `
        });
        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.eql({ TΦ: T_ANY });
    });
    it('emits for inferred boolean return type (via false)', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    method() { return false; }
                }
            `
        });
        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(Boolean);
    });
    it('emits for inferred boolean return type (via true)', async () => {
        let exports = await runSimple({
            code: `
                export class C {
                    method() { return true; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(Boolean);
    });
    it('emits for inferred intrinsic return type', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) { return 123; }
                }
            `
        });

        let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        expect(type()).to.equal(Number);
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
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : string | number {
                        return 123;
                    }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        let type = typeResolver();

        expect(type.TΦ).to.equal(T_UNION);
        expect(type.t.length).to.equal(2);
        expect(type.t).to.include.all.members([Number, String]);
    });
    it('emits for intersection return type', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : A & B {
                        return null;
                    }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        let type = typeResolver();

        expect(type.TΦ).to.equal(T_INTERSECTION);
        expect(type.t.length).to.equal(2);
        expect(type.t).to.include.all.members([exports.B, exports.A]);
    });
    it('emits for Promise return type', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) : Promise<string> {
                        return 123;
                    }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        let type = typeResolver();

        expect(type.TΦ).to.equal(T_GENERIC);
        expect(type.t).to.equal(Promise);
        expect(type.p).to.eql([String]);
    });
    it('emits for bare inferred Promise return type', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    async method(hello : A, world : B) {
                        return 123;
                    }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        let type = typeResolver();

        expect(type.TΦ).to.equal(T_GENERIC);
        expect(type.t).to.equal(Promise);
        expect(type.p).to.eql([Number]);
    });
    it('emits for union as type parameter', async () => {
        let exports = await runSimple({
            code: `
                export class A<T> { }
                export class C {
                    method() : A<number | string> {
                        return 123;
                    }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
        let type = typeResolver();

        expect(type.TΦ).to.equal(T_GENERIC);
        expect(type.t).to.equal(exports.A);
        expect(type.p[0].TΦ).to.equal(T_UNION);
        expect(type.p[0].t.length).to.equal(2);
        expect(type.p[0].t).to.include.all.members([String, Number]);
    });

    it('emits for infinite generic', async () => {
        let exports = await runSimple({
            code: `
                type A = number | B<A>;
                interface B<T> { }
                export class C {
                    foo() {
                        return <A>null;
                    }
                }
            `
        });

        let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'foo');
        let type = typeResolver();

        expect(type.TΦ).to.equal(T_UNION);

        expect(type.t).to.include.all.members([Number]);
        let generic = type.t.find(x => x.TΦ === T_GENERIC);

        expect(generic).to.exist;
        expect(generic.p[0]).to.equal(type);
    });
});
describe('rt:i', it => {
    it('emits for local interfaces implemented by a class', async () => {
        let exports = await runSimple({
            code: `
                export interface Something {}
                export interface SomethingElse {}
                export class C implements Something, SomethingElse {}
            `
        });

        let typeRefs: any[] = Reflect.getMetadata('rt:i', exports.C);

        expect(typeRefs).to.exist;
        expect(typeRefs.length).to.equal(2);
        expect(typeRefs[0]()).to.equal(exports.IΦSomething);
        expect(typeRefs[1]()).to.equal(exports.IΦSomethingElse);
    });
    it('emits for external interfaces implemented by a class', async () => {
        let IΦSomething: InterfaceToken = {
            name: 'Something',
            prototype: {},
            identity: Symbol('Something (interface)')
        };

        let IΦSomethingElse: InterfaceToken = {
            name: 'SomethingElse',
            prototype: {},
            identity: Symbol('SomethingElse (interface)')
        };

        let exports = await runSimple({
            modules: {
                other: {
                    IΦSomething, IΦSomethingElse
                }
            },
            code: `
                import { Something, SomethingElse } from 'other';
                export class C implements Something, SomethingElse {}
            `
        });

        let typeRefs: any[] = Reflect.getMetadata('rt:i', exports.C);

        expect(typeRefs).to.exist;
        expect(typeRefs.length).to.equal(2);
        expect(typeRefs[0]()).to.equal(IΦSomething);
        expect(typeRefs[1]()).to.equal(IΦSomethingElse);
    });
    it('prefers exported class over exported interface', async () => {
        let IΦSomething: InterfaceToken = {
            name: 'Something',
            prototype: {},
            identity: Symbol('Something (interface)')
        };

        let IΦSomethingElse: InterfaceToken = {
            name: 'SomethingElse',
            prototype: {},
            identity: Symbol('SomethingElse (interface)')
        };

        class Something { }

        let exports = await runSimple({
            modules: {
                other: {
                    Something, IΦSomething, IΦSomethingElse
                }
            },
            code: `
                import { Something, SomethingElse } from 'other';
                export class C implements Something, SomethingElse {}
            `
        });

        let typeRefs: any[] = Reflect.getMetadata('rt:i', exports.C);

        expect(typeRefs).to.exist;
        expect(typeRefs.length).to.equal(2);
        expect(typeRefs[0]()).to.equal(Something);
        expect(typeRefs[1]()).to.equal(IΦSomethingElse);
    });
    it('should not crash when processing a constructor which was previously transformed', async () => {
        await runSimple({
            modules: {
                'typescript-rtti': `
                    export function reflect() { }
                `
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

        (globalThis as any).__metadataDecorators = [];

        let exports = await runSimple({
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
                code = code.replace(/__RΦ\.m\(/g, `((key, value) => (__metadataDecorators.push([key, value]), __RΦ.m(key, value)))(`)
                return code;
            }
        });

        let decorators: ([key: string, value: any ])[] = (globalThis as any).__metadataDecorators;
        let count = decorators.filter(([key, value]) => key === 'rt:t').length;

        expect(count).to.equal(7);
    })
});
