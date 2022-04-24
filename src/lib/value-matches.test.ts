import { expect } from "chai";
import { describe } from "razmin";
import { reflect } from "./reflect";
import { F_OPTIONAL, RtObjectType, T_OBJECT } from '../common';
import { ReflectedTypeRef } from './reflect';

describe('ReflectedClass#matchesValue()', it => {
    it('works with simple interfaces', async () => {
        let IΦA = { name: 'A', prototype: {}, identity: Symbol('A (interface)') };

        Reflect.defineMetadata('rt:P', ['foo', 'bar', 'baz'], IΦA);
        Reflect.defineMetadata('rt:t', () => String, IΦA.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => Number, IΦA.prototype, 'bar');
        Reflect.defineMetadata('rt:t', () => Boolean, IΦA.prototype, 'baz');

        expect(reflect(IΦA).matchesValue({
            foo: 'hello',
            bar: 123,
            baz: true
        })).to.be.true;

        expect(reflect(IΦA).matchesValue({
            foo: 1111,
            bar: 123,
            baz: true
        })).to.be.false;
    });
    it('supports literal types', async () => {
        const IΦA = { name: 'A', prototype: {}, identity: Symbol('A (interface)') };

        Reflect.defineMetadata('rt:P', ['foo'], IΦA);
        Reflect.defineMetadata('rt:t', () => 'hello', IΦA.prototype, 'foo');
        expect(reflect(IΦA).matchesValue({ foo: 'hello' })).to.be.true;
        expect(reflect(IΦA).matchesValue({ foo: 'hello world' })).to.be.false;
    });
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
});