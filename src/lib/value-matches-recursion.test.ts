import {expect} from "chai";
import {describe} from "razmin";
import {reflect} from "./reflect";
import {runSimple} from "../runner.test";

describe('matchesValue recursions', it => {
    it('infinite recursion alias self', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A = A;
                export const refA1 = reflect<A>();
            `,
        });
        // never match as it is infinite
        expect(exports.refA1.matchesValue(1)).to.be.false;
        expect(exports.refA1.matchesValue({})).to.be.false;
        expect(exports.refA1.matchesValue(true)).to.be.false;
        expect(exports.refA1.matchesValue(Object)).to.be.false;
        expect(exports.refA1.matchesValue(undefined)).to.be.false;
        expect(exports.refA1.matchesValue(null)).to.be.false;
        expect(exports.refA1.matchesValue(Symbol)).to.be.false;
        expect(exports.refA1.matchesValue(() => {})).to.be.false;
    });

    it('infinite recursion alias self chain', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type C = A;
                export type B = C;
                export type A = B;
                export const refA1 = reflect<A>();
            `,
        });
        // never match as it is infinite
        expect(exports.refA1.matchesValue(1)).to.be.false;
        expect(exports.refA1.matchesValue({})).to.be.false;
        expect(exports.refA1.matchesValue(true)).to.be.false;
        expect(exports.refA1.matchesValue(Object)).to.be.false;
        expect(exports.refA1.matchesValue(undefined)).to.be.false;
        expect(exports.refA1.matchesValue(null)).to.be.false;
        expect(exports.refA1.matchesValue(Symbol)).to.be.false;
        expect(exports.refA1.matchesValue(() => {})).to.be.false;
    });
    /**
     * Typescript bug emits any for
     * type A = A | number;
     * type A = A & number;
     */
    // it('infinite recursion alias union', async () => {
    //     let exports = await runSimple({
    //         modules: {
    //             "typescript-rtti": {reflect},
    //         },
    //         code: `
    //             import { reflect } from 'typescript-rtti';
    //             export type A = A | number;
    //             export const refA1 = reflect<A>();
    //         `,
    //     });
    //     expect(exports.refA1.matchesValue(1)).to.be.true;
    //
    //     expect(exports.refA1.matchesValue({})).to.be.false;
    //     expect(exports.refA1.matchesValue(true)).to.be.false;
    //     expect(exports.refA1.matchesValue(Object)).to.be.false;
    //     expect(exports.refA1.matchesValue(undefined)).to.be.false;
    //     expect(exports.refA1.matchesValue(null)).to.be.false;
    //     expect(exports.refA1.matchesValue(Symbol)).to.be.false;
    //     expect(exports.refA1.matchesValue(() => {})).to.be.false;
    // });

    it('infinite recursion alias self<T>', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T> = A<T>;
                export const refA1 = reflect<A<1>>();
            `,
        });
        // never match as it is infinite
        expect(exports.refA1.matchesValue(1)).to.be.false;
        expect(exports.refA1.matchesValue({})).to.be.false;
        expect(exports.refA1.matchesValue(true)).to.be.false;
        expect(exports.refA1.matchesValue(Object)).to.be.false;
        expect(exports.refA1.matchesValue(undefined)).to.be.false;
        expect(exports.refA1.matchesValue(null)).to.be.false;
        expect(exports.refA1.matchesValue(Symbol)).to.be.false;
        expect(exports.refA1.matchesValue(() => {})).to.be.false;
    });

    it('infinite recursion alias self<T> chain', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type C<T> = A<T>;
                export type B<T> = C<T>;
                export type A<T> = B<T>;
                export const refA1 = reflect<A<1>>();
            `,
        });
        // never match as it is infinite
        expect(exports.refA1.matchesValue(1)).to.be.false;
        expect(exports.refA1.matchesValue({})).to.be.false;
        expect(exports.refA1.matchesValue(true)).to.be.false;
        expect(exports.refA1.matchesValue(Object)).to.be.false;
        expect(exports.refA1.matchesValue(undefined)).to.be.false;
        expect(exports.refA1.matchesValue(null)).to.be.false;
        expect(exports.refA1.matchesValue(Symbol)).to.be.false;
        expect(exports.refA1.matchesValue(() => {})).to.be.false;
    });

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
    // TODO add extends support for interfaces generics
    // it('infinite recursion interface', async () => {
    //     let exports = await runSimple({
    //         modules: {
    //             "typescript-rtti": {reflect},
    //         },
    //         code: `
    //             import { reflect } from 'typescript-rtti';
    //             export interface B<T,K> {
    //                 a: A<K>
    //             };
    //             export interface A<T> extends B<T,number>{
    //             }
    //             export const refA = reflect<A<number>>();
    //
    //             export interface B1<T,K> {
    //                 a?: A1<K>
    //             };
    //             export interface A1<T> extends B1<T,number>{
    //             }
    //             export const refA1 = reflect<A1<number>>();
    //         `
    //     });
    //     expect(exports.refA.matchesValue(1)).to.be.false;
    //     expect(exports.refA.matchesValue({a: {a: {a: {a: {}}}}})).to.be.false; // it would never match as it's an infinite recursion
    //
    //     expect(exports.refA1.matchesValue(1)).to.be.false;
    //     expect(exports.refA1.matchesValue({a: {a: {}}})).to.be.true;
    // });
});
