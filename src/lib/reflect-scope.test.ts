import {expect} from "chai";
import {describe} from "razmin";
import {ReflectedClassRef, ReflectedGenericRef, ReflectedInterfaceRef, ReflectedLiteralRef, ReflectedTypeRef} from ".";
import {runSimple} from "../runner.test";
import {reify, reflect} from "./reflect";

describe('reflect scope', it => {
    it('alias', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reify, reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export const reflectedTypeRef = reflect<Something>();
                export type Something = number;
            `
        });
        expect(exports.reflectedTypeRef.isAliased()).to.equal(true);
        expect((exports.reflectedTypeRef as ReflectedTypeRef).as('alias').token)
            .to.equal(exports.AΦSomething);
    });
});
