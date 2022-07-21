import {expect} from "chai";
import {describe} from "razmin";
import { ReflectedTypeRef} from ".";
import {runSimple} from "../runner.test";
import {reify, reflect} from "./reflect";

describe('reflect.createType()', it => {
    it('create generic alias positional', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reify, reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type K<T> = T;
                //@ts-ignore
                export const t = reflect<K>();
            `
        });
        const t = exports.t.as("alias").createType(Number);
        expect(t.kind).to.equal("class");
        expect(t.as("class").class).to.equal(Number);
    });

    it('create generic alias {T}', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reify, reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type K<T> = T;
                //@ts-ignore
                export const t = reflect<K>();
            `
        });
        const t = exports.t.as("alias").createType(Number);
        expect(t.kind).to.equal("class");
        expect(t.as("class").class).to.equal(Number);
    });
});
