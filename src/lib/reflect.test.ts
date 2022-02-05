import { describe } from "razmin";
import { expect } from "chai";
import { ReflectedClass } from "./reflect";
import * as flags from '../common/flags';

describe('ReflectedClass', it => {
    it('can reflect constructor parameters', () => {
        class A {}
        Reflect.defineMetadata('rt:p', [{n: 'a', t: () => Number}, {n: 'b', t: () => String}], A);
        let refClass = new ReflectedClass(A);

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
        let refClass = new ReflectedClass(A);

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
        let refClass = new ReflectedClass(A);
        expect(refClass.flags.isAbstract).to.be.false;

        Reflect.defineMetadata('rt:f', `C${flags.F_ABSTRACT}`, A);
        refClass = new ReflectedClass(A);
        expect(refClass.flags.isAbstract).to.be.true;
    });
    it('can reflect public', () => {
        class A {}
        let refClass = new ReflectedClass(A);
        expect(refClass.flags.isPublic).to.be.false;

        Reflect.defineMetadata('rt:f', `C${flags.F_PUBLIC}`, A);
        refClass = new ReflectedClass(A);
        expect(refClass.visibility).to.equal('public');
    });
    it('can reflect private', () => {
        class A {}
        let refClass = new ReflectedClass(A);
        expect(refClass.flags.isPrivate).to.be.false;

        Reflect.defineMetadata('rt:f', `C${flags.F_PRIVATE}`, A);
        refClass = new ReflectedClass(A);
        expect(refClass.visibility).to.equal('private');
    });
    it('can reflect protected', () => {
        class A {}
        let refClass = new ReflectedClass(A);
        expect(refClass.flags.isProtected).to.be.false;

        Reflect.defineMetadata('rt:f', `C${flags.F_PROTECTED}`, A);
        refClass = new ReflectedClass(A);
        expect(refClass.visibility).to.equal('protected');
    });
    it('can reflect upon inherited methods', () => {
        class A {}
        class B extends A {}
        Reflect.defineMetadata('rt:t', () => Number, A.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => String, A.prototype, 'bar');
        Reflect.defineMetadata('rt:m', ['foo', 'bar'], A);

        let refClass = new ReflectedClass(B);
        expect(refClass.getMethod('foo').returnType.isClass(Number)).to.be.true;
    });
    it('can reflect upon inherited properties', () => {
        class A {}
        class B extends A {}
        Reflect.defineMetadata('rt:t', () => Number, A.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => String, A.prototype, 'bar');
        Reflect.defineMetadata('rt:P', ['foo', 'bar'], A);

        let refClass = new ReflectedClass(B);
        expect(refClass.getProperty('foo').type.isClass(Number)).to.be.true;
    });
});

describe('ReflectedMethod', it => {
    it('reflects method names without metadata', () => {
        class B {
            foo() { }
            bar() { }
        }

        let refClass = new ReflectedClass(B);
        expect(refClass.ownMethodNames).to.eql(['foo', 'bar']);
        expect(refClass.ownMethods[0].name).to.equal('foo');
        expect(refClass.ownMethods[1].name).to.equal('bar');
    })
    it('reflects method return types using design:returntype', () => {
        class B {
            foo() { }
        }

        Reflect.defineMetadata('design:returntype', String, B.prototype, 'foo');
        let refClass = new ReflectedClass(B);
        expect(refClass.ownMethods.find(x => x.name === 'foo').returnType.isClass(String)).to.be.true;
    })
    it('reflects public', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], B);
        expect(new ReflectedClass(B).getMethod('foo').visibility).to.equal('public');
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_PUBLIC}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], A);
        expect(new ReflectedClass(A).getMethod('foo').visibility).to.equal('public');
    })
    it('reflects protected', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], B);
        expect(new ReflectedClass(B).getMethod('foo').visibility).to.equal('public');
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_PROTECTED}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], A);
        expect(new ReflectedClass(A).getMethod('foo').visibility).to.equal('protected');
    })
    it('reflects private', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], B);
        expect(new ReflectedClass(B).getMethod('foo').visibility).to.equal('public');
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_PRIVATE}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], A);
        expect(new ReflectedClass(A).getMethod('foo').visibility).to.equal('private');
    })
    it('reflects async', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], B);
        expect(new ReflectedClass(B).getMethod('foo').isAsync).to.be.false
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_ASYNC}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo'], A);
        expect(new ReflectedClass(A).getMethod('foo').isAsync).to.be.true
    })
    it('reflects return type', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => Number, B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo', 'bar'], B);
        expect(new ReflectedClass(B).getMethod('foo').returnType.isClass(Number)).to.be.true;
        expect(new ReflectedClass(B).getMethod('bar').returnType.isUnknown()).to.be.true;
    })
    it('reflects generic return type', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => ({ TΦ: flags.T_GENERIC, t: Promise, p: [ String ]}), B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo', 'bar'], B);
        expect(new ReflectedClass(B).getMethod('foo').returnType.isClass(Promise)).to.be.false;
        expect(new ReflectedClass(B).getMethod('foo').returnType.isGeneric(Promise)).to.be.true;
        expect(new ReflectedClass(B).getMethod('foo').returnType.isPromise(String)).to.be.true;
    })
    it('reflects static method return type', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B, 'foo');
        Reflect.defineMetadata('rt:t', () => Number, B, 'foo');
        Reflect.defineMetadata('rt:Sm', ['foo', 'bar'], B);
        expect(new ReflectedClass(B).getStaticMethod('foo').returnType.isClass(Number)).to.be.true;
        expect(new ReflectedClass(B).getStaticMethod('bar').returnType.isUnknown()).to.be.true;
    })
    it('reflects static method names without metadata', () => {
        class B {
            static foo() { } 
            static bar() { }
        }

        expect(new ReflectedClass(B).staticMethodNames).to.eql(['foo', 'bar'])
    })
    it('reflects static method return type using design:returntype', () => {
        class B {
            static foo() { } 
            static bar() { }
        }

        Reflect.defineMetadata('design:returntype', RegExp, B, 'foo');
        expect(new ReflectedClass(B).getStaticMethod('foo').returnType.isClass(RegExp)).to.be.true;
    })
    it('reflects parameters', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:p', [{n:'a', t: () => String}, {n:'b', t: () => Boolean}], B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo', 'bar'], B);
        expect(new ReflectedClass(B).getMethod('foo').parameters[0].name).to.equal('a');
        expect(new ReflectedClass(B).getMethod('foo').getParameter('a').name).to.equal('a');
        expect(new ReflectedClass(B).getMethod('foo').parameters[0].type.isClass(String)).to.be.true;
        expect(new ReflectedClass(B).getMethod('foo').getParameter('a').type.isClass(String)).to.be.true;

        expect(new ReflectedClass(B).getMethod('foo').parameters[1].name).to.equal('b');
        expect(new ReflectedClass(B).getMethod('foo').getParameter('b').name).to.equal('b');
        expect(new ReflectedClass(B).getMethod('foo').parameters[1].type.isClass(Boolean)).to.be.true;
        expect(new ReflectedClass(B).getMethod('foo').getParameter('b').type.isClass(Boolean)).to.be.true;
    })
    it('reflects parameter optionality', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:p', [{n:'a', t: () => String}, {n:'b', t: () => Boolean, f: `${flags.F_OPTIONAL}`}], B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo', 'bar'], B);

        expect(new ReflectedClass(B).getMethod('foo').parameters[0].name).to.equal('a');
        expect(new ReflectedClass(B).getMethod('foo').getParameter('a').name).to.equal('a');
        expect(new ReflectedClass(B).getMethod('foo').parameters[0].type.isClass(String)).to.be.true;
        expect(new ReflectedClass(B).getMethod('foo').getParameter('a').type.isClass(String)).to.be.true;
        expect(new ReflectedClass(B).getMethod('foo').getParameter('a').flags.isOptional).to.be.false;
        expect(new ReflectedClass(B).getMethod('foo').parameters[0].flags.isOptional).to.be.false;
        expect(new ReflectedClass(B).getMethod('foo').parameters[0].isOptional).to.be.false;
        expect(new ReflectedClass(B).getMethod('foo').getParameter('a').isOptional).to.be.false;
        
        expect(new ReflectedClass(B).getMethod('foo').parameters[1].name).to.equal('b');
        expect(new ReflectedClass(B).getMethod('foo').getParameter('b').name).to.equal('b');
        expect(new ReflectedClass(B).getMethod('foo').parameters[1].type.isClass(Boolean)).to.be.true;
        expect(new ReflectedClass(B).getMethod('foo').getParameter('b').type.isClass(Boolean)).to.be.true;
        expect(new ReflectedClass(B).getMethod('foo').parameters[1].flags.isOptional).to.be.true;
        expect(new ReflectedClass(B).getMethod('foo').getParameter('b').flags.isOptional).to.be.true;
        expect(new ReflectedClass(B).getMethod('foo').parameters[1].isOptional).to.be.true;
        expect(new ReflectedClass(B).getMethod('foo').getParameter('b').isOptional).to.be.true;
    })
});

describe('ReflectedProperty', it => {
    it('reflects public', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);
        expect(new ReflectedClass(B).getProperty('foo').visibility).to.equal('public');
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_PUBLIC}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], A);
        expect(new ReflectedClass(A).getProperty('foo').visibility).to.equal('public');
    })
    it('reflects protected', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);
        expect(new ReflectedClass(B).getProperty('foo').visibility).to.equal('public');
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_PROTECTED}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], A);
        expect(new ReflectedClass(A).getProperty('foo').visibility).to.equal('protected');
    })
    it('reflects private', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);
        expect(new ReflectedClass(B).getProperty('foo').visibility).to.equal('public');
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_PRIVATE}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], A);
        expect(new ReflectedClass(A).getProperty('foo').visibility).to.equal('private');
    })
    it('reflects readonly', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);
        expect(new ReflectedClass(B).getProperty('foo').isReadonly).to.be.false
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_READONLY}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], A);
        expect(new ReflectedClass(A).getProperty('foo').isReadonly).to.be.true
    })
    it('reflects type', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => Number, B.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => String, B.prototype, 'bar');
        Reflect.defineMetadata('rt:P', ['foo', 'bar'], B);
        expect(new ReflectedClass(B).getProperty('foo').type.isClass(Number)).to.be.true;
        expect(new ReflectedClass(B).getProperty('bar').type.isClass(String)).to.be.true;
    })
    it('reflects null type as class Object and as null', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => null, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);

        let prop = new ReflectedClass(B).getProperty('foo');

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

        expect(new ReflectedClass(B).getProperty('foo').type.isClass(Boolean)).to.be.true;
        expect(new ReflectedClass(B).getProperty('foo').type.isClass(Number)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(true)).to.be.true;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(false)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(null)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(123)).to.be.false;
    })
    it('reflects false type as class Boolean and as false', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => false, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);

        expect(new ReflectedClass(B).getProperty('foo').type.isClass(Boolean)).to.be.true;
        expect(new ReflectedClass(B).getProperty('foo').type.isClass(Number)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(false)).to.be.true;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(true)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(null)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(123)).to.be.false;
    })
    it('reflects 123 type as class Number and as 123', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => 123, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);

        expect(new ReflectedClass(B).getProperty('foo').type.isClass(Number)).to.be.true;
        expect(new ReflectedClass(B).getProperty('foo').type.isClass(Boolean)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(123)).to.be.true;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(124)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(false)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(true)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(null)).to.be.false;
    })
    it('reflects string literal type as class String and as the literal', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => 'foobaz', B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);

        expect(new ReflectedClass(B).getProperty('foo').type.isClass(String)).to.be.true;
        expect(new ReflectedClass(B).getProperty('foo').type.isClass(Number)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isClass(Boolean)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral('foobaz')).to.be.true;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral('not-it')).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(123)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(false)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(true)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(null)).to.be.false;
    })
    it('reflects undefined literal type as undefined', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => undefined, B.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], B);

        expect(new ReflectedClass(B).getProperty('foo').type.isClass(Object)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isClass(Function)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isClass(String)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isClass(Number)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isClass(Boolean)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(undefined)).to.be.true;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral('undefined')).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(123)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(false)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(true)).to.be.false;
        expect(new ReflectedClass(B).getProperty('foo').type.isLiteral(null)).to.be.false;
    })
    it('reflects static type', () => {
        class B {}
        Reflect.defineMetadata('rt:t', () => Number, B, 'foo');
        Reflect.defineMetadata('rt:t', () => String, B, 'bar');
        Reflect.defineMetadata('rt:SP', ['foo', 'bar'], B);
        expect(new ReflectedClass(B).getStaticProperty('foo').type.isClass(Number)).to.be.true;
        expect(new ReflectedClass(B).getStaticProperty('bar').type.isClass(String)).to.be.true;
    })
    it('reflects type with design:type', () => {
        class B {}
        Reflect.defineMetadata('design:type', Number, B.prototype, 'foo');
        Reflect.defineMetadata('design:type', String, B.prototype, 'bar');
        expect(new ReflectedClass(B).getProperty('foo').type.isClass(Number)).to.be.true;
        expect(new ReflectedClass(B).getProperty('bar').type.isClass(String)).to.be.true;
    })
    it('reflects static property names with design:type', () => {
        class B {
            static foo = 123;
            static bar = 'val';
        }

        expect(new ReflectedClass(B).ownStaticPropertyNames).to.eql(['foo', 'bar']);
    })
    it('reflects static type with design:type', () => {
        class B {
            static foo = 123;
            static bar;
        }
        Reflect.defineMetadata('design:type', Number, B, 'foo');
        Reflect.defineMetadata('design:type', String, B, 'bar');
        expect(new ReflectedClass(B).getStaticProperty('foo').type.isClass(Number)).to.be.true;
        expect(new ReflectedClass(B).getStaticProperty('bar').type.isClass(String)).to.be.true;
    })
});