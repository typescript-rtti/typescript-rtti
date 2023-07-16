import { expect } from "chai";
import { describe, it } from "@jest/globals";
import { MatchesValueOptions, ClassType, InterfaceType, reflect } from "./reflect";
import { F_OPTIONAL, RtMappedType, RtObjectType, T_MAPPED, T_OBJECT } from '../common';
import { Type } from './reflect';

import * as format from '../common/format';
import { builtinClass, expectValueNotToMatch, expectValueToMatch, functionType, literal, reflectInterfaceType } from './utils.test-harness';

describe('ClassType#matchesValue()', () => {
    it('works with simple interfaces', async () => {
        let type = reflectInterfaceType({
            m: [
                { f: format.F_PROPERTY, n: 'foo', t: builtinClass(String) },
                { f: format.F_PROPERTY, n: 'bar', t: builtinClass(Number) },
                { f: format.F_PROPERTY, n: 'baz', t: builtinClass(Boolean) },
                { f: format.F_PROPERTY, n: 'ban', t: builtinClass(BigInt) }
            ]
        });

        expect(type.matchesValue({
            foo: 'hello',
            bar: 123,
            baz: true,
            ban: BigInt(123)
        })).to.be.true;

        expect(type.matchesValue({
            foo: 1111,
            bar: 123,
            baz: true,
            ban: BigInt(123)
        })).to.be.false;
    });
    it('supports literal types', async () => {
        let type = reflectInterfaceType({
            m: [
                { f: format.F_PROPERTY, n: 'foo', t: literal('hello') }
            ]
        });

        expect(type.matchesValue({ foo: 'hello' })).to.be.true;
        expect(type.matchesValue({ foo: 'hello world' })).to.be.false;
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
            const reflectedType = reflectInterfaceType({
                m: [
                    { f: format.F_PROPERTY, n: 'foo', t: builtinClass(type) }
                ]
            })

            for (let trueCase of trueCases) {
                try {
                    expect(reflectedType.matchesValue({ foo: trueCase })).to.be.true;
                    expect(reflectedType.getProperty('foo').matchesValue(trueCase)).to.be.true;
                } catch (e) {
                    throw new Error(`Value ${String(trueCase)} should be allowed. Error was: ${e.message}`);
                }
            }

            for (let falseCase of falseCases) {
                try {
                    expect(reflectedType.matchesValue({ foo: falseCase })).to.be.false;
                    expect(reflectedType.getProperty('foo').matchesValue(falseCase)).to.be.false;
                } catch (e) {
                    throw new Error(`Value ${String(falseCase)} should not be allowed. Error was: ${e.message}`);
                }
            }
        });
    }

    it('supports mapped types', async () => {
        let ref = Type.createFromRtRef(<RtMappedType>{
            TΦ: T_MAPPED,
            p: [ builtinClass(Number) ],
            t: builtinClass(class A {}),
            m: [
                {
                    n: 'foo',
                    f: '',
                    t: builtinClass(Number)
                }
            ]
        })

        expect(ref.matchesValue({ foo: 123 })).to.be.true;
        expect(ref.matchesValue({ foo: 123, bar: true })).to.be.true;
        expect(ref.matchesValue({ foo: 'blah' })).to.be.false;
        expect(ref.matchesValue({ })).to.be.false;
    });
    it('does not allow extra properties by default', () => {
        let ref = reflectInterfaceType({
            m: [
                { f: format.F_PROPERTY, n: 'foo', t: builtinClass(Number) },
                { f: format.F_PROPERTY, n: 'bar', t: builtinClass(String) },
            ]
        })
        expectValueToMatch(ref, { foo: 123, bar: 'world' });
        expectValueNotToMatch(ref, { foo: 123, bar: 'world', extra: 123 });
    });
    it('requires methods to be satisfied', () => {
        let ref = reflectInterfaceType({
            m: [
                { f: format.F_METHOD, n: 'foo', t: functionType([], builtinClass(Number)) },
                { f: format.F_METHOD, n: 'bar', t: functionType([], builtinClass(String)) },
            ]
        })
        expectValueToMatch(ref, { foo() { }, bar() { } });
        expectValueNotToMatch(ref, {});
    });
    it('checks that number of parameters is correct when satisfying methods', () => {
        let ref = reflectInterfaceType({
            m: [
                { f: format.F_METHOD, n: 'foo', t: functionType([], builtinClass(Number)) }
            ]
        })
        expectValueToMatch(ref, { foo() { } });
        expectValueNotToMatch(ref, { foo(arg1) { } });
    });
    it('does not see methods as extra properties', () => {
        let ref = reflectInterfaceType({
            m: [
                { f: format.F_METHOD, n: 'foo', t: functionType([], builtinClass(Number)) },
                { f: format.F_METHOD, n: 'bar', t: functionType([], builtinClass(String)) },
            ]
        })
        expectValueToMatch(ref, { foo() { }, bar() { } });
    });
    it('does allow extra properties when opted in', () => {
        let ref = reflectInterfaceType({
            m: [
                { f: format.F_PROPERTY, n: 'foo', t: builtinClass(Number) },
                { f: format.F_PROPERTY, n: 'bar', t: builtinClass(String) },
            ]
        })

        expectValueNotToMatch(ref, { foo: 123, bar: 'world', extra: 123 });
        expectValueToMatch(ref, { foo: 123, bar: 'world', extra: 123 }, { allowExtraProperties: true });
    });
});
describe('ObjectType#matchesValue()', () => {
    it('supports object literals', async () => {
        let ref = Type.createFromRtRef(<format.RtObjectType>{
            TΦ: T_OBJECT,
            m: [
                { n: 'foo', t: builtinClass(String), f: '' },
                { n: 'bar', t: builtinClass(String), f: '' },
                { n: 'baz', t: builtinClass(String), f: F_OPTIONAL },
            ]
        })
        expect(ref.matchesValue({ foo: 'hello' })).to.be.false;
        expect(ref.matchesValue({ foo: 'hello', bar: 'world' })).to.be.true;
        expect(ref.matchesValue({ foo: 'hello', bar: 'world', baz: 'hey' })).to.be.true;
        expect(ref.matchesValue({ foo: 'hello', bar: 'world', baz: 123 })).to.be.false;


        let ref2 = Type.createFromRtRef(<RtObjectType>{
            TΦ: T_OBJECT,
            m: [
                { n: 'foo', t: builtinClass(Number), f: '' },
                { n: 'bar', t: builtinClass(String), f: '' },
                { n: 'baz', t: builtinClass(String), f: F_OPTIONAL },
            ]
        })
        expect(ref2.matchesValue({ foo: 'hello' })).to.be.false;
        expect(ref2.matchesValue({ foo: 123 })).to.be.false;
        expect(ref2.matchesValue({ foo: 123, bar: 'world' })).to.be.true;
        expect(ref2.matchesValue({ foo: 123, bar: 'world', baz: 'hey' })).to.be.true;
        expect(ref2.matchesValue({ foo: 123, bar: 'world', baz: 123 })).to.be.false;
    });
    it('does not allow extra properties by default', () => {
        let ref = Type.createFromRtRef(<RtObjectType>{
            TΦ: T_OBJECT,
            m: [
                { n: 'foo', t: builtinClass(String), f: '' },
                { n: 'bar', t: builtinClass(String), f: '' },
                { n: 'baz', t: builtinClass(String), f: F_OPTIONAL },
            ]
        })
        expect(ref.matchesValue({ foo: 'hello', bar: 'world', baz: 'hey' })).to.be.true;
        expect(ref.matchesValue({ foo: 'hello', bar: 'world', baz: 'hey', extra: 123 })).to.be.false;
    });
    it('does allow extra properties when opted in', () => {
        let ref = Type.createFromRtRef(<RtObjectType>{
            TΦ: T_OBJECT,
            m: [
                { n: 'foo', t: builtinClass(String), f: '' },
                { n: 'bar', t: builtinClass(String), f: '' },
                { n: 'baz', t: builtinClass(String), f: F_OPTIONAL },
            ]
        })
        expect(ref.matchesValue({ foo: 'hello', bar: 'world', baz: 'hey', extra: 123 })).to.be.false;
        expect(ref.matchesValue({ foo: 'hello', bar: 'world', baz: 'hey', extra: 123 }, { allowExtraProperties: true })).to.be.true;
    });
});
