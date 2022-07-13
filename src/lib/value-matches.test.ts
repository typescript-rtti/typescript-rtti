import { expect } from "chai";
import { describe } from "razmin";
import {reflect, reify} from "./reflect";
import { F_OPTIONAL, RtObjectType, T_OBJECT } from '../common';
import { ReflectedTypeRef } from './reflect';
import {runSimple} from "../runner.test";

describe('ReflectedClass#matchesValue()', it => {
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
    it('type alias', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reify, reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A = number;
                export type B<T> = T;
                export type C<T> = {a:T, b:T};
                export interface D<T> {
                    a:T, b:T;
                }
                export type E<T> = D<T>;

                export const refA = reflect<A>();
                export const refB1 = reflect<B<any>>();
                export const refB2 = reflect<B<string>>();
                export const refC = reflect<C<number>>();
                export const refE = reflect<E<boolean>>();
            `,
        });
        expect(exports.refA.matchesValue(1)).to.be.true;
        expect(exports.refA.matchesValue("1")).to.be.false;

        /* should not match, as missing parameter assume never*/
        let baseB1 = exports.refB1.as("generic").baseType
        expect(baseB1.matchesValue(Object)).to.be.false;
        expect(baseB1.matchesValue({})).to.be.false;
        expect(baseB1.matchesValue(1)).to.be.false;
        expect(baseB1.matchesValue(null)).to.be.false;
        expect(baseB1.matchesValue("1")).to.be.false;
        expect(baseB1.matchesValue(undefined)).to.be.false;
        expect(baseB1.matchesValue(false)).to.be.false;
        expect(baseB1.matchesValue(true)).to.be.false;
        expect(exports.refB1.matchesValue("any")).to.be.true;

        expect(exports.refB2.matchesValue(1)).to.be.false;
        expect(exports.refB2.matchesValue(null)).to.be.false;
        expect(exports.refB2.matchesValue("1")).to.be.true;
        expect(exports.refB2.matchesValue(false)).to.be.false;

        expect(exports.refC.matchesValue(1)).to.be.false;
        expect(exports.refC.matchesValue({ a: "", b: 1 })).to.be.false;
        expect(exports.refC.matchesValue({ a: {}, b: {} })).to.be.false;
        expect(exports.refC.matchesValue({ a: 1, b: 1 })).to.be.true;

        expect(exports.refE.matchesValue(1)).to.be.false;
        expect(exports.refE.matchesValue({ a: "", b: 1 })).to.be.false;
        expect(exports.refE.matchesValue({ a: {}, b: {} })).to.be.false;
        expect(exports.refE.matchesValue({ a: true, b: false })).to.be.true;
    });
});
