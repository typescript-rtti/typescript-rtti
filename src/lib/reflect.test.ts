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
        expect(a.type).to.equal(Number);
        expect(a.name).to.equal('a');
        expect(b.type).to.equal(String);
        expect(b.name).to.equal('b');
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
});

describe('ReflectedMethod', it => {
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
        expect(new ReflectedClass(B).getMethod('foo').returnType).to.equal(Number)
        expect(new ReflectedClass(B).getMethod('bar').returnType).to.be.null;
    })
    it('reflects parameters', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:p', [{n:'a', t: () => String}, {n:'b', t: () => Boolean}], B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo', 'bar'], B);
        expect(new ReflectedClass(B).getMethod('foo').parameters[0].name).to.equal('a');
        expect(new ReflectedClass(B).getMethod('foo').getParameter('a').name).to.equal('a');
        expect(new ReflectedClass(B).getMethod('foo').parameters[0].type).to.equal(Boolean);
        expect(new ReflectedClass(B).getMethod('foo').getParameter('b').type).to.equal(Boolean);
    })
    it('reflects parameter optionality', () => {
        class B {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}`, B.prototype, 'foo');
        Reflect.defineMetadata('rt:p', [{n:'a', t: () => String}, {n:'b', t: () => Boolean, f: `${flags.F_OPTIONAL}`}], B.prototype, 'foo');
        Reflect.defineMetadata('rt:m', ['foo', 'bar'], B);

        expect(new ReflectedClass(B).getMethod('foo').parameters[0].name).to.equal('a');
        expect(new ReflectedClass(B).getMethod('foo').getParameter('a').name).to.equal('a');
        expect(new ReflectedClass(B).getMethod('foo').parameters[0].type).to.equal(String);
        expect(new ReflectedClass(B).getMethod('foo').getParameter('a').type).to.equal(String);
        expect(new ReflectedClass(B).getMethod('foo').getParameter('a').flags.isOptional).to.be.false;
        expect(new ReflectedClass(B).getMethod('foo').parameters[0].flags.isOptional).to.be.false;
        expect(new ReflectedClass(B).getMethod('foo').parameters[0].isOptional).to.be.false;
        expect(new ReflectedClass(B).getMethod('foo').getParameter('a').isOptional).to.be.false;
        
        expect(new ReflectedClass(B).getMethod('foo').parameters[1].name).to.equal('b');
        expect(new ReflectedClass(B).getMethod('foo').getParameter('b').name).to.equal('b');
        expect(new ReflectedClass(B).getMethod('foo').parameters[1].type).to.equal(Boolean);
        expect(new ReflectedClass(B).getMethod('foo').getParameter('b').type).to.equal(Boolean);
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
        expect(new ReflectedClass(B).getProperty('foo').type).to.equal(Number);
        expect(new ReflectedClass(B).getProperty('bar').type).to.equal(String);
        class A {}
        Reflect.defineMetadata('rt:f', `${flags.F_METHOD}${flags.F_READONLY}`, A.prototype, 'foo');
        Reflect.defineMetadata('rt:P', ['foo'], A);
        expect(new ReflectedClass(A).getProperty('foo').isReadonly).to.be.true
    })
});