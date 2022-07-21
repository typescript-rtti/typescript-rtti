import {expect} from "chai";
import {describe} from "razmin";
import {reflect, reify} from "./reflect";
import {F_OPTIONAL, RtObjectType, T_OBJECT} from '../common';
import {ReflectedTypeRef} from './reflect';
import {runSimple} from "../runner.test";

describe('matchesValue generics <T>', it => {
    it('T<string> = number -> number', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T> = number;
                export const t = reflect<A<string>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.true;

        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
    });

    it('T<any>', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T> = T;
                export const t = reflect<A<any>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.true;
        expect(exports.t.matchesValue("")).to.be.true;
        expect(exports.t.matchesValue(true)).to.be.true;
        expect(exports.t.matchesValue(Symbol())).to.be.true;
        expect(exports.t.matchesValue({})).to.be.true;
        expect(exports.t.matchesValue([])).to.be.true;
        expect(exports.t.matchesValue(null)).to.be.true;
        expect(exports.t.matchesValue(undefined)).to.be.true;
    });

    it('T<number>', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T> = T;
                export const t = reflect<A<number>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.true;

        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
    });

    it('T<1>', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T> = T;
                export const t = reflect<A<1>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.true;
        expect(exports.t.matchesValue(2)).to.be.false;

        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
    });

    it('T<string>', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T> = T;
                export const t = reflect<A<string>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.true;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(false)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
    });

    it('T<boolean>', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T> = T;
                export const t = reflect<A<boolean>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.true;
        expect(exports.t.matchesValue(false)).to.be.true;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
    });

    it('T<[number,string]>', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T> = T;
                export const t = reflect<A<[number,string]>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(false)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
        expect(exports.t.matchesValue([1,""])).to.be.true;
        expect(exports.t.matchesValue([1])).to.be.false;
        expect(exports.t.matchesValue([""])).to.be.false;
    });

    it('T<[1,2]>', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T> = T;
                export const t = reflect<A<[1,2]>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(false)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
        expect(exports.t.matchesValue([1,""])).to.be.false;
        expect(exports.t.matchesValue([1])).to.be.false;
        expect(exports.t.matchesValue([""])).to.be.false;
        expect(exports.t.matchesValue([1,2])).to.be.true;
        expect(exports.t.matchesValue([1,3])).to.be.false;
    });

    it('Array<number>', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T> = T;
                export const t = reflect<A<Array<number>>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(false)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.true;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
        expect(exports.t.matchesValue([1,1])).to.be.true;
        expect(exports.t.matchesValue([1])).to.be.true;
        expect(exports.t.matchesValue([""])).to.be.false;
    });

    it('number[]', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T> = T;
                export const t = reflect<A<number[]>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(false)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.true;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
        expect(exports.t.matchesValue([1,1])).to.be.true;
        expect(exports.t.matchesValue([1])).to.be.true;
        expect(exports.t.matchesValue([""])).to.be.false;
    });

    it('Object<T> = literal', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T> = {
                    a: number,
                    b: string,
                    c: boolean,
                };
                export const t = reflect<A<number>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(false)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
        expect(exports.t.matchesValue([1,1])).to.be.false;
        expect(exports.t.matchesValue([1])).to.be.false;
        expect(exports.t.matchesValue([""])).to.be.false;
        expect(exports.t.matchesValue({a:1,b:"",c:1})).to.be.false;
        expect(exports.t.matchesValue({a:1,b:"",c:true})).to.be.true;
    });

    it('Object<T -> number>', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T> = {
                    a: T,
                    b: T,
                    c: T,
                };
                export const t = reflect<A<number>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(false)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
        expect(exports.t.matchesValue([1,1])).to.be.false;
        expect(exports.t.matchesValue([1])).to.be.false;
        expect(exports.t.matchesValue([""])).to.be.false;
        expect(exports.t.matchesValue({a:1,b:"",c:1})).to.be.false;

        expect(exports.t.matchesValue({a:1,b:1,c:1})).to.be.true;
    });

    it('Object<T,K -> number,string>', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T,K> = {
                    a: T,
                    b: K,
                    c: T,
                };
                export const t = reflect<A<number,string>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(false)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
        expect(exports.t.matchesValue([1,1])).to.be.false;
        expect(exports.t.matchesValue([1])).to.be.false;
        expect(exports.t.matchesValue([""])).to.be.false;

        expect(exports.t.matchesValue({a:1,b:"",c:1})).to.be.true;
        expect(exports.t.matchesValue({a:1,b:1,c:1})).to.be.false;
    });

    it('Tuple<T,K -> [T,K]]> number,string', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T,K> = [T,K]
                export const t = reflect<A<number,string>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(false)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
        expect(exports.t.matchesValue([1,1])).to.be.false;
        expect(exports.t.matchesValue([1])).to.be.false;
        expect(exports.t.matchesValue([""])).to.be.false;
        expect(exports.t.matchesValue({a:1,b:"",c:1})).to.be.false;
        expect(exports.t.matchesValue({a:1,b:1,c:1})).to.be.false;

        expect(exports.t.matchesValue([1,""])).to.be.true;
    });

    it('T | K -> number,string', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T,K> = T | K
                export const t = reflect<A<number,string>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.true;
        expect(exports.t.matchesValue("")).to.be.true;

        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(false)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
        expect(exports.t.matchesValue([1,1])).to.be.false;
        expect(exports.t.matchesValue([1])).to.be.false;
        expect(exports.t.matchesValue([""])).to.be.false;
        expect(exports.t.matchesValue({a:1,b:"",c:1})).to.be.false;
        expect(exports.t.matchesValue({a:1,b:1,c:1})).to.be.false;
        expect(exports.t.matchesValue([1,""])).to.be.false;
    });

    it('T & K -> {a:number},{b:string}', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T,K> = T & K
                export const t = reflect<A<{a:number},{b:string}>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(false)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
        expect(exports.t.matchesValue([1,1])).to.be.false;
        expect(exports.t.matchesValue([1])).to.be.false;
        expect(exports.t.matchesValue([""])).to.be.false;
        expect(exports.t.matchesValue([1,""])).to.be.false;
        expect(exports.t.matchesValue({a:1})).to.be.false;
        expect(exports.t.matchesValue({b:""})).to.be.false;

        expect(exports.t.matchesValue({a:1,b:""})).to.be.true;
    });

    it('nested Object<T,K -> number,string>', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A<T,K> = {
                    a: T,
                    b: K,
                    c: [T,K],
                };
                export const t = reflect<A<number,string>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(false)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
        expect(exports.t.matchesValue([1,1])).to.be.false;
        expect(exports.t.matchesValue([1])).to.be.false;
        expect(exports.t.matchesValue([""])).to.be.false;
        expect(exports.t.matchesValue({a:1,b:"",c:1})).to.be.false;
        expect(exports.t.matchesValue({a:1,b:1,c:1})).to.be.false;
        expect(exports.t.matchesValue({a:1,b:1,c:[1,""]})).to.be.false;
        expect(exports.t.matchesValue({a:1,b:"",c:[1,""]})).to.be.true;
    });

    it('multi nested Object<T,K -> number,string>', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type B<T> = {
                    a: T,
                }
                export type A<T,K> = {
                    a: T,
                    b: K,
                    c: [T,K],
                    d: B<T>,
                };
                export const t = reflect<A<number,string>>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(false)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
        expect(exports.t.matchesValue([1,1])).to.be.false;
        expect(exports.t.matchesValue([1])).to.be.false;
        expect(exports.t.matchesValue([""])).to.be.false;
        expect(exports.t.matchesValue({a:1,b:"",c:1})).to.be.false;
        expect(exports.t.matchesValue({a:1,b:1,c:1})).to.be.false;
        expect(exports.t.matchesValue({a:1,b:1,c:[1,""]})).to.be.false;
        expect(exports.t.matchesValue({a:1,b:"",c:[1,""]})).to.be.false;
        expect(exports.t.matchesValue({a:1,b:"",c:[1,""],d:{a:""}})).to.be.false;
        expect(exports.t.matchesValue({a:1,b:"",c:[1,""],d:{a:1}})).to.be.true;
    });
});
