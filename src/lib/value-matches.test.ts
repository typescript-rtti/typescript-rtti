import { expect } from "chai";
import { describe, it } from "@jest/globals";
import { MatchesValueOptions, reflect } from "./reflect";
import { F_OPTIONAL, RtMappedType, RtObjectType, T_MAPPED, T_OBJECT } from '../common';
import { ReflectedTypeRef } from './reflect';

function expectValueToMatch(type: ReflectedTypeRef, value: any, options?: MatchesValueOptions) {
    let errors: Error[] = [];
    let matches = type.matchesValue(value, { ...options, errors })
    expect(matches, `Expected value to match, but there were errors: ${JSON.stringify(errors.map(e => e.message))}`)
        .to.be.true;
}

function expectValueNotToMatch(type: ReflectedTypeRef, value: any, options?: MatchesValueOptions) {
    let errors: Error[] = [];
    let matches = type.matchesValue(value, { ...options, errors })
    expect(matches, `Expected value not to match, recorded errors: ${JSON.stringify(errors.map(e => e.message))}`)
        .to.be.false;
}

describe('ReflectedClass#matchesValue()', () => {
    it('works with simple interfaces', async () => {
        let IΦA = { name: 'A', prototype: {}, identity: Symbol('A (interface)') };

        Reflect.defineMetadata('rt:P', ['foo', 'bar', 'baz','ban'], IΦA);
        Reflect.defineMetadata('rt:t', () => String, IΦA.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => Number, IΦA.prototype, 'bar');
        Reflect.defineMetadata('rt:t', () => Boolean, IΦA.prototype, 'baz');
        Reflect.defineMetadata('rt:t', () => BigInt, IΦA.prototype, 'ban');

        expect(reflect(IΦA).matchesValue({
            foo: 'hello',
            bar: 123,
            baz: true,
            ban: BigInt(123)
        })).to.be.true;

        expect(reflect(IΦA).matchesValue({
            foo: 1111,
            bar: 123,
            baz: true,
            ban: BigInt(123)
        })).to.be.false;
    });
    it('supports literal types', async () => {
        const IΦA = { name: 'A', prototype: {}, identity: Symbol('A (interface)') };

        Reflect.defineMetadata('rt:P', ['foo'], IΦA);
        Reflect.defineMetadata('rt:t', () => 'hello', IΦA.prototype, 'foo');
        expect(reflect(IΦA).matchesValue({ foo: 'hello' })).to.be.true;
        expect(reflect(IΦA).matchesValue({ foo: 'hello world' })).to.be.false;
    });

    const BUILTIN_TYPES = [
        { name: 'BigInt', type: BigInt, trueCases: [BigInt(32), BigInt(0)], falseCases: ["hello world", NaN, Infinity] },
        { name: 'String', type: String, trueCases: ["hello world", ""], falseCases: [32, true, BigInt(32), NaN, Infinity] },
        { name: 'Number', type: Number, trueCases: [32, 32.4, 0, -32, NaN, Infinity], falseCases: ["hello", BigInt(32) ] },
        { name: 'Boolean', type: Boolean, trueCases: [ true, false ], falseCases: ["hello", BigInt(32), 32, 32.5, NaN, Infinity ]},
        { name: 'Symbol', type: Symbol, trueCases: [ Symbol("foo"), Symbol("bar") ], falseCases: ["hello", BigInt(32), 32, 32.5, NaN, Infinity ]}
    ];

    for (const { name, type, trueCases, falseCases } of BUILTIN_TYPES) {
        it(`supports builtin type ${name}`, async () => {
            const IΦA = { name: 'A', prototype: {}, identity: Symbol('A (interface)') };

            Reflect.defineMetadata('rt:P', ['foo'], IΦA);
            Reflect.defineMetadata('rt:t', () => type, IΦA.prototype, 'foo');

            for (let trueCase of trueCases) {
                try {
                    expect(reflect(IΦA).matchesValue({ foo: trueCase })).to.be.true;
                    expect(reflect(IΦA).getProperty('foo').matchesValue(trueCase)).to.be.true;
                } catch (e) {
                    throw new Error(`Value ${String(trueCase)} should be allowed. Error was: ${e.message}`);
                }
            }

            for (let falseCase of falseCases) {
                try {
                    expect(reflect(IΦA).matchesValue({ foo: falseCase })).to.be.false;
                    expect(reflect(IΦA).getProperty('foo').matchesValue(falseCase)).to.be.false;
                } catch (e) {
                    throw new Error(`Value ${String(falseCase)} should not be allowed. Error was: ${e.message}`);
                }
            }
        });
    }

    it('supports mapped types', async () => {
        let ref = ReflectedTypeRef.createFromRtRef(<RtMappedType>{
            TΦ: T_MAPPED,
            p: [ Number ],
            t: class A {},
            m: [
                {
                    n: 'foo',
                    f: '',
                    t: Number
                }
            ]
        })

        expect(ref.matchesValue({ foo: 123 })).to.be.true;
        expect(ref.matchesValue({ foo: 123, bar: true })).to.be.true;
        expect(ref.matchesValue({ foo: 'blah' })).to.be.false;
        expect(ref.matchesValue({ })).to.be.false;
    });
    it('does not allow extra properties by default', () => {
        class A { }
        Reflect.defineMetadata('rt:t', () => Number, A.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => String, A.prototype, 'bar');
        Reflect.defineMetadata('rt:P', ['foo', 'bar'], A);
        let ref = ReflectedTypeRef.createFromRtRef(A);
        expectValueToMatch(ref, { foo: 123, bar: 'world' });
        expectValueNotToMatch(ref, { foo: 123, bar: 'world', extra: 123 });
    });
    it('does not see methods as extra properties', () => {
        class A {
            foo() { }
            bar() { }
        }
        Reflect.defineMetadata('rt:t', () => Number, A.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => String, A.prototype, 'bar');
        Reflect.defineMetadata('rt:m', ['foo', 'bar'], A);
        Reflect.defineMetadata('rt:P', [], A);
        let ref = ReflectedTypeRef.createFromRtRef(A);
        expectValueToMatch(ref, new A());
    });
    it('does allow extra properties when opted in', () => {
        class A { }
        Reflect.defineMetadata('rt:t', () => Number, A.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => String, A.prototype, 'bar');
        Reflect.defineMetadata('rt:P', ['foo', 'bar'], A);
        let ref = ReflectedTypeRef.createFromRtRef(A);
        expectValueNotToMatch(ref, { foo: 123, bar: 'world', extra: 123 });
        expectValueToMatch(ref, { foo: 123, bar: 'world', extra: 123 }, { allowExtraProperties: true });
    });
});
describe('ReflectedObjectRef#matchesValue()', () => {
    it('supports object literals', async () => {
        let ref = ReflectedTypeRef.createFromRtRef(<RtObjectType>{
            TΦ: T_OBJECT,
            m: [
                { n: 'foo', t: String, f: '' },
                { n: 'bar', t: String, f: '' },
                { n: 'baz', t: String, f: F_OPTIONAL },
            ]
        })
        expect(ref.matchesValue({ foo: 'hello' })).to.be.false;
        expect(ref.matchesValue({ foo: 'hello', bar: 'world' })).to.be.true;
        expect(ref.matchesValue({ foo: 'hello', bar: 'world', baz: 'hey' })).to.be.true;
        expect(ref.matchesValue({ foo: 'hello', bar: 'world', baz: 123 })).to.be.false;


        let ref2 = ReflectedTypeRef.createFromRtRef(<RtObjectType>{
            TΦ: T_OBJECT,
            m: [
                { n: 'foo', t: Number, f: '' },
                { n: 'bar', t: String, f: '' },
                { n: 'baz', t: String, f: F_OPTIONAL },
            ]
        })
        expect(ref2.matchesValue({ foo: 'hello' })).to.be.false;
        expect(ref2.matchesValue({ foo: 123 })).to.be.false;
        expect(ref2.matchesValue({ foo: 123, bar: 'world' })).to.be.true;
        expect(ref2.matchesValue({ foo: 123, bar: 'world', baz: 'hey' })).to.be.true;
        expect(ref2.matchesValue({ foo: 123, bar: 'world', baz: 123 })).to.be.false;
    });
    it('does not allow extra properties by default', () => {
        let ref = ReflectedTypeRef.createFromRtRef(<RtObjectType>{
            TΦ: T_OBJECT,
            m: [
                { n: 'foo', t: String, f: '' },
                { n: 'bar', t: String, f: '' },
                { n: 'baz', t: String, f: F_OPTIONAL },
            ]
        })
        expect(ref.matchesValue({ foo: 'hello', bar: 'world', baz: 'hey' })).to.be.true;
        expect(ref.matchesValue({ foo: 'hello', bar: 'world', baz: 'hey', extra: 123 })).to.be.false;
    });
    it('does allow extra properties when opted in', () => {
        let ref = ReflectedTypeRef.createFromRtRef(<RtObjectType>{
            TΦ: T_OBJECT,
            m: [
                { n: 'foo', t: String, f: '' },
                { n: 'bar', t: String, f: '' },
                { n: 'baz', t: String, f: F_OPTIONAL },
            ]
        })
        expect(ref.matchesValue({ foo: 'hello', bar: 'world', baz: 'hey', extra: 123 })).to.be.false;
        expect(ref.matchesValue({ foo: 'hello', bar: 'world', baz: 'hey', extra: 123 }, { allowExtraProperties: true })).to.be.true;

    });
});
