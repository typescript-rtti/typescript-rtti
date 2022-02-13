import { describe } from "razmin";
import { expect } from "chai";
import { ReflectedClass } from "./reflect";
import { InterfaceToken } from "../common";
import * as flags from '../common/flags';
import { reflect, ReflectedFunction, ReflectedMethod } from "./reflect";

describe('ReflectedClass', it => {
    describe('ownMethodNames', it => {
        it('includes only the own methods', () => {
            class A {
                foo() { }
            }

            class B extends A {
                bar() { }
            }

            Reflect.defineMetadata('rt:m', ['foo'], A);
            Reflect.defineMetadata('rt:m', ['bar'], B);

            expect(ReflectedClass.new(A).ownPropertyNames).to.eql(['foo']);
            expect(ReflectedClass.new(B).ownPropertyNames).to.eql(['bar']);
        });
    });
    describe('ownPropertyNames', it => {
        it('includes only the own properties', () => {

            class A {
                foo : string;
            }

            class B extends A {
                bar : string;
            }

            Reflect.defineMetadata('rt:P', ['foo'], A);
            Reflect.defineMetadata('rt:P', ['bar'], B);

            expect(ReflectedClass.new(A).ownPropertyNames).to.eql(['foo']);
            expect(ReflectedClass.new(B).ownPropertyNames).to.eql(['bar']);
        })
        it('works on interfaces', () => {

            interface A {
                foo : string;
            }
            const IΦA = { name: 'A', prototype: {}, identity: Symbol('A') };
            Reflect.defineMetadata('rt:P', ['foo'], IΦA);

            interface B extends A {
                bar : string;
            }
            const IΦB = { name: 'B', prototype: {}, identity: Symbol('B') };
            Reflect.defineMetadata('rt:P', ['bar'], IΦB);

            Reflect.defineMetadata('rt:P', ['foo'], IΦA);
            Reflect.defineMetadata('rt:P', ['bar'], IΦB);

            expect(ReflectedClass.new(IΦA).ownPropertyNames).to.eql(['foo']);
            expect(ReflectedClass.new(IΦB).ownPropertyNames).to.eql(['bar']);
        })
    });
    it('can reflect constructor parameters', () => {
        class A {}
        Reflect.defineMetadata('rt:p', [{n: 'a', t: () => Number}, {n: 'b', t: () => String}], A);
        let refClass = ReflectedClass.new(A);

        expect(refClass.parameters.length).to.equal(2);

        let [a, b] = refClass.parameters;
        expect(a.type.isClass(Number)).to.be.true
        expect(a.name).to.equal('a');
        expect(b.type.isClass(String)).to.be.true;
        expect(b.name).to.equal('b');
    });
    it('can reflect constructor parameters from design:paramtypes', () => {
        class A {
            constructor(a, b, c) { }
        }
        Reflect.defineMetadata('design:paramtypes', [String, Number, String], A);
        let refClass = ReflectedClass.new(A);

        expect(refClass.parameters.length).to.equal(3);

        let [a, b, c] = refClass.parameters;
        
        expect(a.name).to.equal('a');
        expect(a.type.isClass(String)).to.be.true;
        expect(a.type.isClass(Number)).to.be.false;

        expect(b.name).to.equal('b');
        expect(b.type.isClass(Number)).to.be.true;
        expect(b.type.isClass(String)).to.be.false;

        expect(c.name).to.equal('c');
        expect(c.type.isClass(String)).to.be.true;
    });
    it('can reflect abstract', () => {
        class A {}
        let refClass = ReflectedClass.new(A);
        expect(refClass.flags.isAbstract).to.be.false;

        Reflect.defineMetadata('rt:f', `C${flags.F_ABSTRACT}`, A);
        refClass = ReflectedClass.new(A);
        expect(refClass.flags.isAbstract).to.be.true;
    });
    it('can reflect upon inherited methods', () => {
        class A {}
        class B extends A {}
        Reflect.defineMetadata('rt:t', () => Number, A.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => String, A.prototype, 'bar');
        Reflect.defineMetadata('rt:m', ['foo', 'bar'], A);

        let refClass = ReflectedClass.new(B);
        expect(refClass.getMethod('foo').returnType.isClass(Number)).to.be.true;
    });
    it('can reflect upon inherited properties', () => {
        class A {}
        class B extends A {}
        Reflect.defineMetadata('rt:t', () => Number, A.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => String, A.prototype, 'bar');
        Reflect.defineMetadata('rt:P', ['foo', 'bar'], A);

        let refClass = ReflectedClass.new(B);
        expect(refClass.getProperty('foo').type.isClass(Number)).to.be.true;
    });
    it('reflects reified interfaces', () => {
        let IΦFoo : InterfaceToken = { name: 'Foo', prototype: {}, identity: Symbol('Foo (interface)') };

        Reflect.defineMetadata('rt:P', ['foobar', 'foobaz'], IΦFoo);
        Reflect.defineMetadata('rt:m', ['helloWorld'], IΦFoo);
        Reflect.defineMetadata('rt:t', () => Number, IΦFoo.prototype, 'foobar');
        Reflect.defineMetadata('rt:t', () => String, IΦFoo.prototype, 'foobaz');
        Reflect.defineMetadata('rt:t', () => Boolean, IΦFoo.prototype, 'helloWorld');
        Reflect.defineMetadata('rt:p', [{ n: 'message', t: () => String }, { n: 'size', t: () => Number }], IΦFoo.prototype, 'helloWorld');

        let foobar = ReflectedClass.new(IΦFoo).getProperty('foobar');
        let foobaz = ReflectedClass.new(IΦFoo).getProperty('foobaz');
        let helloWorld = ReflectedClass.new(IΦFoo).getMethod('helloWorld');

        expect(foobar.type.kind).to.equal('class');
        expect(foobar.type.isClass(Number)).to.be.true;
        expect(foobar.type.isClass(String)).to.be.false;
        
        expect(foobaz.type.kind).to.equal('class');
        expect(foobaz.type.isClass(String)).to.be.true;
        expect(foobaz.type.isClass(Number)).to.be.false;
        
        expect(helloWorld.returnType.kind).to.equal('class');
        expect(helloWorld.returnType.isClass(Boolean)).to.be.true;
        expect(helloWorld.returnType.isClass(Number)).to.be.false;
        expect(helloWorld.parameterNames).to.eql(['message', 'size']);
        expect(helloWorld.parameterTypes.map(pt => pt.as('class').class)).to.eql([String, Number]);
    });
    it('reflects implemented interfaces', () => {

        class A {}

        const IΦSomething = {
            name: 'Something',
            prototype: {},
            identity: Symbol('Something (interface)')
        }

        const IΦSomethingElse = {
            name: 'SomethingElse',
            prototype: {},
            identity: Symbol('SomethingElse (interface)')
        }

        Reflect.defineMetadata('rt:i', [ () => IΦSomething, () => IΦSomethingElse ], A);

        let klass = ReflectedClass.new(A);

        expect(klass.interfaces.length).to.equal(2);
        expect(klass.interfaces[0].isInterface(IΦSomething)).to.be.true;
        expect(klass.interfaces[0].isInterface(IΦSomethingElse)).to.be.false;
        expect(klass.interfaces[1].isInterface(IΦSomething)).to.be.false;
        expect(klass.interfaces[1].isInterface(IΦSomethingElse)).to.be.true;
    });
});

describe('ReflectedMethod', it => {
    it('reflects method names without metadata', () => {
        class B {
            foo() { }
            bar() { }
        }

        let refClass = ReflectedClass.new(B);
        expect(refClass.ownMethodNames).to.eql(['foo', 'bar']);
        expect(refClass.ownMethods[0].name).to.equal('foo');
        expect(refClass.ownMethods[1].name).to.equal('bar');
    })
    it('reflects method return types using design:returntype', () => {
        class B {
            foo() { }
        }

        Reflect.defineMetadata('design:returntype', String, B.prototype, 'foo');
        let refClass = ReflectedClass.new(B);
        expect(refClass.ownMethods.find(x => x.name === 'foo').returnType.isClass(String)).to.be.true;
    })
    it('reflects public', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], B);
        expect(ReflectedClass.new(B).getMethod('foo').visibility).to.equal('public');
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_PUBLIC}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], A);
        expect(ReflectedClass.new(A).getMethod('foo').visibility).to.equal('public');
    })
    it('reflects protected', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], B);
        expect(ReflectedClass.new(B).getMethod('foo').visibility).to.equal('public');
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_PROTECTED}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], A);
        expect(ReflectedClass.new(A).getMethod('foo').visibility).to.equal('protected');
    })
    it('reflects private', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], B);
        expect(ReflectedClass.new(B).getMethod('foo').visibility).to.equal('public');
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_PRIVATE}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], A);
        expect(ReflectedClass.new(A).getMethod('foo').visibility).to.equal('private');
    })
    it('reflects async', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], B);
        expect(ReflectedClass.new(B).getMethod('foo').isAsync).to.be.false
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_ASYNC}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], A);
        expect(ReflectedClass.new(A).getMethod('foo').isAsync).to.be.true
    })
    it('reflects return type', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => Number, B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo', 'bar'], B);
        expect(ReflectedClass.new(B).getMethod('foo').returnType.isClass(Number)).to.be.true;
        expect(ReflectedClass.new(B).getMethod('bar').returnType.isUnknown()).to.be.true;
    })
    it('reflects generic return type', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => ({ TΦ: flags.T_GENERIC, t: Promise, p: [ String ]}), B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo', 'bar'], B);
        expect(ReflectedClass.new(B).getMethod('foo').returnType.isClass(Promise)).to.be.false;
        expect(ReflectedClass.new(B).getMethod('foo').returnType.isGeneric(Promise)).to.be.true;
        expect(ReflectedClass.new(B).getMethod('foo').returnType.isPromise(String)).to.be.true;
    })
    it('reflects static method return type', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B, 'foo');
        Reflect.defineMetadata('rt:t', () => Number, B, 'foo');
        Reflect.defineMetadata('rt:Sm', ['foo', 'bar'], B);
        expect(ReflectedClass.new(B).getStaticMethod('foo').returnType.isClass(Number)).to.be.true;
        expect(ReflectedClass.new(B).getStaticMethod('bar').returnType.isUnknown()).to.be.true;
    })
    it('reflects function return type', () => {
        function B() { }
        Reflect.defineMetadata('rt:f', `${flags.F_FUNCTION}`, B);
        Reflect.defineMetadata('rt:t', () => Number, B);
        expect(ReflectedFunction.new(B).returnType.isClass(Number)).to.be.true;
    })
    it('reflects function async flag', () => {
        function A() { }
        Reflect.defineMetadata('rt:f', `${flags.F_FUNCTION}`, A);
        function B() { }
        Reflect.defineMetadata('rt:f', `${flags.F_FUNCTION}${flags.F_ASYNC}`, B);
        expect(ReflectedFunction.new(A).isAsync).to.be.false;
        expect(ReflectedFunction.new(B).isAsync).to.be.true;
    })
    it('reflects static method names without metadata', () => {
        class B {
            static foo() { } 
            static bar() { }
        }

        expect(ReflectedClass.new(B).staticMethodNames).to.eql(['foo', 'bar'])
    })
    it('reflects static method return type using design:returntype', () => {
        class B {
            static foo() { } 
            static bar() { }
        }

        Reflect.defineMetadata('design:returntype', RegExp, B, 'foo');
        expect(ReflectedClass.new(B).getStaticMethod('foo').returnType.isClass(RegExp)).to.be.true;
    })
    it('reflects parameters', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:p', [{n:'a', t: () => String}, {n:'b', t: () => Boolean}], B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo', 'bar'], B);
        expect(ReflectedClass.new(B).getMethod('foo').parameters[0].name).to.equal('a');
        expect(ReflectedClass.new(B).getMethod('foo').getParameter('a').name).to.equal('a');
        expect(ReflectedClass.new(B).getMethod('foo').parameters[0].type.isClass(String)).to.be.true;
        expect(ReflectedClass.new(B).getMethod('foo').getParameter('a').type.isClass(String)).to.be.true;

        expect(ReflectedClass.new(B).getMethod('foo').parameters[1].name).to.equal('b');
        expect(ReflectedClass.new(B).getMethod('foo').getParameter('b').name).to.equal('b');
        expect(ReflectedClass.new(B).getMethod('foo').parameters[1].type.isClass(Boolean)).to.be.true;
        expect(ReflectedClass.new(B).getMethod('foo').getParameter('b').type.isClass(Boolean)).to.be.true;
    })
    it('reflects parameter optionality', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:p', [{n:'a', t: () => String}, {n:'b', t: () => Boolean, f: `${flags.F_OPTIONAL}`}], B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo', 'bar'], B);

        expect(ReflectedClass.new(B).getMethod('foo').parameters[0].name).to.equal('a');
        expect(ReflectedClass.new(B).getMethod('foo').getParameter('a').name).to.equal('a');
        expect(ReflectedClass.new(B).getMethod('foo').parameters[0].type.isClass(String)).to.be.true;
        expect(ReflectedClass.new(B).getMethod('foo').getParameter('a').type.isClass(String)).to.be.true;
        expect(ReflectedClass.new(B).getMethod('foo').getParameter('a').flags.isOptional).to.be.false;
        expect(ReflectedClass.new(B).getMethod('foo').parameters[0].flags.isOptional).to.be.false;
        expect(ReflectedClass.new(B).getMethod('foo').parameters[0].isOptional).to.be.false;
        expect(ReflectedClass.new(B).getMethod('foo').getParameter('a').isOptional).to.be.false;
        
        expect(ReflectedClass.new(B).getMethod('foo').parameters[1].name).to.equal('b');
        expect(ReflectedClass.new(B).getMethod('foo').getParameter('b').name).to.equal('b');
        expect(ReflectedClass.new(B).getMethod('foo').parameters[1].type.isClass(Boolean)).to.be.true;
        expect(ReflectedClass.new(B).getMethod('foo').getParameter('b').type.isClass(Boolean)).to.be.true;
        expect(ReflectedClass.new(B).getMethod('foo').parameters[1].flags.isOptional).to.be.true;
        expect(ReflectedClass.new(B).getMethod('foo').getParameter('b').flags.isOptional).to.be.true;
        expect(ReflectedClass.new(B).getMethod('foo').parameters[1].isOptional).to.be.true;
        expect(ReflectedClass.new(B).getMethod('foo').getParameter('b').isOptional).to.be.true;
    })
});

describe('ReflectedProperty', it => {
    it('reflects public', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);
        expect(ReflectedClass.new(B).getProperty('foo').visibility).to.equal('public');
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_PUBLIC}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], A);
        expect(ReflectedClass.new(A).getProperty('foo').visibility).to.equal('public');
    })
    it('reflects protected', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);
        expect(ReflectedClass.new(B).getProperty('foo').visibility).to.equal('public');
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_PROTECTED}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], A);
        expect(ReflectedClass.new(A).getProperty('foo').visibility).to.equal('protected');
    })
    it('reflects private', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);
        expect(ReflectedClass.new(B).getProperty('foo').visibility).to.equal('public');
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_PRIVATE}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], A);
        expect(ReflectedClass.new(A).getProperty('foo').visibility).to.equal('private');
    })
    it('reflects readonly', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);
        expect(ReflectedClass.new(B).getProperty('foo').isReadonly).to.be.false
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_READONLY}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], A);
        expect(ReflectedClass.new(A).getProperty('foo').isReadonly).to.be.true
    })
    it('reflects type', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => Number, B.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => String, B.prototype, 'bar');
        Reflect.defineMetadata('rt:P', ['foo', 'bar'], B);
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Number)).to.be.true;
        expect(ReflectedClass.new(B).getProperty('bar').type.isClass(String)).to.be.true;
    })
    it('reflects null type as class Object and as null', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => null, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);

        let prop = ReflectedClass.new(B).getProperty('foo');

        expect(prop.type.kind === 'literal').to.be.true;

        expect(prop.type.isClass(Object)).to.be.true;
        expect(prop.type.isClass(Number)).to.be.false;
        expect(prop.type.isLiteral(null)).to.be.true;
        expect(prop.type.isLiteral(true)).to.be.false;
        expect(prop.type.isLiteral(123)).to.be.false;
    })
    it('reflects true type as class Boolean and as true', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => true, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);

        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Boolean)).to.be.true;
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Number)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(true)).to.be.true;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(false)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(null)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(123)).to.be.false;
    })
    it('reflects false type as class Boolean and as false', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => false, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);

        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Boolean)).to.be.true;
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Number)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(false)).to.be.true;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(true)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(null)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(123)).to.be.false;
    })
    it('reflects 123 type as class Number and as 123', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => 123, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);

        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Number)).to.be.true;
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Boolean)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(123)).to.be.true;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(124)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(false)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(true)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(null)).to.be.false;
    })
    it('reflects string literal type as class String and as the literal', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => 'foobaz', B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);

        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(String)).to.be.true;
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Number)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Boolean)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral('foobaz')).to.be.true;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral('not-it')).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(123)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(false)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(true)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(null)).to.be.false;
    })
    it('reflects undefined literal type as undefined', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => undefined, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);

        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Object)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Function)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(String)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Number)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Boolean)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(undefined)).to.be.true;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral('undefined')).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(123)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(false)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(true)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(null)).to.be.false;
    })
    it('reflects void type', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => ({ TΦ: 'V' }), B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);

        expect(ReflectedClass.new(B).getProperty('foo').type.kind).to.equal('void');
        expect(ReflectedClass.new(B).getProperty('foo').type.isVoid()).to.be.true;
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Function)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(String)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Number)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Boolean)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(undefined)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral('undefined')).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(123)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(false)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(true)).to.be.false;
        expect(ReflectedClass.new(B).getProperty('foo').type.isLiteral(null)).to.be.false;
    })
    it('reflects static type', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => Number, B, 'foo');
        Reflect.defineMetadata('rt:t', () => String, B, 'bar');
        Reflect.defineMetadata('rt:SP', ['foo', 'bar', 'baz'], B);
        expect(ReflectedClass.new(B).staticPropertyNames).to.eql(['foo', 'bar', 'baz']);
        expect(ReflectedClass.new(B).getStaticProperty('foo').type.isClass(Number)).to.be.true;
        expect(ReflectedClass.new(B).getStaticProperty('bar').type.isClass(String)).to.be.true;
    })
    it('reflects type with design:type', () => {
        class B {}
        Reflect.defineMetadata('design:type', Number, B.prototype, 'foo');
        Reflect.defineMetadata('design:type', String, B.prototype, 'bar');
        expect(ReflectedClass.new(B).getProperty('foo').type.isClass(Number)).to.be.true;
        expect(ReflectedClass.new(B).getProperty('bar').type.isClass(String)).to.be.true;
    })
    it('reflects parameter details', () => {
        class B {
        }
        Reflect.defineMetadata('rt:m', ['helloWorld'], B);
        Reflect.defineMetadata('rt:t', () => Boolean, B.prototype, 'helloWorld');
        Reflect.defineMetadata('rt:p', [{ n: 'message', t: () => String }, { n: 'size', t: () => Number }], B.prototype, 'helloWorld');
        
        let helloWorld = ReflectedClass.new(B).getMethod('helloWorld');
        expect(helloWorld.parameterNames).to.eql(['message', 'size']);
        expect(helloWorld.parameterTypes[0].isClass(String)).to.be.true;
        expect(helloWorld.parameterTypes[0].isClass(Number)).to.be.false;
        expect(helloWorld.parameterTypes[1].isClass(Number)).to.be.true;
        expect(helloWorld.parameterTypes[1].isClass(String)).to.be.false;

        expect(helloWorld.parameterTypes.map(pt => pt.as('class').class)).to.eql([String, Number]);
    })
    it('reflects static property names with design:type', () => {
        class B {
            static foo = 123;
            static bar = 'val';
        }

        expect(ReflectedClass.new(B).ownStaticPropertyNames).to.eql(['foo', 'bar']);
    })
    it('reflects static type with design:type', () => {
        class B {
            static foo = 123;
            static bar;
        }
        Reflect.defineMetadata('design:type', Number, B, 'foo');
        Reflect.defineMetadata('design:type', String, B, 'bar');
        expect(ReflectedClass.new(B).getStaticProperty('foo').type.isClass(Number)).to.be.true;
        expect(ReflectedClass.new(B).getStaticProperty('bar').type.isClass(String)).to.be.true;
    })
});

describe('reflect(value)', it => {
    it('returns a ReflectedClass when passing in a class', () => {
        class A { }
        expect(reflect(A)).to.be.an.instanceOf(ReflectedClass);
    });
    it('returns a ReflectedClass when passing in an instance', () => {
        class A { }
        let a = new A();
        let reflClass = reflect(a);
        expect(reflClass).to.be.an.instanceOf(ReflectedClass);
        expect(reflClass.class).to.equal(A);
    });
    it('returns a ReflectedClass when passing in a bare function', () => {
        function a() { }
        expect(reflect(a)).to.be.an.instanceOf(ReflectedClass);
    });
    it('returns a ReflectedFunction when passing in a marked function', () => {
        function a() { }
        Reflect.defineMetadata('rt:f', `${flags.F_FUNCTION}`, a);
        expect(reflect(a)).to.be.an.instanceOf(ReflectedFunction);
    });
    it('returns a ReflectedMethod when passing in a method', () => {
        class A { foo() { } }

        Reflect.defineMetadata('rt:m', ['foo'], A);
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, A, 'foo');
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, A.prototype.foo);
        Reflect.defineMetadata('rt:h', A, A.prototype.foo);

        expect(reflect(A.prototype.foo)).to.be.an.instanceOf(ReflectedMethod);
    });
    it('returns a ReflectedMethod when passing in a static method', () => {
        class A { static foo() { } }

        Reflect.defineMetadata('rt:m', ['foo'], A);
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, A, 'foo');
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_STATIC}`, A.foo);
        Reflect.defineMetadata('rt:h', A, A.foo);

        expect(reflect(A.foo)).to.be.an.instanceOf(ReflectedMethod);
    });
    it('returns a ReflectedFunction when passing in an arrow function', () => {
        let a = () => {};
        expect(reflect(a)).to.be.an.instanceOf(ReflectedFunction);
    });
});