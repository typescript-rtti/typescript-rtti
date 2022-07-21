import {describe} from "razmin";
import {reflect} from "./reflect";
import {runSimple} from "../runner.test";
import {expect} from "chai";

describe('matchesValue aliases', it => {
    it('undefined', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A = undefined;
                export const t = reflect<A>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.true;
    });

    it('null', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A = null;
                export const t = reflect<A>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.true;
        expect(exports.t.matchesValue(undefined)).to.be.false;
    });

    it('any', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A = any;
                export const t = reflect<A>();
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

    it('number', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A = number;
                export const t = reflect<A>();
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

    it('1', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A = 1;
                export const t = reflect<A>();
            `
        });
        expect(exports.t.matchesValue(1)).to.be.true;

        expect(exports.t.matchesValue(2)).to.be.false;
        expect(exports.t.matchesValue("")).to.be.false;
        expect(exports.t.matchesValue(true)).to.be.false;
        expect(exports.t.matchesValue(false)).to.be.false;
        expect(exports.t.matchesValue(Symbol())).to.be.false;
        expect(exports.t.matchesValue({})).to.be.false;
        expect(exports.t.matchesValue([])).to.be.false;
        expect(exports.t.matchesValue(null)).to.be.false;
        expect(exports.t.matchesValue(undefined)).to.be.false;
    });

    it('string', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A = string;
                export const t = reflect<A>();
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

    it('boolean', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A = boolean;
                export const t = reflect<A>();
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

    it('tuple', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A = [number,string];
                export const t = reflect<A>();
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

    it('Array<number>', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A = number[];
                export const t = reflect<A>();
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

    it('Object', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type A = {
                    a: number,
                    b: string,
                    c: boolean,
                };
                export const t = reflect<A>();
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
        expect(exports.t.matchesValue({a:null,b:"",c:true})).to.be.false;
        expect(exports.t.matchesValue({a:undefined,b:"",c:true})).to.be.false;
        expect(exports.t.matchesValue({a:1,b:"",c:true})).to.be.true;
    });
});
