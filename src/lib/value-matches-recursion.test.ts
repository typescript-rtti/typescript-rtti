import {expect} from "chai";
import {describe} from "razmin";
import {reflect, reify} from "./reflect";
import {F_OPTIONAL, RtObjectType, T_OBJECT} from '../common';
import {ReflectedTypeRef} from './reflect';
import {runSimple} from "../runner.test";

describe('matchesValue recursions', it => {
    it('infinite recursion alias', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type B<T,K> = {
                    a: A<K>
                };
                export type A<T> = B<T,number>;
                export const refA = reflect<A<number>>();

                export type B1<T,K> = {
                    a?: A1<K>
                };
                export type A1<T> = B1<T,number>;
                export const refA1 = reflect<A1<number>>();
            `,
        });
        expect(exports.refA.matchesValue(1)).to.be.false;
        expect(exports.refA.matchesValue({a: {a: {a: {a: {}}}}})).to.be.false; // it would never match as it's an infinite recursion

        expect(exports.refA1.matchesValue(1)).to.be.false;
        expect(exports.refA1.matchesValue({a: {a: {}}})).to.be.true;
    });
    it('infinite recursion multiple hops alias', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type B<T> = {
                    b:A<T,string>
                }
                export type A<T,K> = {
                    a?: B<K>
                };
                export type C<T> = A<T,number>;
                export const refA = reflect<C<number>>();
            `
        });
        expect(exports.refA.matchesValue(1)).to.be.false;
        expect(exports.refA.matchesValue({a: {a: {}}})).to.be.false;
        expect(exports.refA.matchesValue({a: {b: {a: {b: {}}}}})).to.be.true;
    });
    it('infinite recursion interface + alias', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export interface B<T,K> {
                    a: A<K>
                };
                export type A<T> = B<T,number>;
                export const refA = reflect<A<number>>();

                export interface B1<T,K> {
                    a?: A1<K>
                };
                export type A1<T> = B1<T,number>;
                export const refA1 = reflect<A1<number>>();
            `
        });
        expect(exports.refA.matchesValue(1)).to.be.false;
        expect(exports.refA.matchesValue({a: {a: {a: {a: {}}}}})).to.be.false; // it would never match as it's an infinite recursion

        expect(exports.refA1.matchesValue(1)).to.be.false;
        expect(exports.refA1.matchesValue({a: {a: {}}})).to.be.true;
    });
    it('infinite recursion interface', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export interface B<T,K> {
                    a: A<K>
                };
                export interface A<T> extends B<T,number>{
                }
                export const refA = reflect<A<number>>();

                export interface B1<T,K> {
                    a?: A1<K>
                };
                export interface A1<T> extends B1<T,number>{
                }
                export const refA1 = reflect<A1<number>>();
            `
        });
        expect(exports.refA.matchesValue(1)).to.be.false;
        expect(exports.refA.matchesValue({a: {a: {a: {a: {}}}}})).to.be.false; // it would never match as it's an infinite recursion

        expect(exports.refA1.matchesValue(1)).to.be.false;
        expect(exports.refA1.matchesValue({a: {a: {}}})).to.be.true;
    });
});
