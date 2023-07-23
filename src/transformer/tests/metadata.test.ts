
import { expect } from 'chai';
import { describe, it } from '@jest/globals';
import ts from 'typescript';
import * as format from '../../common/format';
import { runSimple } from '../../runner.test-harness';
import { WORKAROUND_TYPESCRIPT_49794 } from '../workarounds';

function type(obj) {
    return Reflect.getMetadata('rtti:type', obj)?.();
}

function member(type: format.RtClassType, name) {
    return type.m.find(x => x.n === name) as any;
}

function union(...types) {
    return {
        TΦ: format.T_UNION,
        t: types
    };
}

function arrayType(elementType) {
    return { TΦ: format.T_ARRAY, e: elementType };
}

function tupleType(...elements: (Function | format.RtTupleElement)[]) {
    return { TΦ: format.T_TUPLE, e: elements.map(e => typeof e === 'function' ? { t: builtinClass(e) } : e) };
}

function tupleElement(name: string, type): format.RtTupleElement {
    return { n: name, t: typeof type === 'function' ? builtinClass(type) : type };
}

function intersection(...types) {
    return {
        TΦ: format.T_INTERSECTION,
        t: types
    }
}

function literal(value) {
    if (value === null) return { TΦ: format.T_NULL };
    if (value === undefined) return { TΦ: format.T_UNDEFINED };
    if (value === true) return { TΦ: format.T_TRUE };
    if (value === false) return { TΦ: format.T_FALSE };

    return { TΦ: format.T_LITERAL, v: value };
}

function voidType() {
    return { TΦ: format.T_VOID };
}

function builtinClass(klass: Function) {
    return {
        TΦ: format.T_CLASS,
        C: klass,
        n: klass.name,
        i: [],
        m: [],
        f: `${format.F_DEFAULT_LIB}`
    };
}

function thisType() {
    return { TΦ: format.T_THIS };
}

const globals = { type, member, format, builtinClass, union, intersection, voidType, literal, arrayType,
    tupleType, tupleElement, thisType };

describe('rtti:type', () => {
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
            globals,
            checks: exports => {
                expect(member(type(exports.classes.A), 'foo').t).to.eql(builtinClass(String));
                expect(member(type(exports.classes.B), 'a').t).to.equal(type(exports.classes.A));
            }
        });
    });
    it('emits only own properties', async () => {
        await runSimple({
            code: `
                export class A {
                     foo: string;
                }

                export class B extends A {
                    bar: string;
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'foo')).not.to.exist;
                expect(member(type(exports.B), 'bar').t).to.eql(builtinClass(String));
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
                        static foobar = 321;
                        thing: MyEnum2;
                    }
                }

                export const MyClass = func();
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.MyClass), 'thing').t).to.eql({
                    TΦ: format.T_ENUM,
                    n: 'MyEnum2',
                    v: {
                        Bar: "BAR",
                        Foo: "FOO"
                    }
                });
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
            globals,
            checks: exports => {
                expect(member(type(exports.classes.B), 'a').t).to.eql({
                    TΦ: format.T_INTERFACE,
                    n: 'A',
                    e: [],
                    f: '',
                    m: [
                        {
                            n: 'foo',
                            f: format.F_PROPERTY,
                            t: builtinClass(String)
                        }
                    ]
                });
            }
        });
    });
    it('identify classes', async () => {
        await runSimple({
            code: `
                export class A { }
            `,
            globals,
            checks: exports => {
                expect(type(exports.A).TΦ).to.equal(format.T_CLASS);
            }
        });
    });
    it('identify class expressions', async () => {
        await runSimple({
            code: `
                export let A = class { }
            `,
            globals,
            checks: exports => {
                expect(type(exports.A).TΦ).to.equal(format.T_CLASS);
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
            globals,
            checks: exports => {
                expect(member(type(exports.A), 'foo').f).to.contain(format.F_INFERRED);
                expect(member(type(exports.A), 'bar').f).not.to.contain(format.F_INFERRED);
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
            globals,
            checks: exports => {
                expect(type(exports.B).f).to.contain(format.F_EXPORTED);
                expect(type(exports.A2).f).not.to.contain(format.F_EXPORTED);
            }
        });
    });
    it('identifies abstract classes', async () => {
        await runSimple({
            code: `
                export class A { }
                export abstract class B { }
            `,
            globals,
            checks: exports => {
                expect(type(exports.A).f).not.to.contain(format.F_ABSTRACT);
                expect(type(exports.B).f).to.contain(format.F_ABSTRACT);
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
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'foo').f).not.to.contain(format.F_ABSTRACT);
                expect(member(type(exports.B), 'bar').f).to.contain(format.F_ABSTRACT);
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
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'foo').f).to.contain(format.F_STATIC);
                expect(member(type(exports.B), 'bar').f).not.to.contain(format.F_STATIC);
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
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'foo').f).to.contain(format.F_STATIC);
                expect(member(type(exports.B), 'bar').f).not.to.contain(format.F_STATIC);
            }
        });
    });
    it('identifies functions', async () => {
        await runSimple({
            code: `
                export function a() { }
            `,
            globals,
            checks: exports => {
                expect(type(exports.a)).to.eql({
                    TΦ: format.T_FUNCTION,
                    f: '',
                    p: [],
                    n: 'a',
                    r: {
                        TΦ: format.T_VOID
                    }
                });
            }
        });
    });
    it('identifies structured types with a single call signature as function types', async () => {
        await runSimple({
            code: `
                type StructuredType = {
                    (foo: string): void;
                }

                export class A {
                    x: StructuredType;
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.A), 'x').t).to.deep.include(<format.RtFunctionType>{
                    TΦ: format.T_FUNCTION,
                    p: [
                        {
                            n: 'foo',
                            t: builtinClass(String)
                        }
                    ],
                    r: voidType()
                });
            }
        });
    });
    it('identifies structured types with multiple signatures', async () => {
        await runSimple({
            code: `
                type StructuredType = {
                    (): void;
                    (foo: string): void;
                }

                export class A {
                    x: StructuredType;
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.A), 'x').t).to.deep.include(<Partial<format.RtObjectType>>{
                    TΦ: format.T_OBJECT,
                    m: []
                });

                expect(member(type(exports.A), 'x').t.c).to.have.deep.members([
                    <format.RtSignature>{
                        p: [],
                        r: voidType()
                    },
                    <format.RtSignature>{
                        p: [
                            {
                                n: 'foo',
                                t: builtinClass(String)
                            }
                        ],
                        r: voidType()
                    }
                ])
            }
        });
    });
    it('identifies structured types with optional members', async () => {
        await runSimple({
            code: `
                type StructuredType = {
                    foo: boolean;
                    bar?: boolean;
                }

                export class A {
                    x: StructuredType;
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.A), 'x').t.TΦ).to.equal(format.T_OBJECT);
                expect(member(type(exports.A), 'x').t.m).to.have.deep.members([
                    <format.RtObjectMember>{ n: 'foo', f: format.F_PROPERTY, t: builtinClass(Boolean) },
                    <format.RtObjectMember>{ n: 'bar', f: `${format.F_PROPERTY}${format.F_OPTIONAL}`, t: builtinClass(Boolean) }
                ])
            }
        });
    });
    it('identifies structured types with readonly members', async () => {
        await runSimple({
            code: `
                type StructuredType = {
                    foo: boolean;
                    readonly bar: boolean;
                }

                export class A {
                    x: StructuredType;
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.A), 'x').t.TΦ).to.equal(format.T_OBJECT);
                expect(member(type(exports.A), 'x').t.m).to.have.deep.members([
                    <format.RtObjectMember>{ n: 'foo', f: format.F_PROPERTY, t: builtinClass(Boolean) },
                    <format.RtObjectMember>{ n: 'bar', f: `${format.F_PROPERTY}${format.F_READONLY}`, t: builtinClass(Boolean) }
                ])
            }
        });
    });
    it('marks properties defined via accessor', async () => {
        await runSimple({
            code: `
                type StructuredType = {
                    foo: boolean;
                    get bar(): boolean;
                }

                export class A {
                    x: StructuredType;
                }
            `,
            globals,
            checks: exports => {
                const foo = member(type(exports.A), 'x').t.m.find(x => x.n === 'foo');
                const bar = member(type(exports.A), 'x').t.m.find(x => x.n === 'bar');

                expect(foo.f).not.to.include(format.F_ACCESSOR);
                expect(bar.f).to.include(format.F_ACCESSOR);
            }
        });
    });
    it('marks accessors that have setters', async () => {
        await runSimple({
            code: `
                type StructuredType = {
                    get foo(): boolean;
                    get bar(): boolean;
                    set bar(value: boolean);
                }

                export class A {
                    x: StructuredType;
                }
            `,
            globals,
            checks: exports => {
                const foo = member(type(exports.A), 'x').t.m.find(x => x.n === 'foo');
                const bar = member(type(exports.A), 'x').t.m.find(x => x.n === 'bar');

                expect(foo.f).not.to.include(format.F_SET_ACCESSOR);
                expect(bar.f).to.include(format.F_SET_ACCESSOR);
            }
        });
    });
    it('marks accessors that have getters', async () => {
        await runSimple({
            code: `
                type StructuredType = {
                    set foo(value: boolean);
                    get bar(): boolean;
                    set bar(value: boolean);
                }

                export class A {
                    x: StructuredType;
                }
            `,
            globals,
            checks: exports => {
                const foo = member(type(exports.A), 'x').t.m.find(x => x.n === 'foo');
                const bar = member(type(exports.A), 'x').t.m.find(x => x.n === 'bar');

                expect(foo.f).not.to.include(format.F_GET_ACCESSOR);
                expect(bar.f).to.include(format.F_GET_ACCESSOR);
            }
        });
    });
    it('synthesizes readonly for accessor without setter', async () => {
        await runSimple({
            code: `
                type StructuredType = {
                    get foo(): boolean;
                    set foo(value: boolean4);
                    get bar(): boolean;
                }

                export class A {
                    x: StructuredType;
                }
            `,
            globals,
            checks: exports => {
                const foo = member(type(exports.A), 'x').t.m.find(x => x.n === 'foo');
                const bar = member(type(exports.A), 'x').t.m.find(x => x.n === 'bar');

                expect(foo.f.includes(format.F_READONLY)).to.be.false;
                expect(bar.f.includes(format.F_READONLY)).to.be.true;
            }
        });
    });
    it('identifies structured types with multiple properties and signatures', async () => {
        await runSimple({
            code: `
                type StructuredType = {
                    (): void;
                    (foo: string): void;

                    bar: number;
                    baz: string;
                }

                export class A {
                    x: StructuredType;
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.A), 'x').t.TΦ).to.equal(format.T_OBJECT);
                expect(member(type(exports.A), 'x').t.m).to.have.deep.members([
                    <format.RtObjectMember>{ n: 'bar', f: format.F_PROPERTY, t: builtinClass(Number) },
                    <format.RtObjectMember>{ n: 'baz', f: format.F_PROPERTY, t: builtinClass(String) }
                ])
                expect(member(type(exports.A), 'x').t.c).to.have.deep.members([
                    <format.RtSignature>{
                        p: [],
                        r: voidType()
                    },
                    <format.RtSignature>{
                        p: [
                            {
                                n: 'foo',
                                t: builtinClass(String)
                            }
                        ],
                        r: voidType()
                    }
                ])
            }
        });
    });
    it('identifies arrow functions', async () => {
        await runSimple({
            code: `
                export let a = () => { }
                export let b = function() { }
            `,
            globals,
            checks: exports => {
                expect(type(exports.a).f).to.contain(format.F_ARROW_FUNCTION);
                expect(type(exports.b).f).not.to.contain(format.F_ARROW_FUNCTION);
            }
        });
    });
    it('identifies async functions', async () => {
        await runSimple({
            code: `
                export function a() { }
                export async function b() { }
            `,
            globals,
            checks: exports => {
                expect(type(exports.a).f).not.to.contain(format.F_ASYNC);
                expect(type(exports.b).f).to.contain(format.F_ASYNC);
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
            globals,
            checks: exports => {
                expect(member(type(exports.A), 'foo').f).to.contain(format.F_READONLY);
                expect(member(type(exports.A), 'bar').f).not.to.contain(format.F_READONLY);
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'foo').f).to.contain(format.F_PUBLIC);
                expect(member(type(exports.C), 'bar').f).not.to.contain(format.F_PUBLIC);
                expect(member(type(exports.C), 'baz').f).not.to.contain(format.F_PUBLIC);
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'foo').f).not.to.contain(format.F_PROTECTED);
                expect(member(type(exports.C), 'bar').f).to.contain(format.F_PROTECTED);
                expect(member(type(exports.C), 'baz').f).not.to.contain(format.F_PROTECTED);
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'foo').f).not.to.contain(format.F_PRIVATE);
                expect(member(type(exports.C), 'bar').f).not.to.contain(format.F_PRIVATE);
                expect(member(type(exports.C), 'baz').f).to.contain(format.F_PRIVATE);
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'baz').f).not.to.contain(format.F_PUBLIC);
                expect(member(type(exports.C), 'baz').f).not.to.contain(format.F_PROTECTED);
                expect(member(type(exports.C), 'baz').f).not.to.contain(format.F_PRIVATE);
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'foo').f).to.contain(format.F_PUBLIC);
                expect(member(type(exports.C), 'bar').f).not.to.contain(format.F_PUBLIC);
                expect(member(type(exports.C), 'baz').f).not.to.contain(format.F_PUBLIC);
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'foo').f).not.to.contain(format.F_PROTECTED);
                expect(member(type(exports.C), 'bar').f).to.contain(format.F_PROTECTED);
                expect(member(type(exports.C), 'baz').f).not.to.contain(format.F_PROTECTED);
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'foo').f).not.to.contain(format.F_PRIVATE);
                expect(member(type(exports.C), 'bar').f).not.to.contain(format.F_PRIVATE);
                expect(member(type(exports.C), 'baz').f).to.contain(format.F_PRIVATE);
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'baz').f).not.to.contain(format.F_PUBLIC);
                expect(member(type(exports.C), 'baz').f).not.to.contain(format.F_PROTECTED);
                expect(member(type(exports.C), 'baz').f).not.to.contain(format.F_PRIVATE);
            }
        });
    });
    it('properly refers to symbols', async () => {
        await runSimple({
            code: `
                const sym = Symbol();
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
            globals,
            checks: exports => {
                expect(member(type(exports.A), 'foo')).to.exist;
                expect(member(type(exports.A), '[sym]')).to.exist;
            }
        });
    });
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
            globals,
            checks: exports => {
                expect(member(type(exports.A), 'foo')).to.exist;
                expect(member(type(exports.A), '[sym]')).to.exist;
            }
        });
    });
    it('emits for ctor params', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B {
                    constructor(hello : A) { }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'constructor')).to.exist;
                expect(member(type(exports.B), 'constructor').t).to.eql({
                    TΦ: format.T_FUNCTION,
                    f: format.F_CONSTRUCTOR,
                    p: [
                        {
                            f: format.F_PARAMETER,
                            n: 'hello',
                            t: {
                                TΦ: format.T_CLASS,
                                e: undefined,
                                f: format.F_EXPORTED,
                                i: [],
                                m: [],
                                n: 'A'
                            },
                            v: undefined
                        }
                    ],
                    r: undefined
                });
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
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'constructor')).to.exist;
                expect(member(type(exports.B), 'constructor').t).to.eql({
                    TΦ: format.T_FUNCTION,
                    f: format.F_CONSTRUCTOR,
                    p: [
                        {
                            f: format.F_PARAMETER,
                            n: 'hello',
                            t: {
                                TΦ: format.T_CLASS,
                                e: undefined,
                                f: format.F_EXPORTED,
                                i: [],
                                m: [],
                                n: 'A'
                            },
                            v: undefined
                        }
                    ],
                    r: undefined
                });
            }
        });
    });
    it('emits for inferred ctor params', async () => {
        await runSimple({
            code: `
                export class B { constructor(readonly bar = 321) { } };
            `,
            globals,
            checks: exports => {
                // let params = Reflect.getMetadata('rt:p', exports.B);
                // expect(params[0].t()).to.eql(321);
                expect(member(type(exports.B), 'constructor').t.p[0].t).eql(builtinClass(Number))

                expect(member(type(exports.B), 'constructor').t.p[0].v()).to.equal(321);
            }
        });
    });
    it('supports simple ctor param default value', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B {
                    constructor(hello = 321) { }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'constructor').t.p[0].v()).to.equal(321);
            }
        });
    });
    it.skip('supports ctor param default value with proper scoping', async () => {
        // TODO: central libraries can't do this without some special emit when the type is defined, due to scoping
        // TypeError: A is not defined

        await runSimple({
            code: `
                export class A { }
                export class B {
                    constructor(hello = new A()) { }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'constructor').t.p[0].v()).to.be.instanceOf(exports.A);
            }
        });
    });
    it('emits for ctor param marked public', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(public hello : A) { }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'hello')).to.exist;
                expect(member(type(exports.C), 'constructor').t.p[0].f).to.contain(format.F_PUBLIC);
            }
        });
    });
    it('emits for ctor param marked protected', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(protected hello : A) { }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'hello')).to.exist;
                expect(member(type(exports.C), 'constructor').t.p[0].f).to.contain(format.F_PROTECTED);
            }
        });
    });
    it('emits for ctor param marked private', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(private hello : A) { }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'hello')).to.exist;
                expect(member(type(exports.C), 'constructor').t.p[0].f).to.contain(format.F_PRIVATE);
            }
        });
    });
    it('emits for ctor param marked readonly', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(readonly hello : A) { }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'hello')).to.exist;
                expect(member(type(exports.C), 'constructor').t.p[0].f).to.contain(format.F_READONLY);
            }
        });
    });
    it('emits for ctor param marked private readonly', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    constructor(private readonly hello : A) { }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'hello')).to.exist;
                expect(member(type(exports.C), 'constructor').t.p[0].f).to.contain(format.F_PRIVATE);
                expect(member(type(exports.C), 'constructor').t.p[0].f).to.contain(format.F_READONLY);
            }
        });
    });
    it('emits F_OPTIONAL for optional ctor param', async () => {
        await runSimple({
            code: `
                export class A {
                    constructor(hello : number) { }
                }
                export class B {
                    constructor(hello? : number) { }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.A), 'constructor').t.p[0].f).not.to.contain(format.F_OPTIONAL);
                expect(member(type(exports.B), 'constructor').t.p[0].f).to.contain(format.F_OPTIONAL);
            }
        });
    });
    it('emits F_REST for rest ctor param', async () => {
        await runSimple({
            code: `
                export class A {
                    constructor(hello : number[]) { }
                }
                export class B {
                    constructor(...hello : number[]) { }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.A), 'constructor').t.p[0].f).not.to.contain(format.F_REST);
                expect(member(type(exports.B), 'constructor').t.p[0].f).to.contain(format.F_REST);
            }
        });
    });
    it('can handle recursive type reference in ctor', async () => {
        await runSimple({
            code: `
                export class A {
                    constructor(hello : A[]) { }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.A), 'constructor').t.p[0].t.e).to.equal(type(exports.A));
            }
        });
    });
    it('emits F_REST for methods', async () => {
        await runSimple({
            code: `
                export class A {
                    test1(a){}
                    test2(...a){}
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.A), 'test1').t.p[0].f ?? '').not.to.contain(format.F_REST);
                expect(member(type(exports.A), 'test2').t.p[0].f ?? '').to.contain(format.F_REST);
            }
        });
    });
    it('emits F_REST for function declarations', async () => {
        await runSimple({
            code: `
            export function test1(a){}
            export function test2(...a){}
            `,
            globals,
            checks: exports => {
                expect(type(exports.test1).p[0].f ?? '').not.to.contain(format.F_REST);
                expect(type(exports.test2).p[0].f ?? '').to.contain(format.F_REST);
            }
        });
    });
    it('emits F_REST for function expressions', async () => {
        await runSimple({
            code: `
            export const test1 = (a)=>{}
            export const test2 = (...a)=>{}
            `,
            globals,
            checks: exports => {
                expect(type(exports.test1).p[0].f ?? '').not.to.contain(format.F_REST);
                expect(type(exports.test2).p[0].f ?? '').to.contain(format.F_REST);
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
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'constructor').t.p[0].f ?? '').to.contain(format.F_OPTIONAL);
                expect(member(type(exports.B), 'constructor').t.p[0].f ?? '').to.contain(format.F_PUBLIC);

                expect(member(type(exports.C), 'constructor').t.p[0].f ?? '').to.contain(format.F_OPTIONAL);
                expect(member(type(exports.C), 'constructor').t.p[0].f ?? '').to.contain(format.F_READONLY);
            }
        });
    });
    it('emits F_OPTIONAL for optional properties', async () => {
        await runSimple({
            code: `
                export class C {
                    foo : number;
                    bar? : number;
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'foo').f ?? '').not.to.contain(format.F_OPTIONAL);
                expect(member(type(exports.C), 'bar').f ?? '').to.contain(format.F_OPTIONAL);
            }
        });
    });
    it('emits F_OPTIONAL for optional methods', async () => {
        await runSimple({
            code: `
                export class C {
                    foo() { };
                    bar?() { };
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'foo').f ?? '').not.to.contain(format.F_OPTIONAL);
                expect(member(type(exports.C), 'bar').f ?? '').to.contain(format.F_OPTIONAL);
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.p[0].n).to.equal('hello');
                expect(member(type(exports.C), 'method').t.p[0].t).to.equal(type(exports.A));
                expect(member(type(exports.C), 'method').t.p[1].n).to.equal('world');
                expect(member(type(exports.C), 'method').t.p[1].t).to.equal(type(exports.B));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.p[0].n).to.equal('hello');
                expect(member(type(exports.C), 'method').t.p[0].t).to.equal(type(exports.A));
                expect(member(type(exports.C), 'method').t.p[1].n).to.equal('world');
                expect(member(type(exports.C), 'method').t.p[1].t).to.equal(type(exports.B));
            }
        });
    });
    it('supports simple method param default value', async () => {
        await runSimple({
            code: `
                export class A { }
                export class B {
                    foo(hello = 123) { }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'foo').t.p[0].v()).to.equal(123);
            }
        });
    });
    it.skip('supports method param default value with proper scoping', async () => {
        // TODO: central libraries can't do this without some special emit when the type is defined, due to scoping
        // TypeError: A is not defined
        await runSimple({
            code: `
                export class A { }
                export class B {
                    foo(hello : A = new A()) { }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'foo').t.p[0].v()).to.be.instanceOf(exports.A);
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
            globals,
            checks: exports => {
                expect(type(exports.c).p[0].n).to.equal('hello');
                expect(type(exports.c).p[0].t).to.equal(type(exports.A));
                expect(type(exports.c).p[1].n).to.equal('world');
                expect(type(exports.c).p[1].t).to.equal(type(exports.B));
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
            globals,
            checks: exports => {
                expect(type(exports.c).p[0].n).to.equal('hello');
                expect(type(exports.c).p[0].t).to.equal(type(exports.A));
                expect(type(exports.c).p[1].n).to.equal('world');
                expect(type(exports.c).p[1].t).to.equal(type(exports.B));
            }
        });
    });
    it('supports simple param default value', async () => {
        await runSimple({
            trace: true,
            code: `
                export class A { }
                export function foo(hello = 123) { }
            `,
            globals,
            checks: exports => {
                expect(type(exports.foo).p[0].v()).to.equal(123);
            }
        });
    });
    it('supports simple calculated param default value', async () => {
        await runSimple({
            trace: true,
            code: `
                export class A { }
                export function foo(hello = 123 * 1) { }
            `,
            globals,
            checks: exports => {
                expect(type(exports.foo).p[0].v()).to.equal(123);
            }
        });
    });

    it.skip('supports function param default value with proper scoping', async () => {
        // TODO: central libraries can't do this without some special emit when the type is defined, due to scoping
        // TypeError: A is not defined

        await runSimple({
            trace: true,
            code: `
                export class A { }
                export function foo(hello : A = new A()) { }
            `,
            globals,
            checks: exports => {
                expect(type(exports.foo).p[0].v()).to.be.instanceOf(exports.A);
            }
        });
    });
    it('emits for array destructuring', async () => {
        await runSimple({
            code: `
                export function foo(foo, [bar, baz]: string[]) { }
            `,
            globals,
            checks: exports => {
                expect(type(exports.foo).p[0].n).to.equal('foo');
                expect(type(exports.foo).p[0].f ?? '').not.to.contain('[');
                expect(type(exports.foo).p[0].f ?? '').not.to.contain('O');
                expect(type(exports.foo).p[1].f ?? '').to.contain('[');
                expect(type(exports.foo).p[1].f ?? '').not.to.contain('O');
                expect(type(exports.foo).p[1].n).not.to.exist;
                expect(type(exports.foo).p[1].t).to.eql(arrayType(builtinClass(String)));
                expect(Array.isArray(type(exports.foo).p[1].b)).to.be.true;
                expect(type(exports.foo).p[1].b.length).to.equal(2);
                expect(type(exports.foo).p[1].b[0].n).to.equal('bar');
                expect(type(exports.foo).p[1].b[0].t).to.eql(builtinClass(String));
                expect(type(exports.foo).p[1].b[1].n).to.equal('baz');
                expect(type(exports.foo).p[1].b[1].t).to.eql(builtinClass(String));
            }
        });
    });
    it('emits for object destructuring', async () => {
        await runSimple({
            code: `
                export function foo(foo, {bar, baz}: { bar: string, baz: number }) { }
            `,
            globals,
            checks: exports => {
                let params: format.RtParameter[] = Reflect.getMetadata('rt:p', exports.foo);
                expect(type(exports.foo).p[0].n).to.equal('foo');
                expect(type(exports.foo).p[0].f ?? '').not.to.contain('[');
                expect(type(exports.foo).p[0].f ?? '').not.to.contain('O');
                expect(type(exports.foo).p[1].f ?? '').not.to.contain('[');
                expect(type(exports.foo).p[1].f ?? '').to.contain('O');
                expect(type(exports.foo).p[1].n).not.to.exist;
                expect(type(exports.foo).p[1].t).to.eql({
                    TΦ: "O",
                    c: [],
                    m: [
                        { n: "bar", f: format.F_PROPERTY, t: builtinClass(String) },
                        { n: "baz", f: format.F_PROPERTY, t: builtinClass(Number) }
                    ],
                    n: undefined
                });
                expect(Array.isArray(type(exports.foo).p[1].b)).to.be.true;
                expect(type(exports.foo).p[1].b.length).to.equal(2);
                expect(type(exports.foo).p[1].b[0].n).to.equal('bar');
                expect(type(exports.foo).p[1].b[0].t).to.eql(builtinClass(String));
                expect(type(exports.foo).p[1].b[1].n).to.equal('baz');
                expect(type(exports.foo).p[1].b[1].t).to.eql(builtinClass(Number));
            }
        });
    });
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
            globals,
            checks: exports => {
                expect(type(exports.A)).to.exist;
                expect(type(exports.B)).not.to.exist;
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
            globals,
            checks: exports => {
                expect(type(exports.A)).to.exist;
                expect(type(exports.B)).not.to.exist;
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'property').t).to.equal(type(exports.B));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'property').t).to.equal(type(exports.B));
            }
        });
    });
    it('emits for a promise type (no strictNullChecks)', async () => {
        await runSimple({
            code: `
                export class B {
                    async foo(): Promise<number | null> {
                        return 10
                    }
                }
            `,
            compilerOptions: {
                strictNullChecks: false
            },
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'foo').t.r).to.eql({
                    TΦ: format.T_GENERIC,
                    t: builtinClass(Promise),
                    p: [ builtinClass(Number) ]
                });
            }
        });
    });
    it('emits for a promise type (strictNullChecks)', async () => {
        await runSimple({
            code: `
                export class B {
                    async foo(): Promise<number | null> {
                        return 10
                    }
                }
            `,
            compilerOptions: {
                strictNullChecks: true
            },
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'foo').t.r).to.deep.include({
                    TΦ: format.T_GENERIC,
                    t: builtinClass(Promise),
                });

                expect(member(type(exports.B), 'foo').t.r.p[0].TΦ).to.equal(format.T_UNION);
                expect(member(type(exports.B), 'foo').t.r.p[0].t).to.deep.include(literal(null));
                expect(member(type(exports.B), 'foo').t.r.p[0].t).to.deep.include(builtinClass(Number));
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
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'thing').t.r).to.deep.include({
                    TΦ: format.T_ENUM,
                    n: 'A',
                    v: {
                        One: 1,
                        Two: 2,
                        Zero: 0
                    }
                })

            }
        });
    });
    it('emits for an enum literal', async () => {
        await runSimple({
            code: `
                export enum A {
                    Zero = 0,
                    One = 1,
                    Two = 2
                }
                export class B {
                    thing(): A.Two {
                        return A.Two;
                    }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'thing').t.r).to.deep.include({
                    TΦ: format.T_ENUM_LITERAL,
                    n: 'Two',
                    v: 2,
                    e: {
                        TΦ: format.T_ENUM,
                        n: 'A',
                        v: {
                            One: 1,
                            Two: 2,
                            Zero: 0
                        }
                    }
                })

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
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'thing').t.r).to.deep.include({
                    TΦ: format.T_ENUM,
                    n: 'ImportKind',
                    v: {
                        Named: 0,
                        Default: 1,
                        Namespace: 2,
                        CommonJS: 3
                    }
                });
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

                export class B {
                    thing(): A {
                        return A.Two;
                    }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.B), 'thing').t.r).to.deep.include({
                    TΦ: format.T_ENUM,
                    n: 'A',
                    v: {
                        Zero: 0,
                        One: 1,
                        Two: 2
                    }
                });
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'property').t).to.equal(type(exports.B));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'property').t).to.equal(type(exports.B));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.deep.include(builtinClass(Date));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'foo').t).to.deep.include({
                    TΦ: format.T_FUNCTION
                });

                expect(member(type(exports.C), 'foo').t.r.TΦ).to.equal(format.T_UNION);
                expect(member(type(exports.C), 'foo').t.r.t).to.deep.include(literal(123));
                expect(member(type(exports.C), 'foo').t.r.t).to.deep.include(literal('foo'));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'foo').t.r.TΦ).to.equal(format.T_UNION);
                expect(member(type(exports.C), 'foo').t.TΦ).to.equal('F');
                expect(member(type(exports.C), 'foo').t.r).to.eql({ 'TΦ': '|', t: [ builtinClass(String), builtinClass(Number) ] });
                expect(member(type(exports.C), 'foo').t.p.length).to.equal(2);
                expect(member(type(exports.C), 'foo').t.p[0].n).to.equal('foo');
                expect(member(type(exports.C), 'foo').t.p[0].t).to.deep.include(builtinClass(String));
                expect(member(type(exports.C), 'foo').t.p[0].v).to.equal(undefined);
                expect(member(type(exports.C), 'foo').t.p[1].n).to.equal('bar');
                expect(member(type(exports.C), 'foo').t.p[1].t).to.deep.include(builtinClass(Number));
                expect(member(type(exports.C), 'foo').t.p[1].v).to.equal(undefined);
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'foo').t.TΦ).to.equal('F');
                expect(member(type(exports.C), 'foo').t.r).to.eql({ 'TΦ': '|', t: [ builtinClass(String), builtinClass(Number) ] });
                expect(member(type(exports.C), 'foo').t.p.length).to.equal(2);
                expect(member(type(exports.C), 'foo').t.p[0].n).to.equal('foo');
                expect(member(type(exports.C), 'foo').t.p[0].t).to.eql(builtinClass(String));
                expect(member(type(exports.C), 'foo').t.p[0].v).to.equal(undefined);
                expect(member(type(exports.C), 'foo').t.p[1].n).to.equal('bar');
                expect(member(type(exports.C), 'foo').t.p[1].t).to.eql(builtinClass(Number));
                expect(member(type(exports.C), 'foo').t.p[1].v).to.equal(undefined);
                expect(member(type(exports.C), 'foo').t.f).to.equal('');
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.equal(type(exports.B));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.equal(type(exports.B));
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
            globals,
            checks: exports => {
                expect(type(exports.c).r).to.equal(type(exports.B));
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
            globals,
            checks: exports => {
                expect(type(exports.c).r).to.equal(type(exports.B));
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
            globals,
            checks: exports => {
                expect(type(exports.c).r).to.equal(type(exports.B));
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
            globals,
            checks: exports => {
                expect(type(exports.c).r).to.equal(type(exports.B));
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
            globals,
            checks: exports => {
                expect(type(exports.c).r).to.equal(type(exports.B));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.equal(type(exports.B));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.include({
                    TΦ: format.T_INTERFACE,
                    n: 'I'
                });

                expect(member(type(exports.C), 'method').t.r.m).to.deep.include({ f: format.F_PROPERTY, n: "foo", t: builtinClass(Number) });
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql({ TΦ: format.T_UNKNOWN });
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(voidType());
            }
        });
    });
    it('emits for any return type', async () => {
        await runSimple({
            code: `
                export class C {
                    method(): any { return null; }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql({ TΦ: format.T_ANY });
            }
        });
    });
    it('emits for array types', async () => {
        await runSimple({
            code: `
                export class C {
                    method(): string[] { return null; }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(arrayType(builtinClass(String)));
            }
        });
    });
    it('emits for array types', async () => {
        await runSimple({
            code: `
                export class C {
                    method(): Array<string> { return null; }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(arrayType(builtinClass(String)));
            }
        });
    });
    it('emits for array types with specific tsconfig', async () => {
        await runSimple({
            code: `
                export class C {
                    method(): string[] { return []; }
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(arrayType(builtinClass(String)));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(arrayType(arrayType(builtinClass(String))));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(tupleType(String, Number));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(
                    tupleType(
                        tupleElement('str', String),
                        tupleElement('num', Number)
                    )
                );
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(builtinClass(Boolean));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(builtinClass(Object)); // TODO
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'isBlue').t.r).to.eql(builtinClass(Boolean)); // TODO
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'isBlue').t.r).to.eql(thisType());
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(builtinClass(String));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(builtinClass(Number));
            }
        });
    });


    const LITERALS: any[] = [
        null, undefined, true, false, 3, -3, 0,
        `bigint:3`, `bigint:322222222222222222222`,
        'hello', '', 'Φ', '✨'
    ];
    for (const LITERAL of LITERALS) {
        let stringRep: string;
        if (typeof LITERAL === 'string' && LITERAL.startsWith('bigint:')) {
            stringRep = `${LITERAL.replace(/^bigint:/, '')}n`;
        } else {
            stringRep = JSON.stringify(LITERAL);
        }

        it(`emits for literal ${stringRep}`, async () => {
            await runSimple({
                code: `
                    export class A { }
                    export class B { }
                    export class C {
                        method(hello : A, world : B): ${stringRep} {
                            return ${stringRep};
                        }
                    }
                `,
                compilerOptions: {
                    target: ts.ScriptTarget.ES2020
                },
                globals: { ...globals, LITERAL },
                checks: exports => {
                    let value = LITERAL;

                    if (typeof value === 'string' && value.startsWith('bigint:')) {
                        value = BigInt(`${value.replace(/^bigint:/, '')}`);
                    }

                    expect(member(type(exports.C), 'method').t.r).to.include(literal(value));
                }
            });
        });
    }

    it('emits for returned Function', async () => {
        await runSimple({
            code: `
                export class C {
                    method<T>(t : T): Function { return () => {}; }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(builtinClass(Function));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r)
                    .to.eql(builtinClass(Object)); // TODO generic parameter type
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(<format.RtMappedType>{
                    TΦ: format.T_MAPPED,
                    p: [ type(exports.A) ],
                    m: [],
                    t: builtinClass(Object)
                });
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(<format.RtMappedType>{
                    TΦ: format.T_MAPPED,
                    p: [ type(exports.A) ],
                    m: [
                        { n: 'foo', t: builtinClass(Number), f: `${format.F_PROPERTY}${format.F_OPTIONAL}` }
                    ],
                    t: builtinClass(Object)
                });
            }
        });
    });
    it('emits for mapped types and realizes the resulting type with methods', async () => {
        await runSimple({
            code: `
                export class A {
                    foo(): number;
                }
                type Px<T> = {
                    [P in keyof T]?: T[P];
                };
                export class C {
                    method<T>(): Px<A> { return null; }
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(<format.RtMappedType>{
                    TΦ: format.T_MAPPED,
                    p: [ type(exports.A) ],
                    m: [
                        {
                            n: 'foo',
                            t: <format.RtFunctionType>{
                                TΦ: format.T_FUNCTION,
                                r: builtinClass(Number),
                                f: '',
                                n: 'foo',
                                p: []
                            },
                            f: `${format.F_PROPERTY}${format.F_OPTIONAL}`
                        }
                    ],
                    t: builtinClass(Object)
                });
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(<format.RtMappedType>{
                    TΦ: format.T_MAPPED,
                    p: [ type(exports.A) ],
                    m: [],
                    t: builtinClass(Object)
                });
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(type(exports.B));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(<format.RtInterfaceType>{
                    TΦ: format.T_INTERFACE,
                    n: 'A',
                    m: [],
                    e: [],
                    f: `${format.F_EXPORTED}`
                });
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r.TΦ).to.equal(format.T_UNION);
                expect(member(type(exports.C), 'method').t.r.t)
                    .to.deep.include.all.members([ builtinClass(Number), builtinClass(String) ]);
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r.TΦ).to.equal(format.T_OBJECT);
                expect(member(type(exports.C), 'method').t.r.m.length).to.equal(2);

                let fooT = member(type(exports.C), 'method').t.r.m.find(x => x.n === 'foo');
                let barT = member(type(exports.C), 'method').t.r.m.find(x => x.n === 'bar');

                expect(fooT).to.exist;
                expect(barT).to.exist;

                expect(fooT.t).to.eql(builtinClass(String));
                expect(barT.t).to.eql(builtinClass(Number));
                expect(fooT.f.includes(format.F_OPTIONAL)).to.be.false;
                expect(barT.f.includes(format.F_OPTIONAL)).to.be.false;
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
            globals,
            checks: exports => {
                let x = member(type(exports.C), 'method').t.r;
                expect(x.TΦ).to.equal('O');
                expect(x.m.length).to.equal(2);
                let fooT: format.RtObjectMember = x.m.find(x => x.n === 'foo');
                let barT: format.RtObjectMember = x.m.find(x => x.n === 'bar');

                expect(fooT).to.exist;
                expect(barT).to.exist;

                expect(fooT.t).to.eql(builtinClass(String));
                expect(fooT.f.includes(format.F_OPTIONAL)).to.be.true;
                expect(barT.t).to.eql(builtinClass(Number));
                expect(barT.f.includes(format.F_OPTIONAL)).to.be.false;
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
            globals,
            checks: exports => {
                let x = member(type(exports.C), 'method').t.r;
                expect(x.TΦ).to.equal(format.T_INTERSECTION);
                expect(x.t.length).to.equal(2);
                expect(x.t).to.include.all.members([type(exports.B), type(exports.A)]);
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql({ TΦ: format.T_ANY });
            }
        });
    });
    it('emits for inferred null return type (strictNullChecks)', async () => {
        await runSimple({
            code: `
                export class C {
                    method() { return null; }
                }
            `,
            compilerOptions: {
                strictNullChecks: true
            },
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql({ TΦ: format.T_NULL });
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql({ TΦ: format.T_ANY });
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
            globals,
            compilerOptions: {
                strictNullChecks: true
            },
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql({ TΦ: format.T_UNDEFINED });
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(builtinClass(Boolean));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(builtinClass(Boolean));
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
            globals,
            checks: exports => {
                expect(member(type(exports.C), 'method').t.r).to.eql(builtinClass(Number));
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
            globals,
            checks: exports => {
                let x = member(type(exports.C), 'method').t.r;

                expect(x.TΦ).to.equal(format.T_UNION);
                expect(x.t.length).to.equal(2);
                expect(x.t).to.deep.include.all.members([builtinClass(Number), builtinClass(String)]);
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
            globals,
            checks: exports => {
                let x = member(type(exports.C), 'method').t.r;

                expect(x.TΦ).to.equal(format.T_INTERSECTION);
                expect(x.t.length).to.equal(2);
                expect(x.t).to.include.all.members([type(exports.B), type(exports.A)]);
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
            globals,
            checks: exports => {
                let x = member(type(exports.C), 'method').t.r;

                expect(x.TΦ).to.equal(format.T_GENERIC);
                expect(x.t).to.eql(builtinClass(Promise));
                expect(x.p).to.eql([builtinClass(String)]);
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
            globals,
            checks: exports => {
                let x = member(type(exports.C), 'method').t.r;

                expect(x.TΦ).to.equal(format.T_GENERIC);
                expect(x.t).to.eql(builtinClass(Promise));
                expect(x.p).to.eql([builtinClass(Number)]);
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
            globals,
            checks: exports => {
                let x = member(type(exports.C), 'method').t.r;

                expect(x.TΦ).to.equal(format.T_GENERIC);
                expect(x.t).to.equal(type(exports.A));
                expect(x.p[0].TΦ).to.equal(format.T_UNION);
                expect(x.p[0].t.length).to.equal(2);
                expect(x.p[0].t).to.deep.include.all.members([builtinClass(String), builtinClass(Number)]);
            }
        });
    });
    it('emits for infinite generic', async () => {
        await runSimple({
            code: `
                type A = number | B<A>;
                interface B<T> { }
                export class C {
                    method() {
                        return <A>null;
                    }
                }
            `,
            globals,
            checks: exports => {
                let x = member(type(exports.C), 'method').t.r;

                expect(x.TΦ).to.equal(format.T_UNION);

                expect(x.t).to.deep.include.all.members([builtinClass(Number)]);
                let generic = x.t.find(x => x.TΦ === format.T_GENERIC);

                expect(generic).to.exist;
                expect(generic.p[0]).to.equal(x);
            }
        });
    });
    it('emits for local interfaces implemented by a class', async () => {
        await runSimple({
            code: `
                export interface Something {}
                export interface SomethingElse {}
                export class C implements Something, SomethingElse {}
            `,
            globals,
            checks: exports => {
                let typeRefs: any[] = type(exports.C).i;

                expect(typeRefs).to.exist;
                expect(typeRefs.length).to.equal(2);
                expect(typeRefs[0].n).to.equal('Something');
                expect(typeRefs[1].n).to.equal('SomethingElse');
            }
        });
    });
    it('emits for external interfaces implemented by a class', async () => {
        await runSimple({
            modules: {
                other: {
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
            globals,
            checks: exports => {
                let typeRefs: any[] = type(exports.C).i;

                expect(typeRefs).to.exist;
                expect(typeRefs.length).to.equal(2);
                expect(typeRefs[0].n).to.equal('Something');
                expect(typeRefs[1].n).to.equal('SomethingElse');
            }
        });
    });
    it('prefers exported class over exported interface', async () => {
        await runSimple({
            modules: {
                other: {
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
            globals,
            checks: exports => {
                let typeRefs: any[] = type(exports.C).i;

                expect(typeRefs).to.exist;
                expect(typeRefs.length).to.equal(2);
                expect(typeRefs[0].n).to.equal('Something');
                expect(typeRefs[0].TΦ).to.equal(format.T_CLASS);
                expect(typeRefs[1].n).to.equal('SomethingElse');
                expect(typeRefs[1].TΦ).to.equal(format.T_INTERFACE);
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
                    e:string;
                    f:string;
                    g:string;
                }
            `,
            outputTransformer(filename, code) {
                code = code.replace(/__RΦ\.m\(/g, `((key, value) => ((globalThis.__metadataDecorators = globalThis.__metadataDecorators ?? []).push([key, value]), __RΦ.m(key, value)))(`)
                return code;
            },
            globals,
            checks: exports => {
                let decorators: ([key: string, value: any ])[] = (globalThis as any).__metadataDecorators;
                let count = decorators.filter(([key, value]) => key === 'rtti:type').length;

                expect(count).to.equal(1);
            }
        });
    })
    it('emits correctly for bound imports', async () => {
        await runSimple({
            code: `
                import { A } from "./lib.js";
                export { A };

                export class C {
                    method(hello : A) { return 123; }
                }
            `,
            modules: {
                './lib.ts': `
                    export class A { }
                `
            },
            globals,
            checks: exports => {
                expect(member(type(exports.C),'method').t.p[0].t).to.eql(type(exports.A));
            }
        });
    });
    it('emits correctly for star imports', async () => {
        await runSimple({
            code: `
                import * as lib from "./libf.js";
                export { A } from "./libf.js";

                export class C {
                    method(hello : lib.A) { return 123; }
                }
            `,
            modules: {
                './libf.ts': `
                    export class A { }
                `
            },
            globals,
            checks: exports => {
                expect(member(type(exports.C),'method').t.p[0].t).to.eql(type(exports.A));
            }
        });
    });
    it('emits correctly for classes imported via type import', async () => {
        await runSimple({
            code: `
                import type * as foo from "foo";
                export class C {
                    foo: foo.Foo;
                }
            `,
            modules: {
                'foo': {
                    Foo: class {
                        bar: number
                    }
                },
                '@types/foo': `
                    export class Foo {
                        bar: number;
                    }
                `
            },
            globals,
            checks: exports => {
                expect(member(type(exports.C),'foo').t).to.eql(<format.RtClassType>{
                    TΦ: format.T_CLASS,
                    e: undefined,
                    f: `${format.F_EXPORTED}`,
                    i: [],
                    n: 'Foo',
                    m: [ { n: 'bar', f: `${format.F_PROPERTY}`, t: builtinClass(Number) } ]
                });
            }
        });
    });
    it('can emit a class imported as default', async () => {
        await runSimple({
            code: `
                import A from "./foo.js";
                export { A };
                export class B {
                    constructor(hello : A) { }
                }
            `,
            modules: {
                './foo.ts': `
                    export default class A { }
                `
            },
            globals,
            checks: exports => {
                let params = member(type(exports.B), 'constructor').t.p;
                expect(params.length).to.equal(1);
                expect(params[0].t).to.eql(type(exports.A));
            }
        });
    });
    it('emits correctly for interfaces imported via type import', async () => {
        await runSimple({
            code: `
                import type * as foo from "foo";
                export class C {
                    foo: foo.Foo;
                }
            `,
            modules: {
                'foo': {
                },
                '@types/foo': `
                    export interface Foo {
                        bar: number;
                    }
                `
            },
            globals,
            checks: exports => {
                expect(member(type(exports.C),'foo').t).to.eql(<format.RtInterfaceType>{
                    TΦ: format.T_INTERFACE,
                    e: [],
                    f: `${format.F_EXPORTED}`,
                    n: 'Foo',
                    m: [ { n: 'bar', f: `${format.F_PROPERTY}`, t: builtinClass(Number) } ]
                });
            }
        });
    });
    it('emits correctly for non-default re-export of a default export', async () => {
        await runSimple({
            code: `
                import { A } from "./libf.js";
                export function f(a : A) { }
                export { A } from "./libf.js";
            `,
            modules: {
                './libf.ts': `
                    export { default as A } from './a.js'
                `,
                './a.ts': `
                    export default class A {
                        method(hello : A) { return 123; }
                    }
                `
            },
            globals,
            checks: exports => {
                let params = type(exports.f).p;
                expect(params[0].t).to.eql(type(exports.A));
            }
        });
    });
});

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

describe('Transformer: Generic transience', () => {
    it('stuffs undefined on call args when needed', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';
                export function a<T>(foo? : number, call? : CallSite) {
                    return call;
                }

                export function b() {
                    return a<String>();
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            globals,
            checks: exports => {
                expect(exports.b()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [],
                    r: undefined,
                    tp: [ builtinClass(String) ],
                });
            }
        });
    });
    it('is supported at the top level', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { CallSite } from 'typescript-rtti';
                export function a<T>(foo? : number, call? : CallSite) {
                    return call;
                }

                export const t = a<String>();
            `,
            modules: {
                'typescript-rtti': {}
            },
            globals,
            checks: exports => {
                expect(exports.t).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [],
                    r: undefined,
                    tp: [ builtinClass(String) ],
                });
            }
        });
    });
    it('is supported in function calls', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { CallSite } from 'typescript-rtti';
                export function a<T>(foo? : number, call? : CallSite) {
                    return call;
                }

                function wrap(t) { return t; }
                export const t = wrap(a<String>());
            `,
            modules: {
                'typescript-rtti': {}
            },
            globals,
            checks: exports => {
                expect(exports.t).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [],
                    r: undefined,
                    tp: [builtinClass(String)],
                });
            }
        });
    });
    it('reflects generic transience via JSDoc', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';

                /**
                 * @rtti:callsite 1
                 */
                export function a<T>(foo : number, call?) {
                    return call;
                }

                export function b() {
                    return a<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            globals,
            checks: exports => {
                expect(exports.b()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [literal(123)],
                    r: undefined,
                    tp: [builtinClass(String)],
                });
            }
        });
    });
    it('reflects generic transience via JSDoc with other JSDoc', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';

                /**
                 * This is the thing
                 *
                 * @param foo {string}
                 * @foo 123
                 * @rtti:callsite 1
                 */
                export function a<T>(foo : number, call?) {
                    return call;
                }

                export function b() {
                    return a<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            globals,
            checks: exports => {
                expect(exports.b()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [ literal(123) ],
                    r: undefined,
                    tp: [ builtinClass(String) ],
                });
            }
        });
    });
    it('reflects generic transience via call-site reflection on function declarations', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';
                export function a<T>(foo : number, call? : CallSite) {
                    return call;
                }

                export function b() {
                    return a<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            globals,
            checks: exports => {
                expect(exports.b()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [ literal(123) ],
                    r: undefined,
                    tp: [ builtinClass(String) ],
                });
            }
        });
    });
    it('reflects nsted generic transience via call-site reflection on function expressions', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';
                let a = (function<T>(foo : number, call? : CallSite) {
                    return call;
                });

                let b = (function<T>(foo : number, call? : CallSite) {
                    return a<T>(123);
                });

                export function c() {
                    return b<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            globals,
            checks: exports => {
                expect(exports.c()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [ literal(123) ],
                    r: undefined,
                    tp: [ builtinClass(String) ],
                });
            }
        });
    });
    it('reflects nested generic transience via call-site reflection on arrow functions', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';
                let a = (<T>(foo : number, call? : CallSite) => {
                    return call;
                });

                let b = (<T>(foo : number, call? : CallSite) => {
                    return a<T>(foo);
                });

                export function c() {
                    return b<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            globals,
            checks: exports => {
                expect(exports.c()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [ builtinClass(Number) ],
                    r: undefined,
                    tp: [ builtinClass(String) ],
                });
            }
        });
    });
    it('reflects generic transience to reflect<T>()', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';
                export function a<T>(call? : CallSite) {
                    return reflect<T>();
                }

                export function b() {
                    return a<String>();
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: (_, callsite) => callsite
                }
            },
            globals,
            checks: exports => {
                expect(exports.b().tp[0]).to.eql(builtinClass(String));
            }
        });
    });
    it('reflects nested generic transience via call-site reflection on methods', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';

                class A {
                    foo<T>(foo : number, call? : CallSite) {
                        return call;
                    }
                }

                class B {
                    bar<T>(foo : number, call? : CallSite) {
                        let a = new A();
                        return a.foo<T>(foo);
                    }
                }

                export function c() {
                    return new B().bar<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            globals,
            checks: exports => {
                expect(exports.c()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [ builtinClass(Number) ],
                    r: undefined,
                    tp: [ builtinClass(String) ],
                });
            }
        });
    });
    it('does not output call-site metadata unless opted in', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';
                export function a<T>(foo : number) {
                    return arguments.length;
                }

                export function b() {
                    return a<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            globals,
            checks: exports => {
                expect(exports.b()).to.equal(1);
            }
        });
    });
    it('passes nested call site information', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';

                export function a<T>(foo : number, call? : CallSite) {
                    return call;
                }

                export function b<T>(foo : number, call? : CallSite) {
                    return a<T>(foo);
                }

                export function c() {
                    return b<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            globals,
            checks: exports => {
                expect(exports.c()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [ builtinClass(Number) ],
                    r: undefined,
                    tp: [ builtinClass(String) ],
                });
            }
        });
    });
    it('does not pass nested call site information without opting in', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';

                export function a<T>(foo : number, call? : CallSite) {
                    return call;
                }

                export function b<T>(foo : number) {
                    return a<T>(foo);
                }

                export function c() {
                    return b<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            globals,
            checks: exports => {
                expect(exports.c()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [ builtinClass(Number) ],
                    r: undefined,
                    tp: [ builtinClass(Object) ],
                });
            }
        });
    });
    it(`name is correct on default export interface`, async () => {
        await runSimple({
            modules: {
                "./IMovable.ts": `
                    export default interface IMovable {
                        position: Array<number>
                        readonly movementVelocity: Array<number>
                    }
                `
            },
            code: `
                import IMovable from './IMovable.js';

                export class A {
                    property: IMovable;
                }
            `,
            globals,
            checks: exports => {
                expect(member(type(exports.A), 'property').t.n).to.equal('IMovable');
            }
        });
    });
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