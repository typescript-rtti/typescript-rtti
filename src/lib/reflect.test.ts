import { describe, it } from "@jest/globals";
import { expect } from "chai";
import { ClassType, FunctionType, Type } from "./reflect";
import * as format from '../common/format';
import { reflect, Method } from "./reflect";
import { builtinClass, functionType, genericType, literal, reflectClassType, reflectFunctionType, reflectInterfaceType, voidType } from './utils.test-harness';

/**
 * @rtti:skip
 */
describe('InterfaceType', () => {
    it('reflects interfaces', () => {
        let type = reflectInterfaceType({
            m: [
                { f: format.F_PROPERTY, n: 'foobar', t: builtinClass(Number) },
                { f: format.F_PROPERTY, n: 'foobaz', t: builtinClass(String) },
                { f: format.F_METHOD, n: 'helloWorld', t: functionType([
                    { n: 'message', t: builtinClass(String) },
                    { n: 'size', t: builtinClass(Number) }
                ], builtinClass(Boolean)) }
            ]
        })

        let foobar = type.getProperty('foobar');
        let foobaz = type.getProperty('foobaz');
        let helloWorld = type.getMethod('helloWorld');

        expect(foobar.type.kind).to.equal('class');
        expect(foobar.type.isBuiltinClass(Number)).to.be.true;
        expect(foobar.type.isBuiltinClass(String)).to.be.false;

        expect(foobaz.type.kind).to.equal('class');
        expect(foobaz.type.isBuiltinClass(String)).to.be.true;
        expect(foobaz.type.isBuiltinClass(Number)).to.be.false;

        expect(helloWorld.returnType.kind).to.equal('class');
        expect(helloWorld.returnType.isBuiltinClass(Boolean)).to.be.true;
        expect(helloWorld.returnType.isBuiltinClass(Number)).to.be.false;

        expect(helloWorld.parameters.length).to.equal(2);
        expect(helloWorld.parameters[0].name).to.equal('message');
        expect(helloWorld.parameters[0].type.isBuiltinClass(String)).to.be.true;
        expect(helloWorld.parameters[1].name).to.equal('size');
        expect(helloWorld.parameters[1].type.isBuiltinClass(Number)).to.be.true;
        expect(helloWorld.parameters.map(pt => pt.type.as('class').class)).to.eql([String, Number]);
    });
    it('ownMethods includes only the own methods', () => {
        let type = reflectInterfaceType({
            e: [
                {
                    TΦ: format.T_INTERFACE,
                    n: 'A',
                    m: [
                        { f: format.F_METHOD, n: 'foo', t: functionType([], voidType()) }
                    ]
                }
            ],
            m: [
                { f: format.F_METHOD, n: 'bar', t: functionType([], voidType()) }
            ]
        })

        const IΦA = { name: 'A', prototype: {}, identity: Symbol('A') };
        Reflect.defineMetadata('rt:P', ['foo'], IΦA);
        const IΦB = { name: 'B', prototype: {}, identity: Symbol('B') };
        Reflect.defineMetadata('rt:P', ['bar'], IΦB);

        Reflect.defineMetadata('rt:P', ['foo'], IΦA);
        Reflect.defineMetadata('rt:P', ['bar'], IΦB);

        expect(type.getOwnMethod('foo')).not.to.exist;
        expect(type.getOwnMethod('bar')).to.exist;
    });
});

/**
 * @rtti:skip
 */
describe('ClassType', () => {
    describe('getOwnProperty', () => {
        it('includes only the own methods', () => {
            let type = reflectClassType({
                e: {
                    TΦ: format.T_CLASS,
                    n: 'A',
                    m: [
                        { f: format.F_METHOD, n: 'foo', t: functionType([], voidType()) }
                    ]
                },
                m: [
                    { f: format.F_METHOD, n: 'bar', t: functionType([], voidType()) }
                ]
            })

            expect(type.getOwnMethod('foo')).not.to.exist;
            expect(type.getOwnMethod('bar')).to.exist;
        });
    });
    describe('getOwnProperty', () => {
        it('includes only the own properties', () => {
            let type = reflectClassType({
                e: {
                    TΦ: format.T_CLASS,
                    n: 'A',
                    m: [
                        { f: format.F_PROPERTY, n: 'foo', t: builtinClass(String) }
                    ]
                },
                m: [
                    { f: format.F_PROPERTY, n: 'bar', t: builtinClass(String) }
                ]
            })

            expect(type.getOwnProperty('foo')).not.to.exist;
            expect(type.getOwnProperty('bar')).to.exist;
        });
    });
    it('can reflect constructor parameters', () => {
        let type = reflectClassType({
            m: [
                {
                    f: format.F_CONSTRUCTOR,
                    n: 'constructor',
                    t: functionType(
                        [
                            { n: 'a', t: builtinClass(Number) },
                            { n: 'b', t: builtinClass(String) }
                        ],
                        voidType()
                    )
                }
            ]
        })

        let ctor = type.constructors[0];

        expect(ctor.parameters.length).to.equal(2);

        let [a, b] = ctor.parameters;
        expect(a.type.isBuiltinClass(Number)).to.be.true;
        expect(a.name).to.equal('a');
        expect(b.type.isBuiltinClass(String)).to.be.true;
        expect(b.name).to.equal('b');
    });
    it('can reflect on a primitive value', () => {
        expect(reflect(123) instanceof ClassType).to.be.true;
    });
    it('can reflect abstract', () => {
        expect(reflectClassType({ f: '',                m: [] }).isAbstract).to.be.false;
        expect(reflectClassType({ f: format.F_ABSTRACT, m: [] }).isAbstract).to.be.true;
    });
    it('can reflect upon inherited methods', () => {
        let type = reflectClassType({
            e: {
                TΦ: format.T_CLASS,
                m: [
                    { f: format.F_METHOD, n: 'foo', t: functionType([], builtinClass(Number)) }
                ]
            },
            m: []
        });

        expect(type.getMethod('foo').returnType.isBuiltinClass(Number)).to.be.true;
    });
    it('can reflect upon inherited properties', () => {
        let type = reflectClassType({
            e: {
                TΦ: format.T_CLASS,
                m: [
                    { f: format.F_PROPERTY, n: 'foo', t: builtinClass(Number) }
                ]
            },
            m: []
        });

        expect(type.getProperty('foo').type.isBuiltinClass(Number)).to.be.true;
    });
    it('reflects enum refs', () => {
        let ref = Type.createFromRtRef({
            TΦ: format.T_ENUM,
            n: 'MyEnum',
            v: {
                Zero: 0,
                One: 1,
                Two: 2
            }
        });

        expect(ref.kind).to.equal('enum');
        expect(ref.as('enum').nameSet.has('Zero')).to.be.true;
        expect(ref.as('enum').nameSet.has('One')).to.be.true;
        expect(ref.as('enum').nameSet.has('Two')).to.be.true;
        expect(ref.as('enum').nameSet.has('Three')).to.be.false;
        expect(ref.as('enum').name).to.equal('MyEnum');
    });
    it('reflects implemented interfaces', () => {
        let klass = reflectClassType({
            i: [
                {
                    TΦ: format.T_INTERFACE,
                    n: 'Something',
                    m: []
                },
                {
                    TΦ: format.T_INTERFACE,
                    n: 'SomethingElse',
                    m: []
                }
            ],
            m: []
        });

        expect(klass.interfaces.length).to.equal(2);
        expect(klass.interfaces[0].as('interface').name).to.equal('Something');
        expect(klass.interfaces[1].as('interface').name).to.equal('SomethingElse');
    });
});

/**
 * @rtti:skip
 */
describe('Type', () => {
    it('reflects null type',        () => { expect(Type.createFromRtRef(literal(null)).isNull()).to.be.true });
    it('reflects undefined type',   () => { expect(Type.createFromRtRef(literal(undefined)).isUndefined()).to.be.true });
    it('reflects void type',        () => { expect(Type.createFromRtRef(voidType()).isVoid()).to.be.true });
    it('reflects any type',         () => { expect(Type.createFromRtRef({ TΦ: format.T_ANY }).isAny()).to.be.true });
    it('reflects false type',       () => { expect(Type.createFromRtRef(literal(false)).isFalse()).to.be.true });
    it('reflects true type',        () => { expect(Type.createFromRtRef(literal(true)).isTrue()).to.be.true });
    it('reflects unknown type',     () => { expect(Type.createFromRtRef({ TΦ: format.T_UNKNOWN }).isUnknown()).to.be.true });
});

/**
 * @rtti:skip
 */
describe('Method', () => {
    describe('.from()', () => {
        it('returns a Method when passed a method', () => {
            class A { foo() { } }

            Reflect.defineMetadata('rtti:type', () => (<format.RtClassType>{
                TΦ: format.T_CLASS,
                m: [
                    { f: format.F_METHOD, n: 'foo', t: functionType([], builtinClass(String)) }
                ]
            }), A);

            Reflect.defineMetadata('rt:f', `${format.F_METHOD}`, A.prototype.foo);
            Reflect.defineMetadata('rt:h', () => A, A.prototype.foo);

            expect(Method.from(A.prototype.foo)).to.be.an.instanceOf(Method);
            expect(Method.from(A.prototype.foo).name).to.equal('foo');
            expect(Method.from(A.prototype.foo).returnType.isBuiltinClass(String)).to.be.true;
        });
        it('returns a Method when passing in a static method', () => {
            class A { static foo() { } }
            Reflect.defineMetadata('rtti:type', () => (<format.RtClassType>{
                TΦ: format.T_CLASS,
                m: [
                    { f: `${format.F_METHOD}${format.F_STATIC}`, n: 'foo', t: functionType([], builtinClass(String)) }
                ]
            }), A);

            Reflect.defineMetadata('rt:f', `${format.F_METHOD}${format.F_STATIC}`, A.foo);
            Reflect.defineMetadata('rt:h', () => A, A.foo);

            expect(Method.from(A.foo)).to.be.an.instanceOf(Method);
            expect(Method.from(A.foo).name).to.equal('foo');
            expect(Method.from(A.foo).returnType.isBuiltinClass(String)).to.be.true;
        });
    });
    it('reflects whether the return type is inferred', () => {
        let klass = reflectClassType({
            m: [
                { f: `${format.F_METHOD}${format.F_INFERRED}`, n: 'foo', t: functionType([], builtinClass(String)) },
                { f: `${format.F_METHOD}`, n: 'bar', t: functionType([], builtinClass(String)) }
            ]
        })

        expect(klass.ownMethods.find(x => x.name === 'foo').returnTypeInferred).to.be.true;
        expect(klass.ownMethods.find(x => x.name === 'bar').returnTypeInferred).to.be.false;
    });
    it('reflects public', () => {
        let klass = reflectClassType({
            m: [
                { f: `${format.F_METHOD}${format.F_PUBLIC}`, n: 'foo', t: functionType([], builtinClass(String)) },
                { f: `${format.F_METHOD}`, n: 'bar', t: functionType([], builtinClass(String)) }
            ]
        })

        expect(klass.getMethod('foo').isMarkedPublic).to.equal(true);
        expect(klass.getMethod('foo').visibility).to.equal('public');

        expect(klass.getMethod('bar').isMarkedPublic).to.equal(false);
        expect(klass.getMethod('bar').visibility).to.equal('public');
    });
    it('reflects protected', () => {
        let klass = reflectClassType({
            m: [
                { f: `${format.F_METHOD}${format.F_PROTECTED}`, n: 'foo', t: functionType([], builtinClass(String)) },
                { f: `${format.F_METHOD}`, n: 'bar', t: functionType([], builtinClass(String)) }
            ]
        })

        expect(klass.getMethod('foo').visibility).to.equal('protected');
        expect(klass.getMethod('bar').visibility).to.equal('public');
    });
    it('reflects private', () => {
        let klass = reflectClassType({
            m: [
                { f: `${format.F_METHOD}${format.F_PRIVATE}`, n: 'foo', t: functionType([], builtinClass(String)) },
                { f: `${format.F_METHOD}`, n: 'bar', t: functionType([], builtinClass(String)) }
            ]
        })

        expect(klass.getMethod('foo').visibility).to.equal('private');
        expect(klass.getMethod('bar').visibility).to.equal('public');
    });
    it('reflects async', () => {
        let klass = reflectClassType({
            m: [
                { f: `${format.F_METHOD}${format.F_ASYNC}`, n: 'foo', t: functionType([], builtinClass(String)) },
                { f: `${format.F_METHOD}`, n: 'bar', t: functionType([], builtinClass(String)) }
            ]
        })

        expect(klass.getMethod('foo').isAsync).to.equal(true);
        expect(klass.getMethod('bar').isAsync).to.equal(false);
    });
    it('reflects return type', () => {
        let klass = reflectClassType({
            m: [
                { f: `${format.F_METHOD}${format.F_ASYNC}`, n: 'foo', t: functionType([], builtinClass(String)) },
                { f: `${format.F_METHOD}`, n: 'bar', t: functionType([], voidType()) }
            ]
        });
        expect(klass.getMethod('foo').returnType.isBuiltinClass(String)).to.be.true;
        expect(klass.getMethod('bar').returnType.isVoid()).to.be.true;
    });
    it('reflects generic return type', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_METHOD}`,
                    n: 'foo',
                    t: functionType([], genericType(builtinClass(Promise), [ builtinClass(String) ]))
                },
            ]
        });

        expect(klass.getMethod('foo').returnType.isGeneric()).to.be.true;
        expect(klass.getMethod('foo').returnType.as('generic').baseType.isBuiltinClass(Promise)).to.be.true;
        expect(klass.getMethod('foo').returnType.as('generic').typeParameters.length).to.equal(1);
        expect(klass.getMethod('foo').returnType.as('generic').typeParameters[0].isBuiltinClass(String)).to.be.true;
    });
    it('reflects static return type', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_METHOD}${format.F_STATIC}`,
                    n: 'foo',
                    t: functionType([], builtinClass(String))
                },
            ]
        });

        expect(klass.getStaticMethod('foo').returnType.isBuiltinClass(String)).to.be.true;
    });
    it('reflects variadic', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_METHOD}}`,
                    n: 'foo',
                    t: functionType([
                        { n: 'a', t: builtinClass(String) }
                    ], genericType(builtinClass(Promise), [ builtinClass(String) ]))
                },
                {
                    f: `${format.F_METHOD}}`,
                    n: 'bar',
                    t: functionType([
                        { n: 'a', t: builtinClass(String) },
                        { n: 'b', t: builtinClass(Boolean), f: `${format.F_REST}` }
                    ], genericType(builtinClass(Promise), [ builtinClass(String) ]))
                },
            ]
        });

        expect(klass.getMethod('foo').isVariadic).to.be.false;
        expect(klass.getMethod('bar').isVariadic).to.be.true;
    });
    it('reflects parameters', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_METHOD}`,
                    n: 'foo',
                    t: functionType([
                        { n: 'a', t: builtinClass(String) },
                        { n: 'b', t: builtinClass(Boolean) }
                    ], genericType(builtinClass(Promise), [ builtinClass(String) ]))
                },
                {
                    f: `${format.F_METHOD}${format.F_STATIC}`,
                    n: 'bar',
                    t: functionType([
                        { n: 'a', t: builtinClass(String) },
                        { n: 'b', t: builtinClass(Boolean), f: `${format.F_REST}` }
                    ], genericType(builtinClass(Promise), [ builtinClass(String) ]))
                },
            ]
        });

        expect(klass.getMethod('foo').parameters[0].name).to.equal('a');
        expect(klass.getMethod('foo').getParameter('a').name).to.equal('a');
        expect(klass.getMethod('foo').parameters[0].type.isBuiltinClass(String)).to.be.true;
        expect(klass.getMethod('foo').getParameter('a').type.isBuiltinClass(String)).to.be.true;
        expect(klass.getMethod('foo').parameters[1].name).to.equal('b');
        expect(klass.getMethod('foo').getParameter('b').name).to.equal('b');
        expect(klass.getMethod('foo').parameters[1].type.isBuiltinClass(Boolean)).to.be.true;
        expect(klass.getMethod('foo').getParameter('b').type.isBuiltinClass(Boolean)).to.be.true;
    });
    it('reflects parameter optionality', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_METHOD}`,
                    n: 'foo',
                    t: functionType([
                        { n: 'a', t: builtinClass(String) },
                        { n: 'b', t: builtinClass(Boolean), f: format.F_OPTIONAL }
                    ], genericType(builtinClass(Promise), [ builtinClass(String) ]))
                }
            ]
        });

        expect(klass.getMethod('foo').parameters[0].name).to.equal('a');
        expect(klass.getMethod('foo').getParameter('a').name).to.equal('a');
        expect(klass.getMethod('foo').parameters[0].type.isBuiltinClass(String)).to.be.true;
        expect(klass.getMethod('foo').getParameter('a').type.isBuiltinClass(String)).to.be.true;
        expect(klass.getMethod('foo').getParameter('a').flags.isOptional).to.be.false;
        expect(klass.getMethod('foo').parameters[0].flags.isOptional).to.be.false;
        expect(klass.getMethod('foo').parameters[0].isOptional).to.be.false;
        expect(klass.getMethod('foo').getParameter('a').isOptional).to.be.false;
        expect(klass.getMethod('foo').parameters[1].name).to.equal('b');
        expect(klass.getMethod('foo').getParameter('b').name).to.equal('b');
        expect(klass.getMethod('foo').parameters[1].type.isBuiltinClass(Boolean)).to.be.true;
        expect(klass.getMethod('foo').getParameter('b').type.isBuiltinClass(Boolean)).to.be.true;
        expect(klass.getMethod('foo').parameters[1].flags.isOptional).to.be.true;
        expect(klass.getMethod('foo').getParameter('b').flags.isOptional).to.be.true;
        expect(klass.getMethod('foo').parameters[1].isOptional).to.be.true;
        expect(klass.getMethod('foo').getParameter('b').isOptional).to.be.true;
    });
    it('reflects parameter rest', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_METHOD}`,
                    n: 'foo',
                    t: functionType([
                        { n: 'a', t: builtinClass(String) },
                        { n: 'b', t: builtinClass(Boolean), f: format.F_REST }
                    ], genericType(builtinClass(Promise), [ builtinClass(String) ]))
                }
            ]
        });

        expect(klass.getMethod('foo').parameters[0].name).to.equal('a');
        expect(klass.getMethod('foo').getParameter('a').name).to.equal('a');
        expect(klass.getMethod('foo').parameters[0].type.isBuiltinClass(String)).to.be.true;
        expect(klass.getMethod('foo').getParameter('a').type.isBuiltinClass(String)).to.be.true;
        expect(klass.getMethod('foo').getParameter('a').flags.isRest).to.be.false;
        expect(klass.getMethod('foo').parameters[0].flags.isRest).to.be.false;
        expect(klass.getMethod('foo').parameters[0].isRest).to.be.false;
        expect(klass.getMethod('foo').getParameter('a').isRest).to.be.false;
        expect(klass.getMethod('foo').parameters[1].name).to.equal('b');
        expect(klass.getMethod('foo').getParameter('b').name).to.equal('b');
        expect(klass.getMethod('foo').parameters[1].type.isBuiltinClass(Boolean)).to.be.true;
        expect(klass.getMethod('foo').getParameter('b').type.isBuiltinClass(Boolean)).to.be.true;
        expect(klass.getMethod('foo').parameters[1].flags.isRest).to.be.true;
        expect(klass.getMethod('foo').getParameter('b').flags.isRest).to.be.true;
        expect(klass.getMethod('foo').parameters[1].isRest).to.be.true;
        expect(klass.getMethod('foo').getParameter('b').isRest).to.be.true;
    });
});

/**
 * @rtti:skip
 */
describe('Property', () => {
    it('reflects public', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_PROPERTY}`,
                    n: 'foo',
                    t: builtinClass(String)
                },
                {
                    f: `${format.F_PROPERTY}${format.F_PUBLIC}`,
                    n: 'bar',
                    t: builtinClass(String)
                }
            ]
        });

        expect(klass.getProperty('foo').visibility).to.equal('public');
        expect(klass.getProperty('foo').isMarkedPublic).to.equal(false);
        expect(klass.getProperty('bar').visibility).to.equal('public');
        expect(klass.getProperty('bar').isMarkedPublic).to.equal(true);
    });
    it('reflects protected', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_PROPERTY}`,
                    n: 'foo',
                    t: builtinClass(String)
                },
                {
                    f: `${format.F_PROPERTY}${format.F_PROTECTED}`,
                    n: 'bar',
                    t: builtinClass(String)
                }
            ]
        });

        expect(klass.getProperty('foo').visibility).to.equal('public');
        expect(klass.getProperty('bar').visibility).to.equal('protected');
    });
    it('reflects private', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_PROPERTY}`,
                    n: 'foo',
                    t: builtinClass(String)
                },
                {
                    f: `${format.F_PROPERTY}${format.F_PRIVATE}`,
                    n: 'bar',
                    t: builtinClass(String)
                }
            ]
        });

        expect(klass.getProperty('foo').visibility).to.equal('public');
        expect(klass.getProperty('bar').visibility).to.equal('private');
    });
    it('reflects readonly', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_PROPERTY}`,
                    n: 'foo',
                    t: builtinClass(String)
                },
                {
                    f: `${format.F_PROPERTY}${format.F_READONLY}`,
                    n: 'bar',
                    t: builtinClass(String)
                }
            ]
        });

        expect(klass.getProperty('foo').isReadonly).to.be.false;
        expect(klass.getProperty('bar').isReadonly).to.be.true;
    });
    it('reflects type', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_PROPERTY}`,
                    n: 'foo',
                    t: builtinClass(Number)
                },
                {
                    f: `${format.F_PROPERTY}`,
                    n: 'bar',
                    t: builtinClass(String)
                }
            ]
        });

        expect(klass.getProperty('foo').type.isBuiltinClass(Number)).to.be.true;
        expect(klass.getProperty('bar').type.isBuiltinClass(String)).to.be.true;
    });
    it('reflects null type as null', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_PROPERTY}`,
                    n: 'foo',
                    t: literal(null)
                }
            ]
        });

        expect(klass.getProperty('foo').type.kind === 'null').to.be.true;
        expect(klass.getProperty('foo').type.isBuiltinClass(Object)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(Number)).to.be.false;
        expect(klass.getProperty('foo').type.isNull()).to.be.true;
        expect(klass.getProperty('foo').type.isTrue()).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(123)).to.be.false;
    });
    it('reflects true type as true', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_PROPERTY}`,
                    n: 'foo',
                    t: literal(true)
                }
            ]
        });

        expect(klass.getProperty('foo').type.isBuiltinClass(Boolean)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(Number)).to.be.false;
        expect(klass.getProperty('foo').type.isTrue()).to.be.true;
        expect(klass.getProperty('foo').type.isFalse()).to.be.false;
        expect(klass.getProperty('foo').type.isNull()).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(123)).to.be.false;
    });
    it('reflects false type as false', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_PROPERTY}`,
                    n: 'foo',
                    t: literal(false)
                }
            ]
        });

        expect(klass.getProperty('foo').type.isBuiltinClass(Boolean)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(Number)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(false)).to.be.true;
        expect(klass.getProperty('foo').type.isLiteral(true)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(null)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(123)).to.be.false;
    });
    it('reflects 123 type as 123', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_PROPERTY}`,
                    n: 'foo',
                    t: literal(123)
                }
            ]
        });

        expect(klass.getProperty('foo').type.isBuiltinClass(Number)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(Boolean)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(123)).to.be.true;
        expect(klass.getProperty('foo').type.isLiteral(124)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(false)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(true)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(null)).to.be.false;
    });
    it('reflects 123n type as 123n', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_PROPERTY}`,
                    n: 'foo',
                    t: literal(BigInt(123))
                }
            ]
        });

        expect(klass.getProperty('foo').type.isBuiltinClass(BigInt)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(Number)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(Boolean)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(BigInt(123))).to.be.true;
        expect(klass.getProperty('foo').type.isLiteral(BigInt(124))).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(false)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(true)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(null)).to.be.false;
    });
    it('reflects string literal type as string literal', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_PROPERTY}`,
                    n: 'foo',
                    t: literal('foobaz')
                }
            ]
        });

        expect(klass.getProperty('foo').type.isBuiltinClass(String)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(Number)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(Boolean)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral('foobaz')).to.be.true;
        expect(klass.getProperty('foo').type.isLiteral('not-it')).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(123)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(false)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(true)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(null)).to.be.false;
    });
    it('reflects undefined literal type as undefined', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_PROPERTY}`,
                    n: 'foo',
                    t: literal(undefined)
                }
            ]
        });

        expect(klass.getProperty('foo').type.isBuiltinClass(Object)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(Function)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(String)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(Number)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(Boolean)).to.be.false;
        expect(klass.getProperty('foo').type.isUndefined()).to.be.true;
        expect(klass.getProperty('foo').type.isLiteral('undefined')).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(123)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(false)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(true)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(null)).to.be.false;
    });
    it('reflects void type', () => {
        let klass = reflectClassType({
            m: [
                {
                    f: `${format.F_PROPERTY}`,
                    n: 'foo',
                    t: voidType()
                }
            ]
        });

        expect(klass.getProperty('foo').type.kind).to.equal('void');
        expect(klass.getProperty('foo').type.isVoid()).to.be.true;
        expect(klass.getProperty('foo').type.isBuiltinClass(Function)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(String)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(Number)).to.be.false;
        expect(klass.getProperty('foo').type.isBuiltinClass(Boolean)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(undefined)).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral('undefined')).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(123)).to.be.false;
        expect(klass.getProperty('foo').type.isFalse()).to.be.false;
        expect(klass.getProperty('foo').type.isTrue()).to.be.false;
        expect(klass.getProperty('foo').type.isLiteral(null)).to.be.false;
    });
    it('reflects static type', () => {
        let klass = reflectClassType({
            m: [
                { f: `${format.F_PROPERTY}${format.F_STATIC}`, n: 'foo', t: builtinClass(Number) },
                { f: `${format.F_PROPERTY}${format.F_STATIC}`, n: 'bar', t: builtinClass(String) },
            ]
        });

        expect(klass.staticProperties.length).to.equal(2);
        expect(klass.getStaticProperty('foo').type.isBuiltinClass(Number)).to.be.true;
        expect(klass.getStaticProperty('bar').type.isBuiltinClass(String)).to.be.true;
    });
    it('reflects parameter details', () => {
        let klass = reflectClassType({
            m: [
                { f: `${format.F_METHOD}`, n: 'helloWorld', t: functionType([
                    { n: 'message', t: builtinClass(String) },
                    { n: 'size', t: builtinClass(Number) }
                ], builtinClass(Boolean)) },
                { f: `${format.F_PROPERTY}${format.F_STATIC}`, n: 'bar', t: builtinClass(String) },
            ]
        });

        let helloWorld = klass.getMethod('helloWorld');
        expect(helloWorld.parameters.length).to.equal(2);
        expect(helloWorld.parameters[0].type.isBuiltinClass(String)).to.be.true;
        expect(helloWorld.parameters[0].type.isBuiltinClass(Number)).to.be.false;
        expect(helloWorld.parameters[1].type.isBuiltinClass(Number)).to.be.true;
        expect(helloWorld.parameters[1].type.isBuiltinClass(String)).to.be.false;
    });
});

/**
 * @rtti:skip
 */
describe('Compatibility', () => {
    it('will not inadvertently invoke getters when reflecting a property as a method, even when unannotated', () => {
        let invoked = 0;

        class Foo {
            get bar(): number {
                invoked += 1;
                return 123;
            }
        }

        const reflected = reflect(Foo)

        expect(reflected.getOwnMethod('bar')).not.to.exist;
        expect(reflected.getOwnProperty('bar')).to.exist;
        expect(invoked).to.equal(0);
    });
    it('will not invoke getters when reflecting on properties, even when unannotated', () => {
        let invoked = 0;

        class Foo {
            get bar() {
                invoked += 1;
                return () => 123;
            }
        }

        const reflected = reflect(Foo)

        expect(reflected.ownMethods.length).to.equal(0);
        expect(reflected.ownProperties.length).to.equal(1);
        expect(reflected.getOwnMethod('bar')).not.to.exist;
        expect(reflected.getOwnProperty('bar')).to.exist;
        expect(invoked).to.equal(0);
    });
    it('reflects static method names without metadata', () => {
        class B {
            static foo() { }
            static bar(arg1: number, arg2: number) { }
        }

        expect(reflect(B).staticMethods.length).to.equal(2);
        expect(reflect(B).getStaticMethod('foo')).to.exist;
        expect(reflect(B).getStaticMethod('foo').parameters.length).to.equal(0);
        expect(reflect(B).getStaticMethod('bar')).to.exist;
        expect(reflect(B).getStaticMethod('bar').parameters.length).to.equal(2);
    });
    it('reflects static property names, even without annotation', () => {
        class B {
            static foo = 123;
            static bar = 'val';
        }

        expect(reflect(B).ownStaticProperties.length).to.equal(2);
        expect(reflect(B).getOwnStaticProperty('foo')).to.exist;
        expect(reflect(B).getOwnStaticProperty('bar')).to.exist;
    });
    it('reflects static type with design:type', () => {
        class B {
            static foo = 123;
            static bar = 'hello'
        }
        Reflect.defineMetadata('design:type', Number, B, 'foo');
        Reflect.defineMetadata('design:type', String, B, 'bar');
        expect(reflect(B).getStaticProperty('foo').type.isBuiltinClass(Number)).to.be.true;
        expect(reflect(B).getStaticProperty('bar').type.isBuiltinClass(String)).to.be.true;
    });
    it('can reflect constructor parameters from design:paramtypes', () => {
        class A {
            constructor(a, b, c) { }
        };

        Reflect.defineMetadata('design:paramtypes', [String, Number, String], A);
        let refClass = reflect(A);
        let ctor = refClass.constructors[0];

        expect(ctor.parameters.length).to.equal(3);

        let [a, b, c] = ctor.parameters;

        expect(a.name).to.equal('a');
        expect(a.type.isBuiltinClass(String)).to.be.true;
        expect(a.type.isBuiltinClass(Number)).to.be.false;

        expect(b.name).to.equal('b');
        expect(b.type.isBuiltinClass(Number)).to.be.true;
        expect(b.type.isBuiltinClass(String)).to.be.false;

        expect(c.name).to.equal('c');
        expect(c.type.isBuiltinClass(String)).to.be.true;
    });
    it('reflects method names without metadata', () => {
        class B {
            foo() { }
            bar() { }
        }

        let klass = reflect(B);
        expect(klass.ownMethods.length).to.equal(2);
        expect(klass.ownMethods[0].name).to.equal('foo');
        expect(klass.ownMethods[1].name).to.equal('bar');
    });
    it('reflects method return types using design:returntype', () => {
        class B {
            foo() { }
        };

        Reflect.defineMetadata('design:returntype', String, B.prototype, 'foo');
        let refClass = reflect(B);
        expect(refClass.ownMethods.find(x => x.name === 'foo').returnType.isBuiltinClass(String)).to.be.true;
    });
    it('reflects static method return type using design:returntype', () => {
        class B {
            static foo() { }
            static bar() { }
        }

        Reflect.defineMetadata('design:returntype', RegExp, B, 'foo');
        expect(reflect(B).getStaticMethod('foo').returnType.isBuiltinClass(RegExp)).to.be.true;
    });
    it('reflects type with design:type', () => {
        class B {
            foo = 123;
            bar = 'hello';
        }
        Reflect.defineMetadata('design:type', Number, B.prototype, 'foo');
        Reflect.defineMetadata('design:type', String, B.prototype, 'bar');
        expect(reflect(B).getProperty('foo').type.isBuiltinClass(Number)).to.be.true;
        expect(reflect(B).getProperty('bar').type.isBuiltinClass(String)).to.be.true;
    });
})

/**
 * @rtti:skip
 */
describe('FunctionType', () => {
    it('reflects name', () => {
        let type = reflectFunctionType({
            f: format.F_FUNCTION,
            n: 'foobar',
            p: [],
            r: builtinClass(Number)
        });
        expect(type.name).to.equal('foobar');
    });
    it('reflects return type', () => {
        let type = reflectFunctionType({
            f: format.F_FUNCTION,
            p: [],
            r: builtinClass(Number)
        });
        expect(type.returnType.isBuiltinClass(Number)).to.be.true;
    });
    it('reflects async flag', () => {
        let A = reflectFunctionType({
            f: `${format.F_FUNCTION}`,
            p: [],
            r: builtinClass(Number)
        });
        let B = reflectFunctionType({
            f: `${format.F_FUNCTION}${format.F_ASYNC}`,
            p: [],
            r: builtinClass(Number)
        });

        expect(A.isAsync).to.be.false;
        expect(B.isAsync).to.be.true;
    });
    it('reflects function variadic', () => {
        let A = reflectFunctionType({
            f: `${format.F_FUNCTION}`,
            p: [{ n: 'a', t: builtinClass(String) }],
            r: builtinClass(Number)
        });
        let B = reflectFunctionType({
            f: `${format.F_FUNCTION}${format.F_ASYNC}`,
            p: [{ n: 'a', t: builtinClass(String) }, { n: 'b', t: builtinClass(Boolean), f: `${format.F_REST}` }],
            r: builtinClass(Number)
        });
        expect(A.isVariadic).to.be.false;
        expect(B.isVariadic).to.be.true;
    });
});

/**
 * @rtti:skip
 */
describe('reflect(value)', () => {
    it('returns a ClassType when passing in a class', () => {
        class A { }
        expect(reflect(A)).to.be.an.instanceOf(ClassType);
    });
    it('returns a ClassType even if callSite is passed when passing a class', () => {
        class A { }
        expect((reflect as any)(A, { TΦ: 'c', p: [], tp: [] })).to.be.an.instanceOf(ClassType);
    });
    it('returns a ClassType when passing in an instance', () => {
        class A { }

        let a = new A();
        let reflClass = <ClassType>reflect(a);
        expect(reflClass).to.be.an.instanceOf(ClassType);
        expect(reflClass.name).to.equal('A');
    });
    it('returns a ClassType when passing in a bare function', () => {
        function a() { }

        expect(reflect(a)).to.be.an.instanceOf(ClassType);
    });
    it('returns a FunctionType when passing in a marked function', () => {
        function a() { }

        Reflect.defineMetadata('rtti:type', () => ({
            TΦ: format.T_FUNCTION, f: `${format.F_FUNCTION}`, t: functionType([], voidType())
        }), a);
        expect(reflect(a), `Should be FunctionType, not ${reflect(a).constructor.name}`).to.be.an.instanceOf(FunctionType);
    });
    it('returns a FunctionType when passing in an arrow function', () => {
        let a = () => { };
        expect(reflect(a)).to.be.an.instanceOf(FunctionType);
    });
});